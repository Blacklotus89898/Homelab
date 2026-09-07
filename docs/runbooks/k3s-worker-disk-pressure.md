# k3s worker disk pressure

## k3s-worker-01 root disk pressure — what's eating space and safe cleanup

## Symptom

`df -h /` on k3s-worker-01 (52G root fs) climbing past 85% → kubelet `ephemeral-storage`
disk-pressure evictions → cluster-wide pod restarts (ArgoCD, backstage, cert-manager
crash-loop; cert-manager-cainjector once showed 62 restarts). Users see "ArgoCD is down" —
the outage is disk pressure, not ArgoCD.

## Where the space goes (2026-09-07 audit, 43G used)

| Path | Size | Notes |
|---|---|---|
| `/var/lib/rancher/k3s/storage/pvc-*_petal_petal-docker-lib` | 14G | Petal DinD layer cache. Stale after executor swap (old vfs-era Dagger engine layers ~8G+). Pure rebuildable cache — safe to wipe whenever the petal pod isn't mid-build |
| `/var/lib/rancher/k3s/agent/containerd/io.containerd.snapshotter.v1.overlayfs` | 14G | Snapshots — grows from dead containers after eviction waves; exited containers pin snapshots, so `crictl rmi --prune` can't reclaim them |
| `…/io.containerd.content.v1.content` | 4.3G | Image blobs |
| `/var/lib/kavita` | 5G | Kavita local data on root fs (media itself is on smb_storage) |
| `/var/log` | 0.5G | journald, regrows between vacuums |

## Cleanup procedure (SSH: `ssh blacklotus@k3s-worker-01`)

```bash
# 1. Stale petal docker cache (only while petal dind is not running a build)
sudo rm -rf /var/lib/rancher/k3s/storage/pvc-*_petal_petal-docker-lib/*

# 2. Dead containers pin snapshots — remove them BEFORE pruning images
sudo k3s crictl ps -a -q --state Exited | while read c; do sudo k3s crictl -t 5m rm $c; done

# 3. Prune unused images. Use a DURATION for -t ("15m", not "600" — parse error otherwise).
#    One blob may hit DeadlineExceeded with the default timeout; find it in the error
#    and `crictl -t 15m rmi <sha>` directly, then re-prune.
sudo k3s crictl -t 15m rmi --prune

# 4. journald
sudo journalctl --vacuum-size=300M
```

Result 2026-09-07: 43G→32G used (88%→65%), 482→421 snapshots, dead images
(python:3.12-slim, jenkins/inbound-agent) reclaimed.

## Gotchas

- `crictl` is `k3s crictl` on this node; `-t` takes Go durations.
- `kubectl` only works on the **server** node — the worker has no admin kubeconfig.
- Petal's PVCs live on local-path = node root fs, so petal build caches directly
  consume the same disk the kubelet evicts on. The `petal-docker-lib` PVC is 15Gi —
  factor that into the 52G budget.
- du while containerd GCs prints races (vanished snapshot dirs) — re-run df after settling.
