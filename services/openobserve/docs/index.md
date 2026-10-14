# openobserve

Unified logs, metrics, and traces. Manifests live at `infrastructure/openobserve/`
(this dir holds TechDocs only).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `public.ecr.aws/zinclabs/openobserve:v0.14.6` (`infrastructure/openobserve/statefulset.yaml`) |
| SLO | no | Observability backend - probing it with itself is circular; health surfaces via VictoriaMetrics alerting |
| Recovery | git | Manifests in `infrastructure/openobserve/`; stored telemetry = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `openobserve` |
| Image | `public.ecr.aws/zinclabs/openobserve:v0.14.6` |
| URL | http://192.168.0.108:30500 |

## Operations

```bash
kubectl -n openobserve rollout restart statefulset/openobserve
kubectl -n openobserve logs statefulset/openobserve --tail=100
```
