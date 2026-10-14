# backstage

Developer portal - service catalog, scaffolder golden path, TechDocs (this doc set).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | CI-built image pinned by commit tag `ddf415be...` (`apps/backstage/values.yaml`) - upgrade = merge, build, bump tag |
| SLO | yes | Blackbox probe on `:7007` (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Chart values in `apps/backstage/`; Rollout in `services/backstage/rollout.yaml`; Postgres data = accepted loss (catalog re-ingests from GitHub) |

## Overview

| Field | Value |
|---|---|
| Namespace | `backstage` |
| Image | `ghcr.io/blacklotus89898/backstage:ddf415be3556` (CI-built) |
| URL | http://192.168.0.108:30900 |

## Operations

Runs as an Argo Rollouts canary (the chart's own Deployment is a 0-replica shell) -
restart via the Rollout, never the shell:

```bash
kubectl -n backstage rollout restart rollout/backstage
kubectl -n backstage get rollout backstage   # canary phase + stable RS
kubectl -n backstage logs -l app.kubernetes.io/name=backstage --tail=100
```
