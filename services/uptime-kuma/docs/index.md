# uptime-kuma

Uptime monitoring UI. Monitors and the ntfy provider are configured in the UI (provisioning script: `tools/uptime-kuma/provision.py`).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `louislam/uptime-kuma:2.1.2` |
| SLO | yes | `https://uptime.lab.home/` gateway probe |
| Recovery | git | Manifests in `infrastructure/uptime-kuma/`; monitor config PVC = re-run the provisioning script |

## Overview

| Field | Value |
|---|---|
| Namespace | `monitoring` |
| URL | https://uptime.lab.home/ (NodePort 30320) |
| Workload | StatefulSet `uptime-kuma`, 1Gi local-path PVC |

## Operations

### Status

```bash
kubectl -n argocd get application uptime-kuma
kubectl get -n monitoring statefulset/uptime-kuma
```

### Logs

```bash
kubectl logs -n monitoring statefulset/uptime-kuma -f
```
