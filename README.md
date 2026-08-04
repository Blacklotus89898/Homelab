# Homelab

GitOps-managed homelab on k3s using ArgoCD app-of-apps, Istio ambient mesh, OpenObserve, OTel, and Backstage.

## Cluster

| Node | Role | IP |
|---|---|---|
| debian | control-plane (SchedulingDisabled) | 192.168.0.108 |
| k3s-worker-01 | worker | 192.168.0.x |

- k3s v1.34.5+k3s1
- StorageClass: `local-path`
- CNI binary path: `/var/lib/rancher/k3s/data/cni` (not `/opt/cni/bin`)
- CNI config path: `/var/lib/rancher/k3s/agent/etc/cni/net.d`

## Service URLs

| Service | URL | Notes |
|---|---|---|
| ArgoCD | http://192.168.0.108:31991 | admin / see argocd secret |
| Backstage | http://192.168.0.108:30900 | GitHub OAuth |
| OpenObserve | http://192.168.0.108:30500 | admin@homelab.local / admin |
| Jenkins | http://192.168.0.108:30808 | ns: jenkins; JCasC auto-configured |
| Kavita | http://192.168.0.108:30050 | ns: kavita; hostPath /mnt/smb_storage (VirtioFS) |
| Linkding | http://192.168.0.108:30090 | ns: linkding; data in PVC linkding-pvc |
| Audiobookshelf | http://192.168.0.108:30030 | ns: audiobookshelf |
| Authentik | – | existing service (not yet GitOps-managed) |

## Bootstrap (one-time, manual)

> Everything after this is `git push` → ArgoCD auto-sync.

### 1. Add Helm repos

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add jetstack https://charts.jetstack.io
helm repo add istio https://istio-release.storage.googleapis.com/charts
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo add backstage https://backstage.github.io/charts
helm repo update
```

### 2. Install ArgoCD via Helm

```bash
helm install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --version 10.2.1 \
  -f apps/argocd/values.yaml
```

### 3. Add this repo as an ArgoCD source

```bash
argocd repo add git@github.com:Blacklotus89898/Homelab.git \
  --ssh-private-key-path ~/.ssh/id_ed25519
```

### 4. Apply the root app-of-apps

```bash
kubectl apply -f bootstrap/root-app.yaml
```

ArgoCD will now reconcile everything in `apps/` automatically.

### 5. Access ArgoCD UI

k3s 1.34 has a port-forward bug — use NodePort instead:

```bash
# Get the NodePort (should be 30080 after ArgoCD self-manages)
kubectl get svc -n argocd argocd-server
# Access at http://192.168.0.108:30080
# Login: admin / $(kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath='{.data.password}' | base64 -d)
```

### 6. ArgoCD CLI login

```bash
argocd login 192.168.0.108:31991 --username admin --password <password> --insecure
```

### 7. Register ARC OCI Helm repo in ArgoCD (one-time, for self-hosted runners)

The `actions-runner-controller` charts are OCI-only — ArgoCD needs the registry added before it can sync the `arc-controller` and `arc-runners` apps:

```bash
argocd repo add ghcr.io/actions/actions-runner-controller-charts \
  --type helm --name arc-charts --enable-oci
```

Then seal the GitHub PAT secret and push it (see **Self-hosted runners** section below).

---

## Directory layout

```
bootstrap/          # Manual one-time apply — root app-of-apps
apps/               # ArgoCD Application manifests (one subdir per service)
  argocd/           # Self-managing ArgoCD
  cert-manager/
  sealed-secrets/
  istio/
  istio-gateway/
  otel-operator/
  openobserve/
  backstage/
  backstage-k8s-rbac/  # Backstage RBAC + sealed secrets (ArgoCD token, Jenkins token)
  platform-observability/
  pod-cleanup/      # CronJob to prune completed/failed pods every 15 min
  arc-controller/
  arc-runners-infra/
  arc-runners/
  audiobookshelf/
  jenkins-infra/    # Jenkins namespace LimitRange
  jenkins/          # Jenkins Helm chart (multi-source with git values)
  kavita/
  linkding/
services/           # Plain Kubernetes manifests for non-Helm services
  audiobookshelf/   # Deployment + Service (NodePort 30030)
  kavita/           # Deployment + Service (hostPath /mnt/smb_storage)
  linkding/         # Deployment + Service + PVC (data preserved via linkding-pvc)
infrastructure/     # Raw Kubernetes manifests
  namespaces/       # All namespaces (with Istio ambient labels)
  gateway-api/      # Gateway API CRDs (remote kustomize)
  openobserve/      # StatefulSet, Service, Secret
  jenkins/          # LimitRange for jenkins namespace
  pod-cleanup/      # CronJob + RBAC
  arc-runners/      # SealedSecret + LimitRange
  backstage-k8s-rbac/  # RBAC + SealedSecrets for Backstage integrations
platform/           # Shared platform config
  observability/    # OTel collector CR
catalog/            # Backstage software catalog entities
  all.yaml          # Root location (loaded by Backstage)
  homelab-system.yaml
  components/       # One file per service
```

---

## Sync wave order

| Wave | What |
|---|---|
| -10 | ArgoCD self-management |
| -5  | Namespaces |
| -4  | Sealed Secrets, cert-manager, Gateway API CRDs |
| -3  | Istio (ambient umbrella chart) |
| -2  | OTel operator, Istio ingress gateway, ARC controller |
| -1  | OpenObserve, ARC runner infra (SealedSecret), pod-cleanup |
|  0  | OTel collector, platform observability, ARC runner scale set, backstage-k8s-rbac, audiobookshelf, jenkins-infra, kavita, linkding |
|  1  | Backstage, Jenkins |

---

## Istio ambient — k3s specific fixes

The default Istio values do not work on k3s. Required overrides in `apps/istio/values.yaml`:

```yaml
cni:
  cniConfDir: /var/lib/rancher/k3s/agent/etc/cni/net.d
  cniBinDir: /var/lib/rancher/k3s/data/cni
```

**If pods get stuck in `FailedCreatePodSandBox`:** the Istio CNI binary is missing from the k3s path. Fix manually on each node:

```bash
cp /opt/cni/bin/istio-cni /var/lib/rancher/k3s/data/cni/
ssh k3s-worker-01 "sudo cp /opt/cni/bin/istio-cni /var/lib/rancher/k3s/data/cni/"
```

**Namespaces enrolled in the ambient mesh** (see `infrastructure/namespaces/namespaces.yaml`):
- `monitoring` — OTel collector
- `openobserve`
- `homelab`

**Namespaces NOT in the mesh (intentional):**
- `backstage` — NodePort access requires plain HTTP; ambient intercepts and drops unencrypted traffic

---

## OpenObserve

- Deployed as plain StatefulSet (not Helm chart) — the Helm chart requires CloudNativePG in cluster mode and does not support SQLite single-node mode
- Single-node SQLite mode (`ZO_META_STORE=sqlite`)
- 20Gi PVC, 30-day auto-compaction
- Credentials in `infrastructure/openobserve/secret.yaml` (plain secret — seal with kubeseal before making repo public)
- Auth for OTel collector: `base64("admin@homelab.local:admin")` = `YWRtaW5AaG9tZWxhYi5sb2NhbDphZG1pbg==`

To update the OTel auth token after a password change:
```bash
echo -n "admin@homelab.local:NEWPASSWORD" | base64
# Update OO_AUTH value in platform/observability/otel-collector.yaml
```

---

## Backstage

- Helm chart: `backstage/backstage` v2.8.2
- Backstage platform: `1.53.0` (new declarative frontend system)
- Custom image built via CI: `ghcr.io/blacklotus89898/backstage:latest`
- CSP fix required for plain HTTP: `backend.csp.upgrade-insecure-requests: false`
- Auth: **GitHub OAuth only** — guest provider removed
- Software catalog loaded from `catalog/all.yaml` + GitHub org auto-discovery (every 30 min)

### Installed plugins

| Plugin | Purpose | Status |
|---|---|---|
| `@backstage/plugin-kubernetes` | k3s cluster pod/resource view per entity | ✅ |
| `@backstage/plugin-home` | Home page at `/home` | ✅ |
| `@backstage/plugin-techdocs` | Docs per service | ✅ |
| `@roadiehq/backstage-plugin-argo-cd` | ArgoCD sync/health tab per entity | ✅ |
| `@backstage/plugin-catalog-backend-module-github` | Auto-discover `catalog-info.yaml` from GitHub org | ✅ |
| `@backstage/plugin-notifications` + signals | Real-time notifications | ✅ |
| `@backstage/plugin-jenkins-backend` | Jenkins backend integration | ✅ |
| `@backstage/plugin-github-actions` | CI workflow runs per entity | ⏳ pending — v0.6.16 has no `/alpha` export |
| `@backstage/plugin-jenkins` | Jenkins build tab per entity | ⏳ pending — v0.9.10 has no `/alpha` export |

### ArgoCD integration

- Proxy configured at `/argocd/api` → `argocd-server.argocd.svc.cluster.local`
- Auth token stored in `backstage-argocd-token` SealedSecret (namespace: `backstage`)
- Add `argocd/app-name: <app>` annotation to any catalog entity to get the ArgoCD tab
- To regenerate the token:
  ```bash
  argocd login 192.168.0.108:31991 --username admin --password <pass> --insecure
  # Ensure apiKey capability is enabled:
  kubectl -n argocd patch configmap argocd-cm --patch '{"data":{"accounts.admin":"apiKey,login"}}'
  argocd account generate-token --account admin
  # Re-seal and commit infrastructure/backstage-k8s-rbac/sealed-argocd-token.yaml
  ```

### Upgrading Backstage

1. Update `backstage.json` version and run `yarn install`
2. Rebuild and push image via CI
3. **Must wipe PostgreSQL PVC** — Backstage runs forward-only migrations:
   ```bash
   kubectl delete pod -n backstage backstage-postgresql-0
   kubectl delete pvc data-backstage-postgresql-0 -n backstage
   ```

---

## Jenkins

- Helm chart: `jenkins/jenkins` (LTS JDK 21)
- Deployed via ArgoCD multi-source (Helm chart + git values at `apps/jenkins/values.yaml`)
- JCasC auto-configures Jenkins on first boot — no setup wizard
- Multibranch pipeline `homelab` scans this repo on all feature branches; runs `Jenkinsfile` at repo root
- Backstage backend plugin (`plugin-jenkins-backend`) connected via `http://jenkins.jenkins.svc.cluster.local:8080`; Jenkins API key stored in `backstage-jenkins` SealedSecret

### Bootstrap (one-time)

Register the Jenkins Helm repo in ArgoCD before applying apps:

```bash
argocd repo add https://charts.jenkins.io --type helm --name jenkins
```

### Rotating the Jenkins API key

1. Generate a new API token in Jenkins UI → User → Configure → API Token
2. Re-seal and commit `infrastructure/backstage-k8s-rbac/sealed-jenkins-token.yaml`:
   ```bash
   kubectl create secret generic backstage-jenkins -n backstage \
     --from-literal=JENKINS_API_KEY=<new-token> \
     --dry-run=client -o yaml \
   | kubeseal \
       --controller-name sealed-secrets-controller \
       --controller-namespace sealed-secrets \
       --format yaml \
   > infrastructure/backstage-k8s-rbac/sealed-jenkins-token.yaml
   git add infrastructure/backstage-k8s-rbac/sealed-jenkins-token.yaml
   git commit -m "chore: rotate Jenkins API key" && git push
   ```

---

## Self-hosted runners (ARC)

`actions-runner-controller` v2 (scale-set mode) runs ephemeral GitHub Actions runners inside the cluster. Runners scale to 0 when idle and up to 3 concurrent jobs. Each runner pod has a Docker-in-Docker (DinD) sidecar so `docker/build-push-action` works unchanged.

### Architecture

| Component | Namespace | What it does |
|---|---|---|
| `arc-controller` (Helm) | `arc-systems` | Operator managing the scale set lifecycle |
| Listener pod | `arc-systems` | Long-polls GitHub API; triggers runner pod creation on job demand |
| `arc-runners` (Helm) | `arc-runners` | `AutoscalingRunnerSet` CR — defines the `homelab-runner` scale set |
| `arc-runners-infra` (kustomize) | `arc-runners` | SealedSecret + LimitRange |
| Runner pods | `arc-runners` | Ephemeral; one per job, gone when done |

**Known ArgoCD quirk:** `arc-controller` shows 4 CRDs as `OutOfSync`. Cosmetic only — cluster-scoped CRDs appear twice in ArgoCD's diff. Everything works correctly.

### Setup (one-time after bootstrap step 7)

1. **Register the ARC OCI Helm repo** in ArgoCD:
   ```bash
   argocd repo add ghcr.io/actions/actions-runner-controller-charts \
     --type helm --name arc-charts --enable-oci
   ```

2. **Seal the GitHub PAT** — create a PAT at github.com/settings/tokens with `repo` scope:
   ```bash
   kubectl create secret generic arc-runner-secret \
     --namespace arc-runners \
     --from-literal=github_token=<YOUR_PAT> \
     --dry-run=client -o yaml \
   | kubeseal \
       --controller-name sealed-secrets-controller \
       --controller-namespace sealed-secrets \
       --format yaml \
   > infrastructure/arc-runners/sealed-github-pat.yaml
   git add infrastructure/arc-runners/sealed-github-pat.yaml
   git commit -m "chore: seal ARC GitHub PAT" && git push
   ```

3. **ArgoCD syncs** `arc-controller` (wave -2) → `arc-runners-infra` (wave -1) → `arc-runners` (wave 0). Verify:
   ```bash
   argocd app list | grep arc
   kubectl get pods -n arc-systems   # listener pod should be Running
   ```

4. **Confirm registration** — GitHub → repo → Settings → Actions → Runners → "Scale sets" shows `homelab-runner`.

5. **Switch workflows** — set `runs-on: homelab-runner` in the target workflow and push.

### Runner label

`homelab-runner` — set via `runnerScaleSetName` in `apps/arc-runners/values.yaml`.

### Diagnosing a hanging job

A job is hung if it stays "Waiting for a runner…" for more than ~60 seconds.

```bash
# 1. Is the listener pod alive?
kubectl get pods -n arc-systems
kubectl logs -n arc-systems \
  -l app.kubernetes.io/component=runner-scale-set-listener --tail=20

# 2. Did a runner pod spawn?
kubectl get pods -n arc-runners -w

# 3. Pod exists but Pending — check scheduling
kubectl describe pod <runner-pod> -n arc-runners

# 4. Pod Running but job stuck — check DinD sidecar
kubectl logs <runner-pod> -n arc-runners -c dind
kubectl logs <runner-pod> -n arc-runners -c runner

# 5. Controller errors
kubectl logs -n arc-systems \
  deployment/arc-controller-gha-rs-controller --tail=50
```

| Symptom | Likely cause |
|---|---|
| No runner pod after 60 s | Listener pod crashed — check listener logs |
| Pod stuck `Pending` | Node resource pressure — check `kubectl describe node` |
| Pod running, Docker step hangs | DinD not ready — check `-c dind` logs |
| Job queued but 0 runners in GitHub | PAT expired — re-seal with a new token |

### Rotating the GitHub PAT

```bash
kubectl create secret generic arc-runner-secret \
  --namespace arc-runners \
  --from-literal=github_token=<NEW_PAT> \
  --dry-run=client -o yaml \
| kubeseal \
    --controller-name sealed-secrets-controller \
    --controller-namespace sealed-secrets \
    --format yaml \
> infrastructure/arc-runners/sealed-github-pat.yaml
git add infrastructure/arc-runners/sealed-github-pat.yaml
git commit -m "chore: rotate ARC GitHub PAT" && git push
```

---

## Releases and changelog

This repo uses [release-please](https://github.com/googleapis/release-please) for automated changelog generation and GitHub Releases.

**Commit convention** — use these prefixes for commits that should appear in the changelog:

| Prefix | Changelog section | Version bump |
|---|---|---|
| `feat: …` | Features | minor |
| `fix: …` | Bug Fixes | patch |
| `chore: …` | Chores | patch |
| `docs: …` | Documentation | patch |
| `ci: …` | CI / CD | patch |
| `feat!: …` or `BREAKING CHANGE:` | Breaking Changes | major |

When commits land on `main`, the `release.yml` workflow opens a "Release PR" that bundles them into the next version with an updated `CHANGELOG.md`. Merge the PR to cut the release and create the GitHub Release.

---

## Sealed Secrets

Controller runs in `sealed-secrets` namespace. To seal a secret:

```bash
# Install kubeseal CLI (match controller version)
curl -sL https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.27.3/kubeseal-0.27.3-linux-amd64.tar.gz \
  | tar -xz kubeseal && sudo mv kubeseal /usr/local/bin/

# Seal a secret (controller runs in sealed-secrets namespace)
kubectl create secret generic my-secret -n my-namespace \
  --from-literal=key=value \
  --dry-run=client -o yaml \
  | kubeseal \
    --controller-name sealed-secrets-controller \
    --controller-namespace sealed-secrets \
    --format yaml \
  > infrastructure/my-service/sealed-secret.yaml
```

**TODO:** Seal `infrastructure/openobserve/secret.yaml` and `platform/observability/otel-collector.yaml` (OO_AUTH) before making this repo public.

---

## Known issues / workarounds

| Issue | Workaround |
|---|---|
| k3s 1.34 port-forward dies | Use NodePort services instead |
| ArgoCD CLI needs `--insecure` | `argocd login <ip>:<port> --insecure` (TLS not yet configured) |
| Istio CNI binary not in k3s path | Copy binary manually; fixed in `cniBinDir` values |
| OpenObserve Helm chart requires CloudNativePG | Use plain StatefulSet with `ZO_META_STORE=sqlite` |
| Backstage `upgrade-insecure-requests` CSP | Disabled in `backend.csp` config (required for plain HTTP NodePort) |
| NodePort conflicts | Check `kubectl get svc -A` before assigning; authentik uses 30080, linkding uses 30090, ArgoCD uses 31991 |
| Kavita sees empty /mnt/smb_storage after VM restart | VirtioFS mount drops on reboot — add to /etc/fstab on k3s-worker-01: `smb_storage /mnt/smb_storage virtiofs defaults 0 0` |

---

## Adding a new service

1. Create `apps/<service>/application.yaml` (ArgoCD Application)
2. Create `apps/<service>/values.yaml` if using Helm
3. Add namespace to `infrastructure/namespaces/namespaces.yaml`
4. Add `services/<service>/limitrange.yaml` to cap container resources in the namespace
5. Add `catalog-info.yaml` to the service repo (auto-discovered by Backstage) or add a manual entry to `catalog/components/<service>.yaml` and register in `catalog/all.yaml`
6. `git push` — ArgoCD auto-deploys

## Enrolling a service in the Istio ambient mesh

Add the label to its namespace in `infrastructure/namespaces/namespaces.yaml`:

```yaml
metadata:
  labels:
    istio.io/dataplane-mode: ambient
```

Note: services accessed via plain HTTP NodePort (like Backstage) must NOT be enrolled.
