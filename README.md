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
| Kavita | http://192.168.0.108:30050 | ns: kavita; hostPath /mnt/smb_storage (VirtioFS) |
| Linkding | http://192.168.0.108:30090 | ns: linkding; data in PVC linkding-pvc |
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
  platform-observability/
  kavita/
  linkding/
services/           # Plain Kubernetes manifests for non-Helm services
  kavita/           # Deployment + Service (hostPath /mnt/smb_storage)
  linkding/         # Deployment + Service + PVC (data preserved via linkding-pvc)
infrastructure/     # Raw Kubernetes manifests
  namespaces/       # All namespaces (with Istio ambient labels)
  gateway-api/      # Gateway API CRDs (remote kustomize)
  openobserve/      # StatefulSet, Service, Secret
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
| -2  | OTel operator, Istio ingress gateway |
| -1  | OpenObserve |
|  0  | OTel collector, platform observability |
|  1  | Backstage |

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

| Plugin | Purpose |
|---|---|
| `@backstage/plugin-kubernetes` | k3s cluster pod/resource view per entity |
| `@backstage/plugin-github-actions` | CI workflow runs per entity |
| `@backstage/plugin-home` | Home page at `/home` |
| `@backstage/plugin-techdocs` | Docs per service |
| `@roadiehq/backstage-plugin-argo-cd` | ArgoCD sync status tab per entity |
| `@backstage/plugin-catalog-backend-module-github` | Auto-discover `catalog-info.yaml` from GitHub org |
| `@backstage/plugin-notifications` + signals | Real-time notifications |

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
| NodePort conflicts (30080 authentik, 30090 linkding) | Check `kubectl get svc -A` before assigning NodePorts |
| Kavita sees empty /mnt/smb_storage after VM restart | VirtioFS mount drops on reboot — add to /etc/fstab on k3s-worker-01: `smb_storage /mnt/smb_storage virtiofs defaults 0 0` |

---

## Adding a new service

1. Create `apps/<service>/application.yaml` (ArgoCD Application)
2. Create `apps/<service>/values.yaml` if using Helm
3. Add namespace to `infrastructure/namespaces/namespaces.yaml`
4. Add catalog entry to `catalog/components/<service>.yaml` and register in `catalog/all.yaml`
5. `git push` — ArgoCD auto-deploys

## Enrolling a service in the Istio ambient mesh

Add the label to its namespace in `infrastructure/namespaces/namespaces.yaml`:

```yaml
metadata:
  labels:
    istio.io/dataplane-mode: ambient
```

Note: services accessed via plain HTTP NodePort (like Backstage) must NOT be enrolled.
