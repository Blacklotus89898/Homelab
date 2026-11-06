# ntfy

Push notification server. Publishers to topic `homelab-alerts`: vmalertmanager, ArgoCD notifications, Uptime Kuma and the heartbeat CronJob. Warden publishes to `warden`.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `binwiederhier/ntfy:v2.28.0` |
| SLO | yes | `https://ntfy.lab.home/` gateway probe |
| Recovery | git | Manifests in `infrastructure/ntfy/`; no persistent state |

## Overview

| Field | Value |
|---|---|
| Namespace | `monitoring` |
| URL | https://ntfy.lab.home/ (NodePort 30310) |
| In-cluster | http://ntfy.monitoring.svc |

## Operations

### Status

```bash
kubectl -n argocd get application ntfy
kubectl get -n monitoring deployment/ntfy
```

### Logs

```bash
kubectl logs -n monitoring deployment/ntfy -f
```
