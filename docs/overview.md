# Homelab — platform overview

One-page orientation. Plan → `ROADMAP.md`; shape → `architecture.md`; rebuild →
`bootstrap.md`; decisions → `adr/`.

## What this is

A single-node-pair k3s cluster (control-plane `debian`, worker `k3s-worker-01`) on one
Proxmox host, managed entirely through GitOps: ArgoCD app-of-apps from this repo
(`bootstrap/root-app.yaml` is the entry point). It is a deliberately small platform built
as a real DevOps/SRE project — CI-gated changes, SLOs, canaries, rehearsal lane, dead-man
paging — where every component has to earn its disk.

## Goals

1. **Git is the source of truth** — live state reconciles to this repo, never the reverse.
2. **Every change is reviewed and validated before it touches the cluster** (CI: yamllint,
   kubeconform, Kyverno policy check, Trivy, NodePort-conflict).
3. **Failures page the phone** (vmalert → ntfy, external uptime-kuma, and a GitHub-side
   dead-man switch for total cluster death).
4. **Progress is measurable** — SLOs + error budgets on the front doors, OpenCost
   shadow-cloud view, quarterly CIS/rebuild drills.
5. **Golden path for new services** — Backstage scaffolder → namespace + Application +
   probes + SLOs + catalog + TechDocs with security defaults baked in.

## Constraints (design in this order)

- **Disk is #1.** One Proxmox host, nearly full. Prefer single-binary variants
  (VictoriaMetrics, not kube-prometheus-stack), bound retention (logs 3d, metrics 30d),
  reclaim before adding. Check `df` before/after installs.
- **One rule: all cluster changes via git → push → ArgoCD.** Diagnose with kubectl freely;
  change via git only (`bootstrap/` excepted for bootstrap itself).
- **The repo is public.** Nothing secret-shaped in manifests or history — SealedSecrets for
  everything; the two known literal leftovers (OpenObserve secret + OTel `OO_AUTH`) are
  tracked open security items pending rotate-and-seal (see README §OpenObserve).
- **LAN-only exposure** (192.168.0.0/24): raw NodePorts until the gateway consolidation
  (ADR 0008).

## Non-goals

- PV backups / Velero — declined 2026-09-29; DR = git + rebuild rehearsal (ADR 0003).
- Multi-cluster / HA control plane — one host is the constraint and the point.
- A service mesh just for canary traffic splits — replica ratio does the job (ADR 0005).
- Internet exposure of any front door.

## Operating principles

- **Cure alert noise at the source, don't blackhole it** — the 2026-10-21 alert-hygiene fix
  raised git-sync's CPU limit and gave node-exporter explicit resources rather than muting
  CPUThrottlingHigh; structural alerts (Kube*Overcommit on a full single host) are
  explicitly blackholed with a reason.
- **PR-time gates stand in for admission** (Kyverno in CI — ADR 0002) because the one rule
  makes the PR the only write path.
- **One measurement system per question** — front-door probe_success serves the SLO *and*
  gates canaries (ADR 0005); vmsingle serves Grafana *and* OpenCost.
- **Docs drift is a bug** — this doc set was reconciled against live state 2026-10-21;
  stale claims (retention windows, auth providers, "replacement" framings) get fixed, not
  annotated around.
