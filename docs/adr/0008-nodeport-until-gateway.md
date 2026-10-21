# ADR 0008 — Raw NodePort exposure until the gateway consolidation

- **Status:** Accepted (direction committed 2026-10-15; consolidation still pending)
- **Date:** 2026-10-21 (codified from the ROADMAP decision log)

## Context

Every service is exposed as a raw NodePort on the worker (192.168.0.108). Istio and the
gateway-api CRDs are **installed, Synced/Healthy — and unused**: `platform/gateways/` is
empty. A 2026-10-15 audit asked "decide or uninstall"; the decision was **keep, for the
eventual front-door consolidation** (TLS termination + optionally Caddy, user-authorized).

Until that lands, NodePorts are the exposure model, and port space is a shared finite
resource: nodePorts are cluster-global, and the CI conflict check only greps literal
`nodePort:` keys — it misses Helm-style `nodePortHttp`/`nodePortHttps` keys (known gap).

## Decision

Keep NodePort-per-service as the interim exposure model. The registry of truth is the table
in `README.md` (cross-checked against the cluster 2026-10-21; DaVinci KB
`environment/homelab-cluster.md` mirrors it). Check the table before assigning any port.
Istio + gateway-api stay installed as the committed direction for the front-door
consolidation; no timeline set.

## Consequences

- No TLS on any front door — accepted on the LAN (192.168.0.0/24); an internal CA is the
  recommended companion when the gateway lands.
- SLOs probe **in-cluster service DNS**, not HTTPRoutes (ADR 2026-10-08): when a gateway
  lands, re-target the VMProbe and the NodePort table shrinks to the gateway itself.
- Unauthenticated services are effectively node-level-exposed (petal 30990's mutating routes
  fronting a privileged DinD pod is the sharp case) — the consolidation is a security item,
  not just polish.
- The port-check gap means a Helm chart can still collide silently — when adding a chart
  app, verify assigned nodePorts against the cluster (`kubectl get svc -A`), not just CI.
