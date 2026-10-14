# petal

Jenkins CI executor - custom image with Docker-in-Docker builds and git-sync checkout.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | latest (deliberate) | Main container `ghcr.io/blacklotus89898/petal:latest` is a **user choice** (own image, always newest); sidecars pinned: `petal-dind:27.5.1`, `git-sync:v4.1.0` (`services/petal/deployment.yaml`) |
| SLO | yes | Blackbox probe on :30990 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/petal/`; workspace PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `petal` |
| Image | `ghcr.io/blacklotus89898/petal:latest` (+ petal-dind 27.5.1, git-sync v4.1.0) |
| URL | http://192.168.0.108:30990 |

## Operations

```bash
kubectl -n petal rollout restart deployment/petal
kubectl -n petal logs deployment/petal --tail=100
```
