# audiobookshelf

Self-hosted audiobook and podcast server

## Overview

| Field | Value |
|---|---|
| Namespace | `audiobookshelf` |
| Image | `ghcr.io/advplyr/audiobookshelf:latest` |
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
