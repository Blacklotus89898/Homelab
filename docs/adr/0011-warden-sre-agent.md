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
| 1b | Model summary over the bundle (Messages-API tool loop, configurable base URL/model) | needs an operator-sealed key |
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
