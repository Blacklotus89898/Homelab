# my-app

homelab test

## Overview

| Field | Value |
|---|---|
| Namespace | `test` |
| Image | `nginx:latest` |
| URL | http://192.168.0.108:31000 |

## Operations

### Restart

```bash
kubectl rollout restart deployment/my-app -n test
```

### Logs

```bash
kubectl logs -n test deployment/my-app -f
```

### Scale down / up

```bash
kubectl scale deployment/my-app -n test --replicas=0
kubectl scale deployment/my-app -n test --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `my-app`. To force a sync:

```bash
argocd app sync my-app
```
