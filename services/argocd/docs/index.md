# argocd

GitOps continuous delivery - every workload in this cluster is reconciled from this repo by ArgoCD.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | chart | `argo-cd` Helm chart pinned to `10.2.1` (`apps/argocd/application.yaml`); chart version bump = upgrade path |
| SLO | yes | Blackbox probe on the server endpoint (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | App-of-apps: `bootstrap/root-app.yaml` -> `apps/argocd` re-converges ArgoCD itself |

## Overview

| Field | Value |
|---|---|
| Namespace | `argocd` |
| Image | chart-managed (`argo-cd:10.2.1`) |
| URL | http://192.168.0.108:31991 (http) / https://192.168.0.108:30443 (https) |

## Operations

```bash
kubectl -n argocd rollout restart deployment/argocd-server
kubectl -n argocd logs deployment/argocd-server --tail=100
kubectl -n argocd get applications   # sync status of everything
```
