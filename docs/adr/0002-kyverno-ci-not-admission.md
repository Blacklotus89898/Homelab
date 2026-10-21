# ADR 0002 — Kyverno policies enforced in CI, not in-cluster

- **Status:** Accepted
- **Date:** 2026-09-30 (codified from the ROADMAP decision log 2026-10-21)

## Context

We wanted admission-time guarantees: no `:latest` images, resources required, probes
required. Kyverno normally means a controller (plus background-controller plus
cleanup-controller) running in-cluster with CRDs and webhooks. Disk-first says: don't add
three pods to police a fleet whose every change already funnels through one door.

The repo rule makes that door real: **all cluster changes go through git commit → push →
ArgoCD**. Nothing is applied out-of-band except `bootstrap/`. So the PR is, in practice, the
admission path.

## Decision

Kyverno policies live in `policies/` (disallow-latest-tag, require-container-resources,
require-probes — Enforce rules, explicit per-kind container paths, no autogen; petal excluded
on latest+probes by design). They are **applied by the kyverno CLI (`kyverno apply`) inside
the `Validate PR` CI job** over an ArgoCD-shaped render (kustomize dirs rendered, bare dirs
flat). No Kyverno controller is installed in the cluster.

## Consequences

- Zero in-cluster footprint; the guarantees ride existing CI (yamllint, kubeconform, Trivy,
  NodePort-conflict check).
- Equivalent to admission **because** of the one rule — if someone hand-applies YAML, the
  gate is bypassed. Accepted: hand-applies outside `bootstrap/` are already violations and
  ArgoCD reverts them.
- Policies must stay renderable CI-side; Helm output itself is NOT validated (only the
  Application CR) — chart-default 1Gi limits slipped past once (OpenCost; the monitoring-ns
  LimitRange caught it at admission instead). Pre-flight chart renders locally when limits
  matter.
