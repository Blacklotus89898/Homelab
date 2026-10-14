# audiobookshelf

Self-hosted audiobook and podcast server.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | Digest-only pin (running image predates all current version tags); Renovate will PR the versioned upgrade (`services/audiobookshelf/deployment.yaml`) |
| SLO | no | Application Suspended by design - media server, no probe |
| Recovery | git | Manifests in `services/audiobookshelf/`, Application `audiobookshelf`; media PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `audiobookshelf` |
| Image | `ghcr.io/advplyr/audiobookshelf@sha256:180acad3...` (digest-only) |
| URL | http://192.168.0.108:30030 |

## Operations

### Restart

```bash
kubectl rollout restart deployment/audiobookshelf -n audiobookshelf
```

### Logs

```bash
kubectl logs -n audiobookshelf deployment/audiobookshelf -f
```

### Scale down / up

```bash
kubectl scale deployment/audiobookshelf -n audiobookshelf --replicas=0
kubectl scale deployment/audiobookshelf -n audiobookshelf --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `audiobookshelf`. To force a sync:

```bash
argocd app sync audiobookshelf
```
