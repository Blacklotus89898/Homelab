# kavita

Self-hosted manga and comic reader.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `0.9.1@sha256:31181a32...` - pinned to running digest 2026-09-29; Renovate PRs the bumps |
| SLO | yes | Blackbox probe on :30050 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/kavita/`, Application `kavita`; library PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `kavita` |
| Image | `jvmilazz0/kavita:0.9.1@sha256:31181a32...` |
| URL | http://192.168.0.108:30050 |

## Operations

### Restart

```bash
kubectl rollout restart deployment/kavita -n kavita
```

### Logs

```bash
kubectl logs -n kavita deployment/kavita -f
```

### Scale down / up

```bash
kubectl scale deployment/kavita -n kavita --replicas=0
kubectl scale deployment/kavita -n kavita --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `kavita`. To force a sync:

```bash
argocd app sync kavita
```
