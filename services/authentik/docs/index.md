# authentik

Identity provider and SSO. Workloads live in the `default` namespace (historical).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | server/worker `2025.2.4` digest-pinned; postgres 16.x and redis 7 digest-pinned (`services/authentik/`) |
| SLO | no | Deliberate: postgres parked, WAL reset pending (`resetwal` job blocked on a user gate) - no probe until authentik is stable again |
| Recovery | git | Manifests in `services/authentik/`, Application `authentik`; PVC contents = accepted loss (2026-09-29 decision) |

## Overview

| Field | Value |
|---|---|
| Namespace | `default` |
| Image | `ghcr.io/goauthentik/server@sha256:36233579...` (2025.2.4) |
| URL | http://192.168.0.108:30080 |

## Operations

```bash
kubectl -n default rollout restart deployment/authentik-server deployment/authentik-worker
kubectl -n default logs deployment/authentik-server --tail=100
```
