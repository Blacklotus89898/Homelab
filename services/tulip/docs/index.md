# Tulip

Human-approved paper-trading agent: rules propose, Claude reviews, the operator
approves. Source and design: [github.com/Blacklotus89898/Tulip](https://github.com/Blacklotus89898/Tulip)
(read ADR 0001 and 0002 first).

## Overview

| Field | Value |
|---|---|
| Namespace | `tulip` |
| URL | `https://tulip.lab.home` (`/health`, `/metrics`, `POST /mcp`) |
| Direct NodePort | `http://192.168.0.108:30995` (debugging only) |
| Mode | `paper` — no live broker exists in v1 |
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
   kubectl create secret generic tulip-approval -n tulip      --from-literal=TULIP_APPROVAL_PASSPHRASE_HASH='<the printed pbkdf2-sha256$… line>'      --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller      --controller-namespace sealed-secrets --format yaml > services/tulip/sealed-approval.yaml
   ```
   Then restart Tulip (`kubectl -n tulip rollout restart deploy/tulip`) — it
   reads the hash at startup. Until then approvals are disabled.
3. Subscribe to ntfy topic **`tulip-approvals`** on your phone. Each suggestion
   links to `http://192.168.0.108:30995/approve/<id>`: check the terms, type the
   passphrase, Approve (or Decline). Approvals only execute during TSX hours.
4. Kill switch: Claude Code can arm it; only you disarm it, at `/killswitch`.

Agents never read `tulip-approval`, never call `/approve` or `/killswitch`
(Homelab `CLAUDE.md`).

## Claude Code

```bash
claude mcp add --transport http tulip https://tulip.lab.home/mcp \
  --header "Authorization: Bearer $(kubectl -n tulip get secret tulip-api-token \
    -o jsonpath='{.data.TULIP_API_TOKEN}' | base64 -d)" --scope user
claude mcp get tulip   # Status: Connected
```

Tools: `tulip_status`, `journal_list`, `portfolio`, `suggestions_pending`, `propose`, `decline`, `kill_switch_arm`, `cycle_run` — none approves, executes or disarms.

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
