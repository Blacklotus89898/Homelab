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
  - [x] Proxmox host disk audit (2026-09-29, read-only; tools/plink-headless-password-ssh.md) — findings:
    - **`hard_drive` (1.9T, 94%) is the crisis; it's user data, not cruft**: `smb_data` 1.61T (media/downloads served by CT 112 smb, consumed by jellyfin 114 + qbittorrent 113 via qb-data CIFS = same disk), `images` 152G (VMs 100/103/104), `template` 13G. Zero ISOs/dumps/snapshots. Reclaim = user curation or a new disk.
    - **local-lvm pool fine** (794G, 41% actual). But 4 CT rootfs nearly FULL (will break): jellyfin 114 @99.8%/16G, npm 120 @96.6%/8G, immich 134 @93.5%/30G, qbittorrent 113 @92.5%/20G → resize via `pct resize <ct> rootfs +8G` (**pending user OK**).
    - Stopped VMs holding space: ai-agent 59.5G actual (lvm), win 21.7G, rover ~100G (on hard_drive images) — **user decision**.
    - ubuntu22 VM: 256G thin / 134G used, running.
    - **No VM/CT backups at all** (pbs-container stopped, dump dirs empty) — resilience gap; see Phase 1.
    - pve journal 719M on root (28%) — low priority.
    - Actions pending user: CT resizes, stopped-VM deletions, smb_data curation. NOTHING deleted without explicit OK.
- [ ] **Phase 1 — reliability foundation** ← NEXT
  - [x] VictoriaMetrics single-binary + vmagent + Grafana (NOT kube-prometheus-stack — disk). Disk target: <2G all-in. ✅ DONE 2026-09-29 (commits 3076603, 75dcf3b, 9ddbe32)
    - victoria-metrics-k8s-stack 0.95.0 (app v1.153.0) into `monitoring` ns; fullname `vmstack` (default fullname breaks k8s 63-char label limit on operator CRs). 22/22 targets up, ~6.8k rows/s, worker 66%→71% (~2G incl. images).
    - Grafana: NodePort 30300, admin creds via SealedSecret `grafana-admin-credentials` (retrieve: `kubectl -n monitoring get secret grafana-admin-credentials -o jsonpath='{.data.admin-password}' | base64 -d`).
    - 30d retention, vmsingle PVC cap 8Gi, grafana PVC 2Gi. ns LimitRange (max 512Mi/container) — charts without explicit resources get 256Mi default and OOMKill (hit grafana).
  - [x] Alertmanager (or vmalert) → ntfy; every alert annotation links a KB runbook path ✅ DONE 2026-09-29 (commits 5f2b68c, 334fe3a, 0fc7da5)
    - ntfy v2.28.0 (pinned, `binwiederhier/ntfy`) as plain-manifest app in `monitoring`, NodePort 30310, emptyDir cache (no PVC — disk), no auth (LAN-accepted; revisit if ever exposed past 192.168.0.0/24). Phone: ntfy app → http://192.168.0.108:30310 → topic `homelab-alerts`.
    - vmalertmanager routes: default → ntfy webhook (raw JSON body as message, v1; formatting bridge = Phase 2), max_alerts 3, send_resolved. Blackhole: Watchdog, severity=none/info, KubeMemoryOvercommit (structural), namespace=arc-systems (app deliberately Suspended). k3s: kubeScheduler/kubeControllerManager rules disabled (embedded in k3s → Kube*Down false-positive forever).
    - E2E verified: synthetic `ClaudeWiringTest` POSTed to alertmanager /api/v2/alerts arrived on the topic with title "Homelab alert". Runbook links: VM defaultRules carry runbook_url → prometheus-operator runbooks; OUR-KB links become the standard for custom rules (ongoing, applies as custom rules get written). KB: solutions/ntfy-alert-pipeline.md.
  - [x] Uptime-Kuma probing ingresses externally ✅ DONE 2026-09-29 (commits f4a151b, 0a9b80d)
    - 2.1.2 pinned (2.x maintained; 1.x EOL) — roadmap's "image already on worker" was stale; fresh pull. Plain-manifest app in `monitoring`, STS + 1Gi local-path PVC (real use ~100Mi), 50m/128Mi→500m/512Mi (ns LimitRange). UI: http://192.168.0.108:30320 (verified 200 from LAN).
    - First-run admin + monitor list + native ntfy provider wiring = UI tasks (suggested list in KB). Known gap → Phase 2: whole alert path is in-cluster; cluster-down pages nobody (external dead-man switch candidate).
    - Gotcha solved: ArgoCD ignoreDifferences does NOT honor `*` wildcards — STS stuck OutOfSync until pointers matched openobserve's numeric-index style. KB: solutions/uptime-kuma.md.
  - [x] ~~Velero backups + restore drill~~ ✅ DECLINED by user 2026-09-29 ("no backup") — DR posture = this git repo is the source of truth; PV contents accepted as non-recoverable. Do not re-propose without user asking. (For the record, disk survey that informed it: debian root 11.1G free, worker root 12.0G, /mnt/smb_storage 116.4G on the 94%-full Proxmox disk.)
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
- victoria-metrics app: operator self-rotates its webhook TLS cert + caBundles → transient OutOfSync residue possible (same class as istio). If it starts oscillating, fix = `victoria-metrics-operator.admissionWebhooks.enabled: false` in values. Do not re-escalate on a transient diff.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-09-28 | Disable paperless (not fix) | unused; `:latest` + missing SECRET_KEY crashlooping 21d; data kept |
| 2026-09-28 | Daily audit at 08:23, $1/day cap | catches regressions like cainjector OOM early |
| 2026-09-28 | VictoriaMetrics over kube-prometheus-stack | disk constraint |
| 2026-09-29 | Keep arc-controller | user decision; runners in use |
| 2026-09-29 | No standing SSH key on Proxmox root | safety classifier; password auth per audit only |
