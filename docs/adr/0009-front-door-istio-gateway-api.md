# ADR 0009 — Front door = Istio Gateway API on *.lab.home with a local CA

- **Status:** Accepted (Phases A + B live 2026-10-21; traefik removed, gateway on 80/443 2026-10-22)
- **Date:** 2026-10-21
- **Supersedes:** the interim half of [ADR 0008](0008-nodeport-until-gateway.md)

## Context

Istio 1.30 ambient was installed and partly working — ztunnel carried mTLS L4 traffic for
18 pods in 6 namespaces — but the ingress gateway served nothing (0 Gateways, 0 routes),
nothing was observable (0 `istio_*` series in vmsingle), and every service was a plain-HTTP
NodePort. Options considered (ADR index "open decisions"):

- **Finish Istio** — Gateway API on the existing gateway, TLS via cert-manager, then STRICT
  mTLS, authz policies, waypoints, authentik ext_authz. One stack, mesh-native.
- **Simplify to traefik** — IngressRoutes + forward-auth; drop istio. Cheaper, but throws
  away the working ambient mTLS and the L7 / zero-trust path.
- **Caddy** (mentioned in 0008) — a third proxy with no mesh story.

LAN DNS already exists (Pi-hole at 192.168.0.53 serves `*.home`); there is no public domain.

## Decision

1. **Istio is the platform layer.** Front door = one Gateway API `Gateway` (`lab`, class
   `istio`, in `platform/gateways/`) bound to the existing helm ingress gateway via
   `spec.addresses` (Istio "manual deployment" — no new pods; fixed NodePorts 30131/30328).
2. **Hostnames:** `<service>.lab.home`, one HTTPRoute per service in the service's own
   namespace, all in `platform/gateways/routes.yaml` (the hostname registry). Pi-hole
   wildcard `lab.home → 192.168.0.108` (a dnsmasq line, user-managed).
3. **TLS:** cert-manager local CA — self-signed bootstrap → 10-year ECDSA root
   (`cert-manager/lab-root-ca`) → `lab-ca` ClusterIssuer → 90-day `*.lab.home` wildcard,
   auto-renewed. Devices trust the root once.
4. **Observability first:** ztunnel / istiod / gateway scraped into vmsingle with per-target
   series limits; ztunnel + control-plane dashboards only (ambient without waypoints is L4 —
   L7 dashboards would be empty).
5. **Sequencing:** NodePorts stay in parallel until the hostnames are verified; then traefik
   is disabled (server-only k3s config) and the gateway takes 80/443; then STRICT mTLS per
   namespace, default-deny AuthorizationPolicies, and waypoints for L7 (Gateway API canary
   weights, authentik ext_authz at the gateway).

## Consequences

- ~~Until traefik is removed, URLs carry the NodePort~~ — done 2026-10-22: URLs are
  `https://<svc>.lab.home`, `http://` 301s to https (`platform/gateways/http-redirect.yaml`).
- **Disabling traefik deletes the Gateway API CRDs.** k3s's packaged `traefik-crd` chart
  owned the standard-channel CRDs; its uninstall cascade-deleted every Gateway and
  HTTPRoute. ArgoCD's `gateway-api` app re-created the CRDs within a minute, and the
  `gateways` app re-created the objects once routes were ordered after the Gateway
  (sync-wave 5, commit 198a0fa). On a rebuild, k3s starts with traefik disabled, so the
  `gateway-api` app is the CRDs' only owner from day one.
- The CA private key lives only in the cluster: a rebuild mints a new CA and every device
  re-trusts it (bootstrap ledger). Backing it up is a user decision, like the sealed-secrets
  keyring.
- The front-door SLO VMProbe still targets in-cluster service DNS. `probe_success` is also
  the Backstage canary gate (ADR 0005); the real gateway path now runs alongside as job
  `gateway-front-doors` (blackbox `https_lab`, CA-verified) — promote it into the SLO once
  it has a clean history.
- backstage is not routed yet: its baseUrl and GitHub OAuth callback are bound to the
  NodePort and move through its canary separately.
- **Signal this was wrong:** gateway/waypoint overhead pushes the worker's CPU reservations
  back toward the limit, or ambient enrollment keeps blocking workloads (DinD) — revisit
  the traefik option then.
