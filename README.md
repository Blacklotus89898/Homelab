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
| ArgoCD | http://192.168.0.108:30080 | admin / see argocd secret |
| Backstage | http://192.168.0.108:30900 | guest login |
| OpenObserve | http://192.168.0.108:30500 | admin@homelab.local / admin |
| Kavita | http://192.168.0.108:30050 | manga/comic reader; hostPath /mnt/smb_storage |
| Linkding | http://192.168.0.108:30090 | bookmark manager; data in PVC linkding-pvc |
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
argocd login 192.168.0.108:30080 --username admin --password <password> --plaintext
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
- **Image pinned to `1.28.0`** — do NOT use `latest` or versions >= 1.40.0
- `latest` resolves to pre-release `1.54.0-next.0`
- Versions 1.40+ use the new frontend system which crashes with `NotImplementedError: No implementation available for apiRef{plugin.notifications.service}`
- CSP fix required for plain HTTP: `backend.csp.upgrade-insecure-requests: false`
- Guest auth: `auth.providers.guest.dangerouslyAllowOutsideDevelopment: true`
- Software catalog loaded from `catalog/all.yaml` via raw.githubusercontent.com

**Upgrading Backstage:**
1. Pin to a new stable version (check https://github.com/backstage/backstage/pkgs/container/backstage)
2. Test for notifications crash before deploying
3. **Must wipe PostgreSQL PVC** — Backstage runs forward-only migrations and older versions reject a newer schema:
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

# Seal a secret
kubectl create secret generic my-secret -n my-namespace \
  --from-literal=key=value \
  --dry-run=client -o yaml | kubeseal -o yaml > infrastructure/my-service/sealed-secret.yaml
```

**TODO:** Seal `infrastructure/openobserve/secret.yaml` before making this repo public.

---

## Known issues / workarounds

| Issue | Workaround |
|---|---|
| k3s 1.34 port-forward dies | Use NodePort services instead |
| ArgoCD CLI needs `--plaintext` | `argocd login <ip>:<port> --plaintext` |
| Istio CNI binary not in k3s path | Copy binary manually; fixed in `cniBinDir` values |
| OpenObserve Helm chart requires CloudNativePG | Use plain StatefulSet with `ZO_META_STORE=sqlite` |
| Backstage 1.40+ notifications crash | Pin image to 1.28.0 until fix lands in stable |
| Backstage `upgrade-insecure-requests` CSP | Disabled in `backend.csp` config |
| NodePort conflicts (30080 authentik, 30090 linkding) | Check `kubectl get svc -A` before assigning NodePorts |

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
