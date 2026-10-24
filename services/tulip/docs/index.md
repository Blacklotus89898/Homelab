# tulip

Human-approved paper-trading agent: rules propose, Claude reviews, the operator approves

## Overview

| Field | Value |
|---|---|
| Namespace | `tulip` |
| Image | `ghcr.io/blacklotus89898/tulip:11d3cbadc56acde6c010034cc4f73ff0e0a8cc77` |
| URL | http://192.168.0.108:30995 |

## Operations

### Restart

```bash
kubectl rollout restart deployment/tulip -n tulip
```

### Logs

```bash
kubectl logs -n tulip deployment/tulip -f
```

### Scale down / up

```bash
kubectl scale deployment/tulip -n tulip --replicas=0
kubectl scale deployment/tulip -n tulip --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `tulip`. To force a sync:

```bash
argocd app sync tulip
```
