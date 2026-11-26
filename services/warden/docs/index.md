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

**One-time authentik setup** (done 2026-11-25; the gateway policy is in git).
To redo it (e.g. after losing authentik's database):

1. Providers → Create → **Proxy Provider**: name `warden-console`,
   **Forward auth (single application)**, external host
   `https://warden.lab.home`, **Intercept header authentication** on (lets a
   terminal client sign in with an app password; ADR 0011 amendment
   2026-11-25). Leave header auth off on every other provider.
2. A **dedicated signing key**: System → Certificates → Generate
   `warden-console-signing`. authentik 2025.2 shows no signing-key field for
   proxy providers (UI or API), and without one the JWKS is empty and Warden
   rejects every token (HS256). Set it from the cluster:
   `kubectl -n default exec deploy/authentik-worker -- ak shell -c "from authentik.providers.proxy.models import ProxyProvider as P; from authentik.crypto.models import CertificateKeyPair as K; p=P.objects.get(name='warden-console'); p.signing_key=K.objects.get(name='warden-console-signing'); p.save()"`
   Check: the JWKS URL below lists one RS256 key.
3. Applications → Create: `warden-console` (slug too), provider
   `warden-console`. Bindings: your user only (`akadmin`).
4. Outposts → **authentik Embedded Outpost** → edit → add `warden-console`.
5. The provider's **Client ID** goes in `WARDEN_AUTH_AUDIENCE` in
   `services/warden/deployment.yaml` (PR). Without it the console refuses
   every sign-in, so tokens minted for other apps can't pass.

**Checks:** `/console` without a session redirects to `auth.lab.home`; after
sign-in the header shows "signed in as <you>". "not signed in" with the page
loaded means Warden can't verify the token: check the provider's signing key
and that the JWKS answers:
`kubectl -n warden exec deploy/warden -c kb-davinci -- wget -qO- http://authentik.default.svc:9000/application/o/warden-console/jwks/`
