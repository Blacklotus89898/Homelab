# opencost

OpenCost (chart 2.5.32): one pod, two containers (exporter + UI). Uses the existing vmsingle as its Prometheus datasource. Pricing is shadow-cloud `customPricing` in git (UI edits are in-memory only).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | chart | opencost 2.5.32, images digest-pinned |
| SLO | yes | `https://opencost.lab.home/` gateway probe |
| Recovery | git | `apps/opencost/`; no persistent state |

## Overview

| Field | Value |
|---|---|
| Namespace | `monitoring` |
| URL | https://opencost.lab.home/ (NodePort 30330) |

## Operations

### Status

```bash
kubectl -n argocd get application opencost
kubectl get -n monitoring deployment/opencost
```

### Logs

```bash
kubectl logs -n monitoring deployment/opencost -f
```
