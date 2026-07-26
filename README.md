# Homelab

GitOps-managed homelab using ArgoCD, Istio (ambient), OpenObserve, and Backstage.

## Bootstrap (one-time, manual)

> Everything after this is `git push` → ArgoCD auto-sync.

### 1. Add Helm repos and install ArgoCD via Helm

```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install argocd argo/argo-cd \
  --namespace argocd --create-namespace \
  --version 10.2.1 \
  -f apps/argocd/values.yaml
```

### 2. Add this repo as an ArgoCD repo (SSH key or HTTPS token)

```bash
# Via CLI (SSH key must already be in the agent or secret):
argocd repo add git@github.com:Blacklotus89898/Homelab.git --ssh-private-key-path ~/.ssh/id_ed25519
```

### 3. Apply the root app-of-apps

```bash
kubectl apply -f bootstrap/root-app.yaml
```

ArgoCD will now reconcile everything in `apps/` automatically.

### 4. Seal your first secret (example)

```bash
# After sealed-secrets controller is running:
kubectl create secret generic my-secret --dry-run=client \
  --from-literal=password=supersecret \
  -o yaml | kubeseal --format yaml > infrastructure/my-service/my-secret-sealed.yaml
```

## Directory layout

```
bootstrap/          # Manual bootstrap — applied once
apps/               # ArgoCD Application manifests (one subdir per service)
infrastructure/     # Kubernetes manifests for platform services
clusters/homelab/   # Cluster-wide variables
platform/           # Shared Istio Gateways, OTel CRs, policies
```

## Sync wave order

| Wave | What |
|------|------|
| -10  | ArgoCD self-management |
| -5   | Namespaces |
| -4   | Sealed Secrets, cert-manager |
| -3   | Istio (base → istiod → cni → ztunnel) |
| -2   | OTel operator, ingress gateway |
| -1   | OpenObserve |
|  0   | Your apps |
|  1   | Backstage |

## Placeholders to update

- `clusters/homelab/values.yaml` — domain, storageClass, registry
- `apps/argocd/values.yaml` — ArgoCD hostname
- Helm chart versions in each `application.yaml` — pin to specific stable versions
