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
2. **Node OS** (Debian 12) — config captured in [`bootstrap/nodes/`](../bootstrap/nodes/README.md):
   SSH key auth (Windows ssh-agent keys); on the worker append
   `bootstrap/nodes/worker/fstab.snippet` to `/etc/fstab` and install the
   `k3s-disk-cleanup` script + service + timer; on debian recreate the sudoers drop-in
   `/etc/sudoers.d/900-claude-ops` (root-only readable, not captured — scope in CLAUDE.md).
3. ⚠️ **k3s** (v1.34.5+k3s1; install commands reconstructed, not yet rehearsed). Both nodes:
   copy `bootstrap/nodes/k3s-config.yaml` to `/etc/rancher/k3s/config.yaml` first — the
   units run bare `k3s server` / `k3s agent`, all flags live in that file.

   ```bash
   # debian (server)
   curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.34.5+k3s1 sh -s - server
   sudo cat /var/lib/rancher/k3s/server/node-token          # join token — never commit
   kubectl cordon debian   # control-plane runs no workloads (SchedulingDisabled today)

   # k3s-worker-01 (agent)
   curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=v1.34.5+k3s1      K3S_URL=https://192.168.0.112:6443 K3S_TOKEN=<node-token> sh -s - agent
   ```

   Copy `/etc/rancher/k3s/k3s.yaml` from debian to the admin workstation's
   `~/.kube/config` (server → `https://192.168.0.112:6443`).
4. **Restore the sealed-secrets keyring — before ArgoCD exists.** The controller is installed
   *by ArgoCD* (`apps/sealed-secrets`, wave -4) and adopts any key Secrets already present in
   its namespace on first start, so restore them first:

   ```bash
   kubectl create namespace sealed-secrets
   kubectl apply -f <keyring-backup>.yaml   # user-held, password manager — NEVER this repo
   kubectl -n sealed-secrets get secret -l sealedsecrets.bitnami.com/sealed-secrets-key
   ```

   If the controller is already running (keyring restored late), it generated a fresh key —
   restart it so it loads the restored ones:
   `kubectl -n sealed-secrets rollout restart deploy/sealed-secrets-controller`.
   The keyring rotates ~monthly (controller default): re-export after each rotation, or
   secrets sealed after the backup won't decrypt on a rebuild.
5. **ArgoCD initial install** (it then self-manages from `apps/argocd/`; same chart version
   as `apps/argocd/application.yaml`):

   ```bash
   helm repo add argo https://argoproj.github.io/argo-helm && helm repo update
   helm install argocd argo/argo-cd --namespace argocd --create-namespace      --version 10.2.1 -f apps/argocd/values.yaml
   # chart sources ArgoCD cannot discover on its own (one-time registrations):
   argocd login 192.168.0.108:31991 --username admin --insecure      --password "$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d)"
   argocd repo add ghcr.io/actions/actions-runner-controller-charts --type helm --name arc-charts --enable-oci
   argocd repo add https://charts.jenkins.io --type helm --name jenkins
   ```

   The Homelab repo itself needs **no registration or credentials**: every `repoURL` is the
   public `https://github.com/Blacklotus89898/Homelab.git` (switched from `git@` SSH on
   2026-10-21, which had made a deploy key a hidden bootstrap prerequisite). k3s 1.34
   port-forward is unreliable here — use the NodePort (31991).
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
| Nodes | Debian OS, SSH keys, sudoers drop-in, k3s join token | nodes only. **Captured in git (2026-10-21):** `/etc/rancher/k3s/config.yaml`, worker fstab line, `k3s-disk-cleanup` timer/service/script → `bootstrap/nodes/` |
| Cluster bootstrap | sealed-secrets keyring (backed up ✅ 2026-10-21, re-export after rotations), ArgoCD initial install + admin password, OCI/Jenkins chart-repo registrations, `root-app` apply | keyring: password manager; rest: steps 4–6 above |
| GitHub | this repo (obviously), branch protection, PATs (arc-runner/heartbeat, Renovate app, Backstage OAuth app) | user GitHub account |
| UI-state | uptime-kuma monitors, authentik providers, phone ntfy subscriptions, Renovate dashboard state | per-service UI / phone |
| Floaters | juice-shop, guestbook-ui, simple-rust-api, portainer-agent, old uptime-kuma | nowhere — adopt or drop |

Still open (tracked in `ROADMAP.md`): Proxmox VM specs as a captured artifact, and a
rehearsal that turns the ⚠️ steps into verified ones (a throwaway k3d/kind bootstrap from
this repo proves steps 4–7 without touching the real cluster).
