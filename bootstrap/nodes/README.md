# Node configuration (captured from the live nodes)

Node-level state that ArgoCD cannot reconcile. Captured verbatim from `debian` and
`k3s-worker-01` on 2026-10-21 so a rebuild does not depend on memory. These files are
**not applied by anything** — `docs/bootstrap.md` steps 2–3 install them by hand.

| File | Install to | Node |
|---|---|---|
| `server/k3s-config.yaml` | `/etc/rancher/k3s/config.yaml` | debian (server) |
| `worker/k3s-config.yaml` | `/etc/rancher/k3s/config.yaml` | worker (agent) |
| `worker/fstab.snippet` | append to `/etc/fstab` | worker |
| `worker/k3s-disk-cleanup.sh` | `/usr/local/bin/k3s-disk-cleanup.sh` (`chmod 755`) | worker |
| `worker/k3s-disk-cleanup.{service,timer}` | `/etc/systemd/system/`, then `systemctl enable --now k3s-disk-cleanup.timer` | worker |

## Not captured (and why)

- **k3s join token / agent env** (`/etc/systemd/system/k3s-agent.service.env`:
  `K3S_URL`, `K3S_TOKEN`) — secret. A rebuild generates a new one on the server
  (`/var/lib/rancher/k3s/server/node-token`).
- **`/etc/sudoers.d/900-claude-ops`** (debian) — root-only readable. Scope (documented in
  `CLAUDE.md`): passwordless `kubectl`, `journalctl`, `systemctl` for `blacklotus`.
  Recreate with `visudo -f /etc/sudoers.d/900-claude-ops`.
- **Proxmox VM definitions** — user-held host access; see `docs/bootstrap.md` step 1.

## Known drift in the captured script

`k3s-disk-cleanup.sh` step 3 wipes `pvc-*_petal_petal-docker-lib` — that PVC was deleted on
2026-09-07 when the DinD cache moved to the hostPath `/mnt/smb_storage/petal-docker-lib`, so
the step is a harmless no-op today. It is kept verbatim (this directory mirrors what the node
runs); fix it on the node and here together. The in-cluster `node-image-prune` CronJobs
(`apps/node-prune`) overlap with step 2 — keep both until one is retired deliberately.

## Recapturing

All of these are readable without sudo (except the two secret/root-only items above):

```bash
ssh debian.home 'cat /etc/rancher/k3s/config.yaml'
ssh k3s-worker-01 'cat /etc/rancher/k3s/config.yaml; grep virtiofs /etc/fstab;
  systemctl cat k3s-disk-cleanup.timer k3s-disk-cleanup.service;
  cat /usr/local/bin/k3s-disk-cleanup.sh'
```
