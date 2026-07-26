# ${{ values.name }}

${{ values.description }}

## Overview

| Field | Value |
|---|---|
| Namespace | `${{ values.namespace }}` |
| Image | `${{ values.image }}` |
| URL | http://192.168.0.108:${{ values.nodePort }} |

## Operations

### Restart

```bash
kubectl rollout restart deployment/${{ values.name }} -n ${{ values.namespace }}
```

### Logs

```bash
kubectl logs -n ${{ values.namespace }} deployment/${{ values.name }} -f
```

### Scale down / up

```bash
kubectl scale deployment/${{ values.name }} -n ${{ values.namespace }} --replicas=0
kubectl scale deployment/${{ values.name }} -n ${{ values.namespace }} --replicas=1
```

## ArgoCD

Managed by ArgoCD Application `${{ values.name }}`. To force a sync:

```bash
argocd app sync ${{ values.name }}
```
