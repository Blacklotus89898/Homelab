# Proxmox — k3s VM definitions (captured 2026-10-22)

Read-only capture (PVEAuditor API token, `GET /nodes/my/qemu/<id>/config`) so a
rebuild doesn't depend on memory. Host: Proxmox VE 8.4 node `my` (Ryzen 9
5950X, 62.7 GiB). Recreate with `qm create` / the UI using these values; the
SRE review findings (backups, SMR disk, firewall drift) are in the Homelab
roadmap, not here.

| | VM 100 — `debian12` → node **debian** | VM 104 — `vm-instance` → node **k3s-worker-01** |
|---|---|---|
| Role | k3s server (cordoned), 192.168.0.112 | k3s agent (all workloads), 192.168.0.108 |
| CPU | 6 cores, 1 socket, type `host` | 8 cores, 1 socket, type `host` |
| Memory | 12288 MiB (no balloon setting) | 24576 MiB |
| Machine / BIOS | q35 / SeaBIOS (default) | q35 / SeaBIOS (default) |
| Disk | `hard_drive:100/vm-100-disk-0.qcow2`, 32G, virtio-scsi-single, iothread | `hard_drive:104/vm-104-disk-0.qcow2`, 52G, virtio-scsi-single, iothread |
| NIC | net0 virtio `BC:24:11:0C:ED:76` on vmbr0 (firewall=1) | net0 virtio `BC:24:11:8F:CB:EE` on vmbr0 (firewall=1); net1 virtio `BC:24:11:2C:AD:68` on vmbr3 |
| VirtIOFS | — | `virtiofs0: smb_storage,expose-acl=1` → mounted at `/mnt/smb_storage` (fstab: `bootstrap/nodes/worker/fstab.snippet`). ACL/xattr exposure is required for DinD/buildkit (`docs/solutions/virtiofs-xattr-dind-buildkit.md`) |
| Guest agent | enabled | enabled |
| Start at boot | **not set (onboot=0)** — a host reboot leaves the cluster down | **not set (onboot=0)** |
| Install media | `debian-12.11.0-amd64-netinst.iso` | same |

MAC addresses are kept so Pi-hole/router DHCP reservations for .112/.108 keep
matching. Both disks live on `hard_drive` (the single 2 TB SMR disk at ~94%) —
the main hardware risk in the review.
