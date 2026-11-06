# warden

Read-only SRE investigator (ADR 0011). Alertmanager routes warning/critical alerts to it first (`continue: true`); it collects a read-only evidence bundle (pods, logs, events, ArgoCD, nodes, the alert's metric, KB hits), appends it to its journal and sends a redacted ntfy digest on topic `warden`.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | commit-sha tag `ghcr.io/blacklotus89898/warden:<sha>` |
| SLO | yes | `/health` service-direct + `https://warden.lab.home/map` gateway probes |
| Recovery | git | Manifests in `services/warden/`; journal PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `warden` |
| URL | https://warden.lab.home/map (only `/map` and `/map.json` are routed) |
| Boundary | SA can get/list pods, logs, events, nodes, applications; no secrets, exec, delete or patch |

## Operations

### Status

```bash
kubectl -n argocd get application warden
kubectl get -n warden deployment/warden
```

### Logs

```bash
kubectl logs -n warden deployment/warden -f
```
