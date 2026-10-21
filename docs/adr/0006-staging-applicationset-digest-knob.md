# ADR 0006 — Staging lane: ApplicationSet-stamped overlays, digest as the knob

- **Status:** Accepted (first rehearsal E2E 2026-10-14; second target 2026-10-19)
- **Date:** 2026-10-14 (codified from the ROADMAP decision log 2026-10-21)

## Context

Upgrades go straight to prod unless there's a rehearsal lane. The textbook answer — a second
cluster, or duplicating the fleet — is impossible here (one nearly-full Proxmox host; disk is
the #1 constraint). What an upgrade rehearsal actually needs to prove is **"the new version
serves"**, not "it migrates data" (prod data isn't touched by a rehearsal either way).

## Decision

A list-generator **ApplicationSet** (`apps/staging/applicationset.yaml`) stamps kustomize
overlays under `environments/staging/<app>/` into a side namespace. The overlay is
deliberately shrunken: **no PVC** (prod PVs are spec-bound via `volumeName`; emptyDir stands
in), Service → ClusterIP (nodePorts are cluster-global; prod owns them), resources scaled to
a rehearsal profile — and `images:` **digest override is the single rehearsal knob**: point
it at the candidate, sync, watch the probe.

Adding a rehearsal target = one list element + one overlay dir. Staging observability is
separate on purpose: own VMProbe + hard-down warning rule, no burn-rate math (rehearsal
targets must fail loudly without spending the prod front-door error budget).

## Consequences

- Cost per target: one ~128Mi pod + the candidate image layer (reused at promotion — the
  linkding 1.46.2→1.47.0 promotion needed no new pull).
- HostPath-backed services (kavita's config + SMB comics) become emptyDir in staging — a
  candidate can never migrate prod's config, and the pod schedules unpinned.
- The lane validates version-serves, **not** data migrations — a migration-bearing upgrade
  still needs its own plan.
- Staging digests mirror prod between rehearsals and are **excluded from Renovate**: an
  automated bump there would fight the knob (the digest IS the rehearsal control).
- CI renders + kubeconform-validates every `environments/staging/*/` overlay, so the lane
  can't rot silently.
