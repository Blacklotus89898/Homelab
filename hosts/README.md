# Hosts outside the cluster

Config for machines ArgoCD doesn't manage, captured so a rebuild doesn't depend
on memory. Nothing here is applied automatically.

| Path | Host | Restore |
|---|---|---|
| `glance/` | Glance dashboard, Proxmox LXC 116 (192.168.0.118, `glance.home`), Docker | copy `glance.yml` to `/root/glance/config/`, `docker-compose.yml` to `/root/glance/`, plus `lab-root-ca.crt` (from `kubectl -n cert-manager get secret lab-root-ca -o jsonpath='{.data.ca\.crt}' \| base64 -d`); `docker compose up -d` |
| `proxmox/k3s-vms.md` | the two k3s VMs on Proxmox node `my` | recreate per the table (docs/bootstrap.md step 1) |

Glance gotchas (KB `solutions/`): `${VAR}` is expanded everywhere in the file,
comments included, and an unset one stops Glance from starting; `config:validate`
always exits 0, so read its output. Re-capture after editing on the host:
`scp root@glance.home:/root/glance/config/glance.yml hosts/glance/`.
