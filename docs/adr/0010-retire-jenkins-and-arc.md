# ADR 0010 — Retire Jenkins and ARC; CI = GitHub Actions + Petal

- **Status:** Accepted (user request 2026-10-23; reverses the 2026-09-28 "keep arc-controller" decision)
- **Date:** 2026-10-23

## Context

The platform ran four CI systems on one worker: GitHub-hosted Actions (all real CI —
`validate-pr`, image builds, release-please, the heartbeat watchdog), Petal (the
orchestrator, ADR 0007 / Petal ADR 0003), Jenkins, and ARC self-hosted runners.

- **Jenkins** (chart 5.9.68, LTS JDK21, JCasC) ran one multibranch job, `homelab`, that
  re-did YAML validation already enforced by `validate-pr`. 8 builds in its lifetime;
  10Gi PVC, 250m/512Mi requested, 2Gi limit.
- **ARC** (gha-runner-scale-set 0.10.1, DinD mode) had been dead in practice since
  2026-09 (too slow on the shared worker; roadmap "ARC dead (perf)"): the controller was
  scaled to 0 out-of-band and its Application set to manual sync. No Homelab, Petal or
  DaVinci workflow ran on `homelab-runner` except Petal's `petal-trigger.yaml`, which
  is dormant (`PETAL_ENABLED` never set — every run skipped).
- Disk and memory on the single worker are the first-class constraint (ROADMAP standing
  constraints); worker rootfs was 79–82% on 2026-10-23.
- ARC's PAT was also the dead-man switch's credential (ADR 0004) — retiring ARC naively
  would have silently killed the only out-of-cluster alert path.

## Decision

1. **CI is GitHub-hosted Actions for repo CI, Petal for pipelines that need the cluster.**
   Jenkins and ARC are removed from the cluster.
2. **Retired, not deleted.** The Application definitions move to `archive/apps/`
   (outside the root app-of-apps' `apps/` recursion); their `infrastructure/` manifests
   and values stay in place so `validate-pr` keeps them from rotting. The last commit
   with both running is tagged `retired/jenkins-arc-2026-10-23`.
3. **Reactivation is a documented, tested-by-construction path:**
   [`../runbooks/reactivate-jenkins.md`](../runbooks/reactivate-jenkins.md) and
   [`../runbooks/reactivate-arc.md`](../runbooks/reactivate-arc.md) — `git mv` back,
   re-register the chart repo, re-seal the credential, revert the listed cross-cutting
   edits.
4. **The heartbeat owns its own credential** (ns `heartbeat`, SealedSecret
   `heartbeat-github-pat`, commit 6f07dd7) before ARC goes.
5. **Teardown order is enforced by separate commits:** ARC scale set first while the
   controller runs (its finalizers deregister the scale set from GitHub), then the
   controller, then Jenkins, then namespaces, then Backstage's Jenkins wiring.

## Consequences

- Frees the Jenkins PVC (10Gi local-path on the worker root fs) and ~0.5Gi of memory
  requests; removes two chart-repo registrations from bootstrap, two Applications that
  were permanent audit exceptions (arc-controller OutOfSync/Suspended), and the firing
  `KubeDeploymentReplicasMismatch` alert.
- Removes Backstage's unauthenticated `/jenkins` proxy (`credentials:
  dangerously-allow-unauthenticated`) and the Jenkins plugin wiring.
- **Lost:** Jenkins build history (8 builds; config is JCasC, so nothing else). Any
  workflow needing a LAN-reachable runner (Petal's push trigger) has none until ARC is
  reactivated or Petal triggers itself from git (multi-repo work).
- **Signal this was wrong:** a pipeline needs in-LAN execution that Petal can't provide,
  or GitHub-hosted minutes/limits start blocking CI — reactivate ARC per the runbook.
