# Homelab — rebuild from git (ordered procedure + out-of-git ledger)

DR posture (ADR 0003): this repo is the source of truth; PV contents are accepted loss. This
page is the honest rebuild path — including everything git **cannot** give back. The
quarterly rehearsal runbook (git↔live parity audit) lives in the DaVinci KB:
`runbooks/cluster-rebuild-from-git.md` (cross-repo; migrating runbooks into this repo is an
open decision).

Steps marked ⚠️ are **unverified or not captured in git** — the ledger at the bottom is the
list of things a rebuild must source elsewhere.

## Ordered procedure

1. ⚠️ **Proxmox host + VMs** (user-held: root password). Recreate two VMs per the
   2026-09-29 audit: `debian` (control-plane, 192.168.0.112) and `k3s-worker-01`
   (192.168.0.108, all workloads). Worker needs the VirtIOFS share `/mnt/smb_storage`
   **with xattr enabled** (VM stop/start; without it dind/buildkit multi-stage copies fail —
   `docs/solutions/virtiofs-xattr-dind-buildkit.md`).
2. ⚠️ **Node OS** (Debian 12): SSH key auth (Windows ssh-agent keys), fstab mounts, and on
   debian the sudoers drop-in `/etc/sudoers.d/900-claude-ops` (kubectl/journalctl/systemd
   only — contents not in git; scope documented in CLAUDE.md).
3. ⚠️ **k3s**: server on debian + agent on worker. `/etc/rancher/k3s/config.yaml` (token,
   node-ip, any flags) is **not in git** — capture pending (needs sudo to read). kubeconfig
   to the admin workstation.
4. **sealed-secrets first**: install the controller, then `kubectl apply -f` the
   **user-held keyring backup** (password manager, out-of-band — never this repo) **before**
   ArgoCD re-applies any SealedSecret, or nothing decrypts. Keyring rotates ~monthly
   (controller default) — re-export after each rotation or later seals won't decrypt on a
   future rebuild.
5. ⚠️ **ArgoCD initial install** (it then self-manages from `apps/argocd/` via root-app).
   Exact bootstrap commands: DaVinci KB `runbooks/cluster-rebuild-from-git.md` — verify
   against it before relying on this page.
6. **Apply `bootstrap/root-app.yaml`** — the one permitted `kubectl apply`. ArgoCD pulls the
   repo and syncs app-of-apps; the heartbeat child carries `sync-wave: "-1"` and lands
   first.
7. **Wait for convergence**, then verify the load-bearing signals: `kubectl get nodes`;
   applications Synced/Healthy (arc-controller Suspended and audiobookshelf Suspended are
   by-design exceptions); `probe_success` 6× = 1 in vmsingle; a heartbeat beat lands on the
   `heartbeat` branch.
8. ⚠️ **UI-state layer** (per-service, not in git): uptime-kuma monitors + its ntfy provider;
   authentik admin login + the OIDC provider half; the GitHub OAuth app behind Backstage's
   sealed client secret; phone ntfy subscriptions (topic `homelab-alerts`,
   http://192.168.0.108:30310). Grafana/ArgoCD admin creds are SealedSecrets — they survive.
9. **Floaters — decide, don't auto-restore** (live-only, never in git): juice-shop (:30001),
   guestbook-ui, simple-rust-api, portainer-agent, the old uptime-kuma deployment. Adopt
   into git or let them go.
10. **Exercises**: watchdog `workflow_dispatch` with `test_alert=true` (issue-open leg);
    a staging rehearsal (ADR 0006) to prove the delivery path end-to-end.

## Out-of-git ledger (what git cannot restore)

| Layer | Contents | Where it lives |
|---|---|---|
| Proxmox | host config, VM/CT definitions, VirtIOFS shares, storage | user (password-held) |
| Nodes | Debian OS, SSH keys/sudoers, fstab, k3s install + `/etc/rancher/k3s/config.yaml` (token!) | nodes only — config capture **pending** |
| Cluster bootstrap | sealed-secrets keyring (backed up ✅ 2026-10-21, re-export after rotations), ArgoCD initial install + admin password, `root-app` apply | keyring: password manager; rest: this page + KB runbook |
| GitHub | this repo (obviously), branch protection, PATs (arc-runner/heartbeat, Renovate app, Backstage OAuth app) | user GitHub account |
| UI-state | uptime-kuma monitors, authentik providers, phone ntfy subscriptions, Renovate dashboard state | per-service UI / phone |
| Floaters | juice-shop, guestbook-ui, simple-rust-api, portainer-agent, old uptime-kuma | nowhere — adopt or drop |

Closing ledger rows (capturing k3s config, VM specs, ArgoCD bootstrap commands as verified
runbook steps) is tracked in `ROADMAP.md`.
