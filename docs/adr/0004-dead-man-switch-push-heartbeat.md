# ADR 0004 — Dead-man switch: cluster pushes a heartbeat to GitHub

- **Status:** Accepted (E2E-verified 2026-10-15)
- **Date:** 2026-10-07 (codified from the ROADMAP decision log 2026-10-21)

## Context

The whole alert path — vmalert → vmalertmanager → ntfy → phone — lives **inside** the
cluster it monitors. Total cluster death pages nobody. The classic fix is an external prober
hitting the cluster, but that means hosted infra, creds to manage, and something that itself
needs monitoring.

## Decision

**Push, not pull.** A git-managed CronJob (`infrastructure/heartbeat/cluster-heartbeat`,
arc-runners ns, 2×/h at :07/:37) pushes a timestamp commit to the orphan `heartbeat` branch,
reusing the arc-runner PAT via SealedSecret. On GitHub's side, a watchdog Actions workflow
(hourly, **GitHub-hosted** runner — free for this public repo, survives the cluster) opens a
"Cluster dark?" issue when the branch is >2h stale, comments on the existing issue instead of
stacking, and **auto-closes on recovery** (added 2026-10-19 after the 10-08 page rotted open
for 12 days post-recovery — a stale page makes the next real outage read as old noise).

The child Application carries `sync-wave: "-1"` so the heartbeat syncs before health-gated
siblings.

## Consequences

- The only page that survives total cluster death; zero new infra (one CronJob + one
  workflow; reuses an existing PAT).
- **Depends on a live PAT**: the sealed token was expired at launch and the switch ran dark
  7 days before anyone noticed — rotation discipline on that secret is now load-bearing.
  Beats land on the orphan `heartbeat` branch: freshness checks must read that branch, not
  `main` (a `main`-based check reads "dead" forever).
- The ntfy failure fallback distinguishes cluster-up/push-fail from cluster-down — verified
  live during the bad-token window.
- `workflow_dispatch` with `test_alert=true` exercises the issue-open leg end-to-end.
