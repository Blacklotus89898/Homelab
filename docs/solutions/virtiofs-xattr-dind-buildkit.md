# virtiofs xattr dind buildkit

## dind/buildkit fails with "operation not supported" on virtiofs without xattr

## Symptom

Docker-in-Docker buildx builds fail at any `COPY --from=<stage>` (multi-stage copy-out) with:

```
failed to compute cache key: failed to calculate checksum of ref ...:
failed to create hash for /src/...: operation not supported
```

Plain `RUN`/`COPY` inside stages work fine. Kernel `mount -t overlay` on the same mount fails with `upper fs does not support tmpfile / upper fs missing required features`.

## Root cause

The virtiofs share (Proxmox → guest, `/mnt/smb_storage`) was mounted **without xattr support**. fuse-overlayfs (the dind storage driver) stores overlay metadata in extended attributes on the upper layer; without xattr it works for basic ops but breaks exactly when buildkit copies files out of a stage snapshot (hash/copy-out path needs the metadata ops). overlayfs-over-virtiofs (native overlay2) also needs tmpfile+xattr, so `overlay2` on the share is impossible until this is fixed.

## Fix

Proxmox: VM → Hardware → VirtIOFS share → Edit → enable **xattr** (needs VM stop/start — hardware changes don't apply live). Then remount (fstab survives) and verify:

```sh
python3 -c "import os; os.setxattr('/mnt/smb_storage/f', b'user.test', b'x'); print(os.getxattr('/mnt/smb_storage/f', b'user.test'))"
```

## Alternatives if xattr can't be enabled

- dind `--storage-driver=vfs`: always works, slow (deep-copies layers), heavy disk
- docker-lib on local ext4 + overlay2: fast, but build cache competes with the root fs (disk-pressure history on k3s-worker-01 — see [[k3s-worker-disk-pressure]])

## Related

- k3s-worker-01 petal dind: `services/petal/deployment.yaml`, docker-lib hostPath on smb_storage
- Related runbook: runbooks/k3s-worker-disk-pressure.md
