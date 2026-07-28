# linkding

Self-hosted bookmark manager

## Overview

| Field | Value |
|---|---|
| Namespace | `linkding` |
| Image | `sissbruecker/linkding:latest` |
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
