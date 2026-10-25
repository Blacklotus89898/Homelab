# Tulip

Human-gated trading co-pilot: rules propose, Claude reviews, the operator
approves (paper) or places the order themselves in Questrade (co-pilot). Source
and design: [github.com/Blacklotus89898/Tulip](https://github.com/Blacklotus89898/Tulip)
(read ADR 0001–0003 first).

## Overview

| Field | Value |
|---|---|
| Namespace | `tulip` |
| URL | `https://tulip.lab.home` (`/health`, `/metrics`, `POST /mcp`) |
| Direct NodePort | `http://192.168.0.108:30995` (debugging only) |
| Mode | `paper`, or `copilot` — read-only Questrade, you place every order (ADR 0003) |
| Storage | PVC `tulip-data` 1Gi, append-only SQLite journal at `/data/tulip.db` |
| Rollout | `Recreate` — single SQLite writer, so a deploy means a short outage |

## The one rule

The MCP/API token (`tulip-api-token`) can read the journal, propose, decline and
arm the kill switch. It can **not** approve an order: approval is a
human-channel action, single-use and bound to the exact proposal (Tulip
ADR 0002 §3). Never add an approve tool to the MCP surface.

## Approving (the operator only)

1. On **your own machine**, make the passphrase hash (12+ characters; only the
   hash ever reaches the cluster):
   ```bash
   cd Tulip && go run . hash-passphrase
   ```
2. Seal it and commit `services/tulip/sealed-approval.yaml`:
   ```bash
   kubectl create secret generic tulip-approval -n tulip \
     --from-literal=TULIP_APPROVAL_PASSPHRASE_HASH='<the printed pbkdf2-sha256$… line>' \
     --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller \
     --controller-namespace sealed-secrets --format yaml > services/tulip/sealed-approval.yaml
   ```
   Then restart Tulip (`kubectl -n tulip rollout restart deploy/tulip`) — it
   reads the hash at startup. Until then approvals are disabled.
3. Subscribe to ntfy topic **`tulip-approvals`** on your phone. Each suggestion
   links to `http://192.168.0.108:30995/approve/<id>`: check the terms, type the
   passphrase, Approve (or Decline). Approvals only execute during TSX hours.
4. Kill switch: Claude Code can arm it; only you disarm it, at `/killswitch`.

Agents never read `tulip-approval`, never call `/approve` or `/killswitch`
(Homelab `CLAUDE.md`).

## Co-pilot mode (Questrade, real account)

Questrade's API is read-only for retail clients: Tulip reads **one** account
(cash, equity, holdings, executions), sizes suggestions from it, and **you
place every order yourself** in the Questrade app. Executions are reconciled
automatically (every 3 min, open → close + 1h): an order matching a suggestion
(same symbol + side, same day) is recorded as acted on with its slippage;
anything else is a manual trade, excluded from the strategy's record.

**Set it up (you, once):**

1. Ideally open a **small dedicated account** for Tulip — it reads only the
   account number you give it.
2. Questrade web → your name (top right) → **API centre** → **Activate API**,
   accept the agreement.
3. **Register a personal app**: any name; scope **Account data** only (no
   trading scope exists for retail anyway).
4. On the app, **Generate new token** → copy the manual-authorization token.
   It's single-use and dies if unused for ~7 days — seal it right away.
5. Seal both values (no token in your shell history — `read -s`):
   ```bash
   read -s -p "Questrade token: " QT; echo
   read -p "Account number: " QA
   kubectl create secret generic tulip-questrade -n tulip \
     --from-literal=QUESTRADE_REFRESH_TOKEN="$QT" --from-literal=TULIP_QUESTRADE_ACCOUNT="$QA" \
     --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller \
     --controller-namespace sealed-secrets --format yaml > services/tulip/sealed-questrade.yaml
   unset QT QA
   git add services/tulip/sealed-questrade.yaml && git commit -m "feat(tulip): seal Questrade co-pilot token" && git push
   ```
6. Tell Claude Code your account size; it sets Thorn's caps
   (`TULIP_THORN_MAX_ORDER_VALUE`, `TULIP_THORN_DAILY_LOSS_CAP`,
   `TULIP_THORN_MAX_POSITION_WEIGHT`) and flips `-mode paper` → `-mode copilot`.

**Day to day:** ntfy pages you → the page says *place BUY 3 XIU.TO, limit near
53.90, before the close* → you do it in Questrade (or Decline). Claude's review
is on the same page.

**Token health:** `tulip_broker_auth_ok` (1 ok, 0 failing) and the
`TulipBrokerAuthFailing` alert. If it fires, generate a new token (step 4) and
re-seal (step 5) — Tulip notices the new sealed value and re-bootstraps.
**Never use the token anywhere else** (scripts, other apps, an agent): one
refresh elsewhere spends it and breaks Tulip's chain. Agents never read
`tulip-questrade` (Homelab `CLAUDE.md`).

## Claude Code

```bash
claude mcp add --transport http tulip https://tulip.lab.home/mcp \
  --header "Authorization: Bearer $(kubectl -n tulip get secret tulip-api-token \
    -o jsonpath='{.data.TULIP_API_TOKEN}' | base64 -d)" --scope user
claude mcp get tulip   # Status: Connected
```

Tools: `tulip_status`, `journal_list`, `portfolio`, `suggestions_pending`, `propose`, `review_suggestion`, `decline`, `kill_switch_arm`, `cycle_run`, and the read-only `broker_account`, `rebalance_preview` and `scorecard`. None approves, executes or disarms.

## Strategy comparison (Tulip ADR 0004)

- **Justifications.** Every suggestion carries one (Tulip refuses a suggestion without). The review page shows:
  - the rule with its numbers;
  - what the order does to the book;
  - for a sell, the estimated realized gain or loss, since it's taxable in the cash account.
- **Shadow books.** Five pre-registered candidates each trade an unapproved 10k paper book on the live monthly schedule: trend-filter-200 (live), equal-weight, trend-ensemble, dual-momentum-12m and inverse-vol-60. Their trades are recorded only, never placed.
- **Scorecard.** Ask Claude Code for the `scorecard`. It compares every book from the common start (the first shadow rebalance): return, max drawdown, trades, sells, fees and realized P&L, plus what each candidate would hold today and why.
- **Promotion.** At least 12 months of shadow data, plus the backtest holdout, robustness and an after-tax check (sell count). The operator decides by changing `TULIP_STRATEGY` here; Tulip never switches by itself.

## Operations

```bash
kubectl -n tulip get pods
kubectl -n tulip logs deploy/tulip --tail=50
curl -s https://tulip.lab.home/health
```

Upgrade: push to the Tulip repo → its CI builds `ghcr.io/blacklotus89898/tulip:<sha>`
→ bump the tag in `services/tulip/deployment.yaml` → ArgoCD rolls it.

Rotate the API token: re-seal `services/tulip/sealed-api-token.yaml`
(`kubectl create secret generic tulip-api-token -n tulip --from-literal=TULIP_API_TOKEN=<new> --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller --controller-namespace sealed-secrets --format yaml`),
then re-run the `claude mcp add` above.
