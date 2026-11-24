# ADR 0011 — Warden: an incident-investigation agent that reads, never writes

- **Status:** Accepted (phase 1a: no model)
- **Date:** 2026-10-27

## Context

The operator wants an agent that can debug and do SRE work on this platform
and, later, Proxmox. The parts already exist: vmalert → alertmanager → ntfy
with runbook links on alerts, a knowledge base of solved incidents (DaVinci
`docs/` + this repo's `docs/`), GitOps as the only write path, and, from
Tulip (Tulip ADR 0002 §3), a proven gate pattern: an agent's credential can
propose but never approve.

Options considered:
- **Claude Code headless or the Agent SDK in a Petal pipeline.** This reuses
  an agent loop, but it brings a Node image, a generic shell, kubectl and an
  MCP sprawl, all inside the step container next to the privileged DinD.
  The boundary would be prompt-level and hard to state.
- **A generic Kubernetes MCP server plus any agent.** The tool surface is the
  vendor's, usually with writes, exec and secrets available, filtered by
  configuration.
- **A small Go service with a fixed tool catalogue (chosen).** It fits the
  stack (Petal and Tulip are Go, SQLite, distroless). The boundary lives in
  code, RBAC and tests, and evidence collection works with no model at all,
  the way Tulip runs rules-only without a brain.

## Decision

**Warden** (`github.com/Blacklotus89898/Warden`, ns `warden`) investigates
alerts. It is built in phases, and each phase ships on its own:

| Phase | What | Status |
|---|---|---|
| 1a | Alert → deterministic evidence bundle → journal + ntfy digest (no model) | live 2026-10-28 (Warden f601223) |
| 1b | Model summary over the bundle (Messages-API tool loop, configurable base URL/model) | **on hold** (2026-11-24, see amendment) |
| 2 | Eval set: replay journaled bundles and past KB incidents, score diagnoses | |
| 3 | Fix proposals as **pull requests** (operator merges; GitOps rule intact) | |
| 4 | Fixed catalogue of live actions behind single-use human approval (Tulip pattern) | |
| 5 | Narrow self-approval for proven, reversible actions only | |

The boundary (phase 1). Each point must stay checkable in the repo:
1. **Read-only identity.** SA `warden/warden` is bound to ClusterRole
   `warden-read`: get/list on pods, pods/log, events, nodes, namespaces,
   services, endpoints, PVCs, workloads, jobs, and ArgoCD Applications.
   **Excluded: secrets, configmaps (some carry credentials), pods/exec,
   pods/attach, port-forward, and every write verb.** Verified with
   `kubectl auth can-i --as=system:serviceaccount:warden:warden` (results in
   the decision log).
2. **A fixed tool catalogue, pinned by a test.** Warden has no generic shell,
   kubectl or HTTP-fetch tool. Its only endpoints are the in-cluster API
   server, vmsingle's query API and ntfy. Nothing reaches Tulip, Petal's API,
   `/approve` or `/killswitch`, and no tool can name a Secret. The Homelab
   CLAUDE.md Tulip rules therefore hold for Warden by construction.
3. **Outputs are only the journal (append-only SQLite) and ntfy.** Inputs
   (alert labels, logs, events) are **untrusted**: juice-shop runs here, and
   any pod can write its own logs. Being read-only caps the blast radius.
   ntfy is unauthenticated on the LAN, so digests carry no raw logs.
   Excerpts are truncated and redacted; the full bundle stays in the
   journal.
4. **Rate limits are designed in.** Alertmanager re-sends every 4h and one
   outage fans out, so Warden adds a fingerprint dedup, a single worker, a
   bounded queue and a daily cap (journaled when hit).
5. **Off switch:** `WARDEN_ENABLED=false` journals the alert and does nothing
   else.
6. **The knowledge base is read-only.** git-sync mirrors DaVinci and Homelab
   `docs/` into the pod; Warden cites hits and never writes the KB. The
   write-up stays a human or Claude Code step (CLAUDE.md).
7. **Routing:** the first alertmanager child route goes to Warden with
   `continue: true`, so ntfy is unchanged. It matches only what ntfy would
   page (warning or critical, not the blackholed alerts).
8. **Proxmox is deferred.** When it comes, it uses a `PVEAuditor` token that
   the operator creates and seals.

## Consequences

- An alert on the phone is followed by a second push with the evidence
  (pod state, last logs, events, ArgoCD state, the alert's metric now, KB
  hits). Triage starts from data, not from `kubectl` on a laptop.
- Every investigation is journaled with its raw alert and bundle. That is
  phase 2's eval set, and the record a phase 4 approval would be audited
  against.
- Cost: one small pod, a git-sync sidecar and a 1Gi PVC. The worker was at
  78% disk before deploy.
- Known gap: no log store yet (OpenObserve still holds plaintext creds), so
  Warden reads current and previous container logs through the API only.
  The roadmap's VictoriaLogs move becomes a dependency for richer evidence.
- **Reopen if** a phase needs a write verb on the SA: the answer is a new ADR
  plus an approval gate, never a wider ClusterRole.

## Amendment — 2026-11-24: services view, Uptime Kuma, 1b on hold

- **Phase 1b is on hold.** The operator investigates incidents and is the
  approval step for anything a model would automate, to learn the platform
  hands-on. Warden gathers and presents evidence; it does not conclude. No
  model credential is sealed. Deterministic automation is unaffected.
- **`/services`** (Warden 59ab6e7): one row per ArgoCD-deployed namespace
  with the four golden signals over 5 minutes (traffic, 5xx share and p95 at
  the Istio gateway; CPU and memory against limits) and that service's
  Uptime Kuma monitors. Monitors that map to no namespace (Proxmox host,
  LXCs, router) are listed on their own. Routed on the gateway like `/map`
  (`/services`, `/services.json`).
- **Boundary change (§2): one new endpoint, Uptime Kuma's public status
  page.** Two fixed `GET` paths (`/api/status-page/homelab` and
  `/api/status-page/heartbeat/homelab`), no credentials: Warden sees exactly
  what any browser on the LAN sees. Pinned by
  `TestKumaReadsOnlyThePublicStatusPage`. Kuma's authenticated `/metrics`
  and socket API stay out of reach. Monitor names and messages are untrusted
  input: the page renders them as text only, and messages are redacted.

## Amendment — 2026-11-24 (2): operator console behind authentik

- **`/console`** (Warden #8): where the operator investigates. Investigation
  pages (bundle, journal trail, the operator's append-only diagnosis),
  "investigate now" on a namespace/pod/node, and per namespace: what changed
  (ArgoCD deploys and failed syncs, restarts, events, alerts, diagnoses), blast
  radius from observed mesh traffic over 24h, and traffic over 1h–7d. Pushes
  link to their investigation. Warden still concludes nothing.
- **Access:** the gateway asks authentik before forwarding `/console` on
  `warden.lab.home` (Istio `ext_authz` provider `authentik` in
  `apps/istio/values.yaml`; `AuthorizationPolicy warden-console-login` in
  `platform/gateways/authz.yaml`). `/map`, `/services` and `/health` stay
  LAN-open as before.
- **Identity is verified, not asserted:** Warden takes the user from
  authentik's signed `X-Authentik-Jwt`, checked against the provider's public
  JWKS. A username header alone is ignored, so a pod calling the Service
  directly can't claim to be the operator. Every console API call needs a
  verified user, so a missing gateway policy fails closed.
- **Boundary (§2–3):** no new Kubernetes read paths; vmsingle gains range
  queries; one new fixed `GET` (authentik JWKS). The only writes are to
  Warden's own journal: an operator investigation (same read-only collectors,
  one at a time, ≥10s apart, daily-bounded, never pushed, refused when
  `WARDEN_ENABLED=false`) and a diagnosis (redacted). Writes need JSON plus
  `X-Warden-Request: 1` against CSRF.
- **Operator setup (authentik UI, once):** Applications → Providers → Create
  → Proxy Provider, name and slug `warden-console`, mode **Forward auth
  (single application)**, external host `https://warden.lab.home`, its own
  dedicated signing key (not the shared self-signed certificate). Create an Application `warden-console` with that provider,
  bind it to your user only, and add it to the **embedded outpost**. Then set
  `WARDEN_AUTH_AUDIENCE` to the provider's client ID: required, the console
  refuses every sign-in without it.

