# linkding

Self-hosted bookmark manager.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `1.47.0@sha256:e35cb50e...` - promoted after staging rehearsal 2026-10-14; Renovate PRs the bumps |
| SLO | yes | Blackbox probe on :30090 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/linkding/`, Application `linkding`; bookmarks PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `linkding` |
| Image | `sissbruecker/linkding:1.47.0@sha256:e35cb50e...` |
| URL | http://192.168.0.108:30090 |

## Operations

### Restart

```bash
kubectl rollout restart deployment/linkding -n linkding
```

### Logs

```bash
kubectl logs -n linkding deployment/linkding -f
```

### Scale down / up

```bash
kubectl scale deployment/linkding -n linkding --replicas=0
kubectl scale deployment/linkding -n linkding --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `linkding`. To force a sync:

```bash
argocd app sync linkding
```
