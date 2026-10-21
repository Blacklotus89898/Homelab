# ADR 0005 — Canary gate = the front-door SLO AnalysisTemplate

- **Status:** Accepted (E2E-verified 2026-10-13)
- **Date:** 2026-10-13 (codified from the ROADMAP decision log 2026-10-21)

## Context

Argo Rollouts canaries backstage (petal is ineligible: single SQLite writer on an RWO PVC
with Recreate — canary needs ≥2 independent pods). A canary needs an automated abort signal.
Meanwhile Phase 3 already measures the front doors: `VMProbe front-doors` scrapes
`probe_success` for six in-cluster service endpoints at 30s, feeding the 99%/30d SLO
recordings and burn-rate alerts.

Two options: wire a dedicated canary metric path (new queries, new dashboards, new signal to
trust), or point the canary at the measurement that already exists.

## Decision

**One measurement system.** Every canary's background `analysis:` runs
ClusterAnalysisTemplate `front-door-success-rate`: avg `probe_success` ≥ 0.9 from vmsingle,
6×30s measurements. Below threshold = abort = auto-rollback (`progressDeadlineAbort: true`,
so stalled progress also rolls back instead of wedging Degraded).

Traffic splits by **replica ratio** (`setWeight: 50` with 2 replicas = true 1:1 pod split
behind the existing Service) — no mesh was added for canary (disk-first).

## Consequences

- SLO coverage and canary gating compose: any service that gets a front-door probe gets a
  canary gate for free; a new front door automatically tightens every rollout that targets it.
- The canary's judgment depends on vmsingle being up mid-rollout — accepted; monitoring is
  platform-critical and itself SLO'd/probed.
- Replica-ratio splitting means granularity = 1 pod; with 2 replicas the only split is 50/50.
  Finer splits need more replicas (disk cost) or a mesh (deferred — ADR 0008 direction).
- The Rollout **adopts** the chart Deployment via `workloadRef` (chart pinned at
  `replicas: 0` as a pod-less template shell) because ArgoCD has no Helm post-renderer
  (argoproj/argo-cd#3698) — see the ROADMAP 2026-10-13 decision rows for the two
  ignoreDifferences/scaleDown traps that structure avoids.
