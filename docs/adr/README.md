# Architecture decision records

One file per load-bearing decision: context, the decision, and its consequences. The
running, finer-grained decision log stays in [`../ROADMAP.md`](../ROADMAP.md#decision-log);
a row graduates to an ADR when it shapes how the platform is built, not just what was done.

| ADR | Decision | Status | Decided |
|---|---|---|---|
| [0001](0001-victoria-metrics-single-binary.md) | VictoriaMetrics single-binary, not kube-prometheus-stack | Accepted | 2026-09-29 |
| [0002](0002-kyverno-ci-not-admission.md) | Kyverno policies enforced in CI, not in-cluster | Accepted | 2026-09-30 |
| [0003](0003-git-as-dr-no-velero.md) | No Velero: the git repo is the DR story | Accepted (user decision) | 2026-09-29 |
| [0004](0004-dead-man-switch-push-heartbeat.md) | Dead-man switch: cluster pushes a heartbeat to GitHub | Accepted, E2E-verified | 2026-10-07 |
| [0005](0005-canary-gate-front-door-slo.md) | Canary gate = the front-door SLO AnalysisTemplate | Accepted, E2E-verified | 2026-10-13 |
| [0006](0006-staging-applicationset-digest-knob.md) | Staging lane: ApplicationSet-stamped overlays, digest as the knob | Accepted, E2E-verified | 2026-10-14 |
| [0007](0007-backstage-portal-petal-orchestrator.md) | Backstage is the portal, Petal is the orchestrator | Accepted | 2026-10-15 |
| [0008](0008-nodeport-until-gateway.md) | Raw NodePort exposure until the gateway consolidation | Partly superseded by 0009 | 2026-10-15 |
| [0009](0009-front-door-istio-gateway-api.md) | Front door = Istio Gateway API on `*.lab.home` with a local CA | Accepted, live (NodePort phase) | 2026-10-21 |

## Open decisions (no ADR yet — each needs a choice before work starts)

- **Telemetry stacks**: keep OpenObserve (logs at 3d, no traces yet) alongside
  VictoriaMetrics, or consolidate (e.g. VictoriaLogs into the same Grafana).
- **Root app-of-apps** (`directory.recurse` over `apps/`) vs. an ApplicationSet per app
  directory — the current pattern caused two wedge incidents.
- **sealed-secrets key renewal**: keep the ~monthly default (backup must be re-exported each
  time) or disable renewal (`--key-renew-period=0`).

## Conventions

- **Numbering is per repo.** Petal has its own ADRs (`github.com/Blacklotus89898/Petal`,
  `docs/adr/`). Cross-repo references say so explicitly: "Petal ADR 0003", "Homelab ADR 0007".
- ADRs are append-only: supersede with a new ADR (`Status: Superseded by NNNN`) rather than
  rewriting history. Small factual updates (verification dates) are fine in place.
- Use [`template.md`](template.md) for new records.
