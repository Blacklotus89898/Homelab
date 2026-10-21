# ADR 0007 — Backstage is the portal, Petal is the orchestrator (both stay)

- **Status:** Accepted
- **Date:** 2026-10-21 (mirrors Petal repo ADR 0003; fixes the README's old framing)

## Context

The README long said Petal was "built to replace Backstage", with a migration status block
promising decommissioning "once Petal covers catalog + notifications". Reality diverged:
Backstage settled into the **portal** role (catalog, scorecard annotations, TechDocs,
scaffolder golden path, canary-gated deploys) while Petal became the **orchestrator** (Go
control plane scheduling/deduplicating/recording pipeline runs, repo-native
`.petal/pipelines/*.yaml`, executed by its step-runner in plain Docker via a DinD sidecar —
Petal ADR 0002, which superseded the original Dagger-engine design after vfs pain).

Neither is a draft of the other. They don't share a data model, and nothing in either
roadmap requires the other to disappear.

## Decision

Run both, **by design** — division of labor, not cutover. Backstage (`:30900`) is the
developer-facing portal; Petal (`:30990`) is the pipeline orchestrator. There is no
decommission plan and no "migration status"; the Petal repo's ADR 0003 records the same
split from its side.

## Consequences

- Two UIs and two deployment stories to keep healthy; both are already catalog components
  with TechDocs and scorecard annotations (`homelab.io/*`), so fleet hygiene covers both.
- Integration (e.g. Petal run status visible in Backstage) is **future work**, not migration
  debt — nothing is provisional.
- Known-open items stay per-system: Backstage `guest: {}` still enabled (issue #2, pending
  authentik OIDC); Petal is pinned to a commit-sha tag (2026-10-21), sidecars pinned.
- Petal's mutating routes need a bearer token since 2026-10-21 (Petal ADR 0003), but the
  token-holder still drives a privileged DinD pod, and once Backstage triggers Petal the
  effective gate is Backstage's own auth (still `guest: {}`) — treat the trigger path as
  node-level access until authentik + a permission policy land (ADR 0008).
