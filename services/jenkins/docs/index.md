# jenkins

Jenkins CI server - builds container images for this repo (backstage, petal).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | no | Chart `targetRevision: "*"` floats and image tag `lts-jdk21` is a moving tag (`apps/jenkins/`) - the fleet's only unpinned non-deliberate workload |
| SLO | no | Not probed; CI is best-effort (GitHub Actions is the primary gate) |
| Recovery | git | Chart values in `apps/jenkins/`; build history PV = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `jenkins` |
| Image | chart-managed, tag `lts-jdk21` (floating) |
| URL | http://192.168.0.108:30808 |

## Operations

```bash
kubectl -n jenkins rollout restart deployment/jenkins
kubectl -n jenkins logs deployment/jenkins --tail=100
```
