# Pi-hole (Proxmox CT 107, 192.168.0.53)

LAN DNS for the `.home` names and the `*.lab.home` gateway wildcard. CT 107 has
`startup order=1` on Proxmox, so it boots first.

| File | Pi-hole setting | Contents |
|---|---|---|
| `dns-hosts.txt` | `dns.hosts` | 35 A records (UI: Settings → Local DNS → DNS Records) |
| `dnsmasq-lines.txt` | `misc.dnsmasq_lines` | `address=/lab.home/192.168.0.108` wildcard |

`dns.cnameRecords` is empty. No secrets live here. The admin password and any
Teleporter backup stay out of git, because a Teleporter backup includes the password hash.

## Re-capture

Run this from a real terminal. It asks for the Proxmox root password, so it won't work from a `!` shell.

```bash
ssh root@192.168.0.115 "pct exec 107 -- sh -c 'pihole-FTL --config dns.hosts; pihole-FTL --config dns.cnameRecords; pihole-FTL --config misc.dnsmasq_lines'"
```

Rewrite the files from the output, one `IP name` pair per line.

## Restore (fresh Pi-hole v6)

Copy both files to the Proxmox host first, for example
`scp hosts/pihole/*.txt root@192.168.0.115:/root/`. Then run on the host:

```bash
hosts=$(awk '!/^#/ && NF {printf "%s\"%s %s\"", (n++ ? "," : "["), $1, $2} END {print "]"}' /root/dns-hosts.txt)
lines=$(awk '!/^#/ && NF {printf "%s\"%s\"", (n++ ? "," : "["), $0} END {print "]"}' /root/dnsmasq-lines.txt)
pct exec 107 -- pihole-FTL --config dns.hosts "$hosts"
pct exec 107 -- pihole-FTL --config misc.dnsmasq_lines "$lines"
pct exec 107 -- pihole-FTL --config dns.hosts | tr ',' '\n' | wc -l   # expect 35
```

Check: `nslookup worker.home 192.168.0.53` and `nslookup grafana.lab.home 192.168.0.53`
should both return 192.168.0.108.

## Notes on the data

- `.local` and `.lan` names (`gitea.local`, `i2p.local`, `jellyfin.lan`, `kavita.lan`,
  `paperless.local`) are older entries. `.local` is reserved for mDNS, so some clients
  won't ask Pi-hole for these names. Prefer `.home`.
- `paperless.local` → .108: Paperless is deprecated and scaled to 0 in the cluster.
- Several names share an IP on purpose: 192.168.0.119 is the nginx-proxy-manager host, and .103, .116, .117 and .118 each serve more than one name.
