# petal

Pipeline orchestrator (Petal ADR 0003): Go control plane + step-runner executing pipeline steps in a Docker-in-Docker sidecar, with a git-sync checkout.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | Main container pinned to a Petal commit-sha tag (since 2026-10-21; bumped by hand after a Petal CI build); sidecars pinned: `petal-dind:27.5.1`, `git-sync:v4.1.0` (`services/petal/deployment.yaml`) |
| SLO | yes | Blackbox probe on :30990 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/petal/`; workspace PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `petal` |
| Image | `ghcr.io/blacklotus89898/petal:<commit-sha>` (+ petal-dind 27.5.1, git-sync v4.1.0) |
| API auth | mutating routes need `Authorization: Bearer $PETAL_API_TOKEN` (SealedSecret `petal-api-token`); reads open on the LAN |
| URL | http://192.168.0.108:30990 |

## Operations

```bash
kubectl -n petal rollout restart deployment/petal
kubectl -n petal logs deployment/petal --tail=100
```
