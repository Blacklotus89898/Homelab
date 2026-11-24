# warden

Read-only SRE investigator (ADR 0011). Alertmanager routes warning/critical alerts to it first (`continue: true`); it collects a read-only evidence bundle (pods, logs, events, ArgoCD, nodes, the alert's metric, KB hits), appends it to its journal and sends a redacted ntfy digest on topic `warden`.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | commit-sha tag `ghcr.io/blacklotus89898/warden:<sha>` |
| SLO | yes | `/health` service-direct + `https://warden.lab.home/map` gateway probes |
| Recovery | git | Manifests in `services/warden/`; journal PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `warden` |
| URL | https://warden.lab.home/map (only `/map` and `/map.json` are routed) |
| Boundary | SA can get/list pods, logs, events, nodes, applications; no secrets, exec, delete or patch |

## Operations

### Status

```bash
kubectl -n argocd get application warden
kubectl get -n warden deployment/warden
```

### Logs

```bash
kubectl logs -n warden deployment/warden -f
```

## Console (operator)

`https://warden.lab.home/console` — sign in with authentik. Investigation
pages, "investigate now", and per namespace: what changed, blast radius,
traffic. Every phone push on `warden` opens its investigation here.

**One-time authentik setup** (UI; the gateway policy is already in git):

1. Providers → Create → **Proxy Provider**: name and slug `warden-console`,
   **Forward auth (single application)**, external host
   `https://warden.lab.home`. Pick a signing key (Advanced protocol settings).
2. Applications → Create: `warden-console`, provider `warden-console`.
   Policy/Group/User bindings: bind your user only.
3. Outposts → **authentik Embedded Outpost** → edit → add `warden-console`.
4. Copy the provider's **Client ID** into `WARDEN_AUTH_AUDIENCE` in
   `services/warden/deployment.yaml` (PR). **Required:** until it is set the
   console refuses every sign-in, so tokens minted for other apps can't pass.

**Checks:** `/console` without a session redirects to `auth.lab.home`; after
sign-in the header shows "signed in as <you>". "not signed in" with the page
loaded means Warden can't verify the token: check the provider's signing key
and that the JWKS answers:
`kubectl -n warden exec deploy/warden -c kb-davinci -- wget -qO- http://authentik.default.svc:9000/application/o/warden-console/jwks/`
