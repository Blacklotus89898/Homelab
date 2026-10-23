# Reactivate ARC self-hosted runners (retired 2026-10-23, ADR 0010)

Actions Runner Controller gave GitHub Actions jobs a runner **inside the LAN**
(`runs-on: homelab-runner`) — the only way a workflow can reach cluster-internal or
192.168.0.x endpoints. Removed from the cluster, kept in git. Last running state: tag
`retired/jenkins-arc-2026-10-23`.

**Reactivate when** a workflow genuinely needs in-LAN execution, e.g. Petal's push
trigger (`Petal/.github/workflows/petal-trigger.yaml`, `runs-on: homelab-runner`,
dormant behind repo variable `PETAL_ENABLED`). Why it was retired: too slow on the shared
worker (DinD per runner) and unused — see ADR 0010.

## What it was

| | |
|---|---|
| Controller | chart `gha-runner-scale-set-controller` 0.10.1 (OCI `ghcr.io/actions/actions-runner-controller-charts`), release `arc-controller`, ns `arc-systems`, wave -2, 1 replica 100m/128Mi (`archive/apps/arc-controller/`) |
| Scale set | chart `gha-runner-scale-set` 0.10.1, release/scale-set name `homelab-runner`, ns `arc-runners`, repo-level `githubConfigUrl: https://github.com/Blacklotus89898/Homelab`, `minRunners: 0` / `maxRunners: 3`, `containerMode: dind`, runner 500m/512Mi → 2 CPU/4Gi (`archive/apps/arc-runners/`) |
| Credential | SealedSecret `arc-runner-secret` (ns `arc-runners`, key `github_token`) in `infrastructure/arc-runners/sealed-github-pat.yaml` — **classic PAT, scope `repo`** (validated via `X-OAuth-Scopes`; fine-grained tokens were rejected 2026-10-15) |
| Infra | LimitRange in `infrastructure/arc-runners/` (Application `archive/apps/arc-runners-infra/`) |
| Mesh | both namespaces outside ambient (controller webhook TLS vs ztunnel; DinD vs ambient) |

## Reactivate

1. **Register the OCI chart repo in ArgoCD** (one-time per ArgoCD install):
   ```bash
   argocd repo add ghcr.io/actions/actions-runner-controller-charts \
     --type helm --name arc-charts --enable-oci
   ```
2. **Namespaces** — re-add to `infrastructure/namespaces/namespaces.yaml` (wave -5):
   ```yaml
   ---
   # ARC controller — webhook TLS conflicts with ztunnel; keep outside mesh
   apiVersion: v1
   kind: Namespace
   metadata:
     name: arc-systems
   ---
   # ARC runner pods — DinD conflicts with Istio ambient; keep outside mesh
   apiVersion: v1
   kind: Namespace
   metadata:
     name: arc-runners
   ```
3. **Credential** — the archived SealedSecret is still decryptable if the keyring
   survived, but the PAT inside may have expired. Create a classic PAT (scope `repo`),
   check it, then re-seal:
   ```bash
   curl -sI -H "Authorization: token <PAT>" https://api.github.com/user | grep -i x-oauth-scopes
   kubectl create secret generic arc-runner-secret -n arc-runners \
     --from-literal=github_token=<PAT> --dry-run=client -o yaml \
   | kubeseal --controller-name sealed-secrets-controller \
       --controller-namespace sealed-secrets --format yaml \
   > infrastructure/arc-runners/sealed-github-pat.yaml
   ```
   (The heartbeat has its **own** PAT since 2026-10-23 — `heartbeat-github-pat` in ns
   `heartbeat`; don't re-couple them.)
4. **Move the Applications back** — controller first (wave -2 orders it on a fresh
   bootstrap; on a live cluster push in two commits so the CRDs exist before the scale set):
   ```bash
   git mv archive/apps/arc-controller apps/arc-controller
   git mv archive/apps/arc-runners-infra apps/arc-runners-infra
   git commit -m "feat(arc): reactivate controller" && git push
   # wait: kubectl -n arc-systems get deploy  → 1/1
   git mv archive/apps/arc-runners apps/arc-runners
   git commit -m "feat(arc): reactivate homelab-runner scale set" && git push
   ```
   Bump the chart pins (0.10.1 is from 2026-07) and pin the runner image (`apps/arc-runners/values.yaml`
   uses `ghcr.io/actions/actions-runner:latest`) before re-enabling.
5. **Revert the retirement edits:**
   - `.github/renovate.json5`: the `apps/arc-controller/**` / `apps/arc-runners*/**` rule.
   - `apps/victoria-metrics/values.yaml`: re-add the alertmanager blackhole for
     `namespace = "arc-systems"` **only if** the controller is again kept scaled down.
   - `docs/architecture.md`: the ARC subgraph/flow (see the retired tag).
6. **Verify:** listener pod Running in `arc-systems`; GitHub repo → Settings → Actions →
   Runners shows the `homelab-runner` scale set; a `workflow_dispatch` of a test workflow
   with `runs-on: homelab-runner` spins a runner pod (DinD sidecar) and completes.
