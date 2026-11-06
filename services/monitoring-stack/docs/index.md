# monitoring-stack

VictoriaMetrics k8s-stack (chart 0.95.0, fullname `vmstack`): vmsingle (30d retention, 8Gi), vmagent, vmalert, vmalertmanager (routes to ntfy) and Grafana. Probes and SLO rules live in `infrastructure/blackbox-exporter/` (Application `blackbox-exporter`); extra rules in `infrastructure/victoria-metrics/` (Application `victoria-metrics-infra`).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | chart | victoria-metrics-k8s-stack 0.95.0 pins component versions |
| SLO | yes | Grafana service-direct + `https://grafana.lab.home/` gateway probes |
| Recovery | git | Apps `victoria-metrics` + `victoria-metrics-infra`; metric history (vmsingle PVC) = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `monitoring` |
| URL | https://grafana.lab.home/ (NodePort 30300) |
| Disk | vmsingle PVC is the largest volume on the worker (~4.2G used of 8Gi, 2026-11-05) |

## Operations

### Status

```bash
kubectl -n argocd get application victoria-metrics
kubectl get -n monitoring deployment/vmsingle-vmstack
```

### Logs

```bash
kubectl logs -n monitoring deployment/vmsingle-vmstack -f
```
