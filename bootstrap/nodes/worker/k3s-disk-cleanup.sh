#!/bin/sh
# k3s-worker disk hygiene. Runs daily via k3s-disk-cleanup.timer.
# Born from the 2026-09-07 disk-pressure incident: dead containers pinned
# overlayfs snapshots so image prune couldn't reclaim, and the petal DinD
# cache (vfs-era engine layers) ate 14G of the 52G root fs.
set -u

# 1. Dead containers pin snapshots — remove them BEFORE pruning images
k3s crictl ps -a -q --state Exited | while read -r c; do
  k3s crictl -t 5m rm "$c" >/dev/null 2>&1
done

# 2. Prune unused images (-t takes a duration; single blobs can exceed the
#    default deadline — this was the image that always timed out)
k3s crictl -t 15m rmi --prune >/dev/null 2>&1

# 3. Stale petal build cache: only safe to wipe when no dind is running
#    (wiping under a live daemon corrupts its image store)
if ! k3s crictl ps 2>/dev/null | grep -q dind; then
  rm -rf /var/lib/rancher/k3s/storage/pvc-*_petal_petal-docker-lib/* 2>/dev/null
fi

# 4. Cap journald
journalctl --vacuum-size=300M >/dev/null 2>&1

# 5. Leave a trail in the node journal (journalctl -t k3s-disk-cleanup)
logger -t k3s-disk-cleanup "done: $(df -h / | tail -1 | awk '{print $3" used / "$4" free"}')"
