# linkding

Self-hosted bookmark manager.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `1.46.2@sha256:0c0a9a04...` - pinned to running digest 2026-09-29; Renovate PRs the bumps |
| SLO | yes | Blackbox probe on :30090 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/linkding/`, Application `linkding`; bookmarks PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `linkding` |
| Image | `sissbruecker/linkding:1.46.2@sha256:0c0a9a04...` |
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
