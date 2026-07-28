# kavita

Self-hosted manga and comic reader

## Overview

| Field | Value |
|---|---|
| Namespace | `kavita` |
| Image | `jvmilazz0/kavita:latest` |
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
