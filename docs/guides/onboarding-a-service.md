# Onboarding a service to the platform (and wiring it to Claude Code)

The checklist, written from onboarding **Tulip** (2026-10-24, Homelab PR #9). Every
"trap" below actually happened. Follow the steps in order; each has a check.

## 0. The shape of a service

A service repo (e.g. `github.com/Blacklotus89898/Tulip`) owns its code, ADRs and
image build. The **Homelab repo** owns how it runs: ArgoCD Application, manifests,
secrets, route, monitoring, catalog entry. Nothing is applied by hand — git →
ArgoCD.

| Lives in the service repo | Lives in Homelab |
|---|---|
| code, tests, `Dockerfile`, CI, ADRs | `apps/<name>/application.yaml` (ArgoCD) |
| `.github/workflows/build-image.yaml` → `ghcr.io/…/<name>:<sha>` | `services/<name>/` (deployment, service, PVC, SealedSecrets, scrape) |
| (optional) `.petal/pipelines/` for Petal | `platform/gateways/routes.yaml` (`<name>.lab.home`) |
| | `catalog/components/<name>.yaml` + TechDocs |

## 1. Make the service platform-ready (service repo)

- [ ] **A health endpoint** that returns 200 without auth (`/health`). Probes use it.
- [ ] **`/metrics`** in Prometheus text format if it has anything to count.
- [ ] **Config by flags/env, secrets by env only** — never in the repo (public).
- [ ] **Dockerfile:** static binary on distroless; prefer `:nonroot` (then the
      deployment needs `fsGroup` for any volume). Stamp the version at build time.
- [ ] **Image CI** pushing `ghcr.io/blacklotus89898/<name>:<commit-sha>` — SHA tags
      only (Kyverno rejects `:latest`, and deploys pin a SHA).
- [ ] **Git remote over SSH** (`git@github.com:…`) — the HTTPS remote had no
      credential helper and the first push failed. (Or `gh auth login`.)

**Check:** the image workflow is green, and the image pulls anonymously:
```bash
T=$(curl -s "https://ghcr.io/token?scope=repository:blacklotus89898/<name>:pull" | jq -r .token)
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $T" \
  -H 'Accept: application/vnd.oci.image.index.v1+json,application/vnd.oci.image.manifest.v1+json' \
  https://ghcr.io/v2/blacklotus89898/<name>/manifests/<sha>      # 200 = public
```
**Trap:** a new GHCR package can be **private** → `ImagePullBackOff`. Fix once in
GitHub → Packages → `<name>` → Package settings → visibility. (Tulip's, linked to a
public repo, came up public.)

## 2. Generate the Homelab side with the golden path

Backstage → **Create** → **New Homelab Service**: name, namespace (= name),
pinned image (`…:<sha>`), container port, **health path**, a free NodePort.
It opens a PR with the ArgoCD app, deployment, service, catalog entry and
TechDocs.

- Free NodePorts: `grep -rhoE 'nodePort: *[0-9]+' apps services infrastructure environments | sort -u`
- Scripted (no browser): `POST /api/scaffolder/v2/tasks` with the `automation`
  token — see `tools/petal-e2e/run.sh` for the call shape.

**Traps fixed in the template while onboarding Tulip:**
- probes were hard-coded to `/` → a service with `/health` would crash-loop
  (now the `healthPath` parameter);
- a description containing `: ` produced invalid YAML in the catalog and mkdocs
  files (now rendered with `| dump`).

## 3. Add what the template can't know (on the same PR branch)

```bash
git fetch origin add-service-<name> && git checkout -b add-service-<name> origin/add-service-<name>
```

- [ ] **Namespace** in `infrastructure/namespaces/namespaces.yaml` (wave -5, house
      convention; the app's `CreateNamespace=true` is only a fallback).
- [ ] **Rollout strategy:** `Recreate` for a single-writer store (SQLite).
- [ ] **Storage:** `pvc.yaml`, smallest that works (`local-path`; worker disk is
      the #1 constraint).
- [ ] **Security context:** `runAsNonRoot`, `fsGroup` matching the image user,
      `readOnlyRootFilesystem`, drop all capabilities.
- [ ] **Secrets as SealedSecrets** (never printed, never committed in clear):
      ```bash
      kubectl create secret generic <name>-api-token -n <name> \
        --from-literal=TOKEN="$(python -c 'import secrets;print(secrets.token_urlsafe(32))')" \
        --dry-run=client -o yaml \
      | kubeseal --controller-name sealed-secrets-controller \
          --controller-namespace sealed-secrets --format yaml \
      > services/<name>/sealed-api-token.yaml
      ```
      **Trap:** a SealedSecret is only recoverable on a rebuild if the
      sealed-secrets keyring backup contains the key it was sealed with — re-export
      the keyring after each 30-day rotation (`docs/bootstrap.md` step 4).
- [ ] **Named service port** (`name: http`) — scrapes and routes refer to it.
- [ ] **Route** `<name>.lab.home` in `platform/gateways/routes.yaml`:
      `sectionName: https` and **`sync-wave: "5"`** (a route created before its
      Gateway deadlocks the sync — learned the hard way, ADR 0009).
- [ ] **Metrics:** `services/<name>/observability.yaml` with a `VMServiceScrape`
      (vmagent picks up any namespace). Alerts as `VMRule` once there's something
      to page on — and give every schedule a "didn't run" alert.
- [ ] **App:** `prune: true` (house standard).
- [ ] **Catalog + TechDocs:** real links (`https://<name>.lab.home`), ops notes.

**Check before pushing** (CI runs the same — a yamllint slip broke CI for hours once):
```bash
git show HEAD:.yamllint > /tmp/yl && for f in $(git diff --name-only main -- '*.yaml' '*.yml'); do
  python -m yamllint -c /tmp/yl -f parsable "$f"; done
```

## 4. Merge → ArgoCD deploys

PR checks (`Validate PR`: yamllint, kubeconform, Kyverno — resources, probes,
pinned images — NodePort conflicts, strict TechDocs) must be green. Merge;
the root app-of-apps picks up `apps/<name>/` and syncs.

**Check:**
```bash
kubectl -n argocd get app <name>          # Synced / Healthy
kubectl -n <name> get pods,pvc            # Running, Bound
curl -s https://<name>.lab.home/health    # 200 through the gateway + lab CA
```

## 5. Wire it to Claude Code (MCP)

If the service exposes MCP over streamable HTTP (`POST /mcp`, bearer token):

```bash
claude mcp add --transport http <name> https://<name>.lab.home/mcp --scope user \
  --header "Authorization: Bearer $(kubectl -n <name> get secret <name>-api-token \
     -o jsonpath='{.data.TULIP_API_TOKEN}' | base64 -d)"
claude mcp get <name>                     # Status: ✔ Connected
```

The token ends up in your user-scope Claude Code config (local only). Give the
MCP credential **only the powers you'd hand an assistant** — for Tulip it can
read, propose, decline and arm the kill switch, but never approve an order
(Tulip ADR 0002 §3).

**The lab CA:** with the root CA in the Windows user store (`docs/bootstrap.md`
ledger), Claude Code connected to `https://tulip.lab.home/mcp` directly — no extra
setup (verified 2026-10-24). New MCP servers load in the **next** Claude Code
session. Fallback if a machine reports a certificate error (Node on its own does not
read the Windows store — uptime-kuma needed this): point Node at the CA file:
```bash
kubectl -n cert-manager get secret lab-root-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > ~/lab-root-ca.crt
setx NODE_EXTRA_CA_CERTS "%USERPROFILE%\lab-root-ca.crt"   # Windows; new shells pick it up
```

## 6. After go-live

- [ ] uptime-kuma: add `<name>.lab.home` to `tools/uptime-kuma/monitors.yaml`, re-run the provisioner.
- [ ] Glance: add the site to `hosts/glance/glance.yml` and copy it to the LXC.
- [ ] Roadmap decision-log row; KB entry for anything surprising.
