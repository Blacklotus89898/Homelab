# heartbeat

Push-not-pull dead-man switch. CronJob `cluster-heartbeat` (`7,37 * * * *`) pushes to the orphan `heartbeat` branch; the hourly GitHub workflow `heartbeat-watchdog.yml` opens a page issue if the branch is older than 2h. A failed push alerts ntfy locally.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | `alpine/git:2.54.0` |
| SLO | n/a | It is the out-of-band liveness check; staleness is judged by GitHub, not the cluster |
| Recovery | git | `infrastructure/heartbeat/`; needs the sealed PAT (rotate before expiry) |

## Overview

| Field | Value |
|---|---|
| Namespace | `heartbeat` |
| Schedule | `7,37 * * * *` |
| Check | `git ls-remote origin heartbeat`, then the commit date |

## Operations

### Status

```bash
kubectl -n argocd get application heartbeat
kubectl get -n heartbeat cronjob/cluster-heartbeat
```

### Logs

```bash
kubectl get jobs -n heartbeat --sort-by=.metadata.creationTimestamp
kubectl logs -n heartbeat job/<latest-job>
```
