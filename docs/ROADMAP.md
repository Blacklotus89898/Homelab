# Homelab Platform Roadmap — living document

This is the canonical plan for turning this homelab into a full platform/DevOps/SRE project.
**Any Claude session working in this repo: read this file first, pick the next unchecked item, do it, update this file (status + notes + commit).** Update `## Status` and `## Decision log` as things change — this file is the memory of the project.

## Standing constraints

- **Disk is the #1 bottleneck.** Everything runs on ONE Proxmox host that is nearly full. Every new component must justify its footprint: prefer single-binary variants (VictoriaMetrics over kube-prometheus-stack), bounded retention, check `df` on debian + k3s-worker-01 before and after installs. Reclaim before adding.
- All cluster changes via **git commit → push → ArgoCD** (repo rule). Diagnose freely with kubectl; change via git only.
- Node disk ops: journal vacuum on debian (sudoers); image prune via the privileged-pod trick (`get_tool "prune unreferenced container images"`).
- Proxmox host: `ssh root@proxmox.home` — **password auth only, held by the user** (ask them; no standing key installed by policy 2026-09-29). Run remote commands via `plink -m <file>` (PS 5.1 shreds multiline argv).

## Status (updated 2026-09-29)

- [x] **Phase 0 — clear the backlog** ✅ DONE 2026-09-28/29 (commits 4705da3, 160c6d7, 9bfb1f9, cc8c3ef)
  - [x] cert-manager sync Unknown → removed schema-invalid `revisionHistoryLimit` (runbooks/cert-manager-sync-unknown.md)
  - [x] cainjector OOMKilled 33 restarts → limit 128Mi (runbooks/cert-manager-cainjector-oom.md)
  - [x] istio webhook sync ping-pong → `ignoreDifferences` jsonPointers on `caBundle`+`failurePolicy` (runbooks/argocd-empty-diff-sync-loop.md — benign 5-min no-op apply remains, documented)
  - [x] paperless disabled (scaled to 0, PVCs kept — revival: solutions/paperless-disabled.md)
  - [x] Daily audit live: Task Scheduler 08:23 → `.claude/scripts/daily-audit.ps1` → `~/homelab-audits/`
  - [x] Disk reclaim: worker 73%→65% (image prune ~3.9G), debian journal 207M
  - [ ] debian reboot (186d uptime; `sudo systemctl reboot` permitted — needs user window)
  - [ ] worker reboot (no sudo there — user must run it)
  - [ ] Proxmox host disk audit (user gave creds 2026-09-29; audit via plink; **ask before deleting anything**)
- [ ] **Phase 1 — reliability foundation** ← NEXT
  - [ ] VictoriaMetrics single-binary + vmagent + Grafana (NOT kube-prometheus-stack — disk). Disk target: <2G all-in.
  - [ ] Alertmanager (or vmalert) → ntfy; every alert annotation links a KB runbook path
  - [ ] Uptime-Kuma probing ingresses externally (image already on worker)
  - [ ] Velero backups + **restore drill with evidence** (target for backups still needs deciding — probably NFS/export on Proxmox or a dir on debian; disk-budget it first)
  - [ ] Renovate on Homelab repo (auto-PR chart/image bumps; kills the `:latest` incident class)
- [ ] **Phase 2 — delivery hardening**
  - [ ] PR CI: yamllint + kubeconform + Kyverno policy check + `argocd app diff` preview; branch protection
  - [ ] Kyverno policies: no `:latest`, resources required, probes required
  - [ ] ArgoCD behind authentik OIDC + RBAC (retire admin-password login)
  - [ ] ArgoCD notifications on sync failure / degraded health
- [ ] **Phase 3 — SRE depth**
  - [ ] SLOs + error budgets on the front door (gateway-api availability/latency) with burn-rate alerts
  - [ ] Canary via Argo Rollouts for petal/backstage
  - [ ] OpenCost capacity view
  - [ ] Quarterly drills: restore, kube-bench; blameless postmortems filed in the KB
- [ ] **Phase 4 — platform engineering**
  - [ ] Backstage golden path: scaffolder template → namespace + Application + catalog entry + CI
  - [ ] TechDocs per service; scorecards (pinned image? has SLO? backed up?)
  - [ ] Staging overlay via ApplicationSet (rehearse upgrades)

## Watchlist (known, accepted — don't re-escalate in audits)

- arc-controller app OutOfSync/Suspended — **kept by user decision 2026-09-28** (environment/cluster-decisions.md); runners Healthy
- audiobookshelf app Suspended but pod running — cosmetic
- svclb-traefik restarts (low rate); petal restarts (active dev)
- ArgoCD no-op webhook apply every ~5 min on istio app (runbooks/argocd-empty-diff-sync-loop.md)

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-28 | Disable paperless (not fix) | unused; `:latest` + missing SECRET_KEY crashlooping 21d; data kept |
| 2026-09-28 | Daily audit at 08:23, $1/day cap | catches regressions like cainjector OOM early |
| 2026-09-28 | VictoriaMetrics over kube-prometheus-stack | disk constraint |
| 2026-09-29 | Keep arc-controller | user decision; runners in use |
| 2026-09-29 | No standing SSH key on Proxmox root | safety classifier; password auth per audit only |
