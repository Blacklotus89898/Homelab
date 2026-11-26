# Pi-hole (Proxmox CT 107, 192.168.0.53)

LAN DNS for the `.home` names and the `*.lab.home` gateway wildcard. CT 107 has
`startup order=1` on Proxmox, so it boots first. Inside the cluster, CoreDNS forwards
the `home` and `lan` zones here (`infrastructure/coredns-custom`).

| File | What | Source |
|---|---|---|
| `dns-hosts.txt` | 35 A records (UI: Settings → Local DNS → DNS Records) | `dns.hosts`, hand-kept |
| `dnsmasq-lines.txt` | `address=/lab.home/192.168.0.108` wildcard | `misc.dnsmasq_lines`, hand-kept |
| `pihole.toml` | every other setting: upstreams, blocking mode, rate limits, DHCP (off) … | `/etc/pihole/pihole.toml`, secrets redacted |
| `adlists.sql` | blocklists / allowlists, as replayable SQL | `gravity.db` `adlist` |
| `domainlist.sql` | exact and regex allow/deny entries | `gravity.db` `domainlist` |
| `groups.txt`, `clients.txt` | groups and per-client assignments (reference) | `gravity.db` |
| `version.txt`, `lxc-107.conf` | Pi-hole/FTL versions; the container's Proxmox config | `pihole -v`, `pct config 107` |

`dns.cnameRecords` is empty. The admin password and Teleporter backups stay out of git:
both carry the password hash, and this repo is public.

## Capture

From a real terminal at the repo root (it asks for the Proxmox root password, so not a `!` shell):

```bash
hosts/pihole/capture.sh
```

- Read-only on Pi-hole: it reads `pihole.toml` and queries `gravity.db`.
- Password hashes and the TOTP secret are redacted **on the Proxmox host**, so they never
  reach the laptop. The container's free-text Proxmox Notes are dropped too: the Pi-hole
  installer writes its generated admin password there in plain text.
- If anything hash-, key- or password-like survives, the script stops, names the file
  (never the value) and writes nothing.
- It rewrites the generated files above and only *reports* drift for `dns-hosts.txt` and
  `dnsmasq-lines.txt`; update those two by hand when it says they differ.
- Review `git diff` before committing (client comments can carry names).

Re-run it after changing anything in the Pi-hole UI.

## Restore (fresh Pi-hole v6)

Copy the folder to the Proxmox host (`scp -r hosts/pihole root@192.168.0.115:/root/`), then on the host:

```bash
cd /root/pihole
# 1. Settings, minus the redacted keys (FTL fills those with defaults), then a new password.
sed '/<redacted>/d; /^# /d' pihole.toml > /tmp/pihole.toml
pct push 107 /tmp/pihole.toml /etc/pihole/pihole.toml
pct exec 107 -- pihole setpassword          # interactive
pct exec 107 -- systemctl restart pihole-FTL

# 2. Local DNS (already in pihole.toml; these make sure, and are the minimal restore).
hosts=$(awk '!/^#/ && NF {printf "%s\"%s %s\"", (n++ ? "," : "["), $1, $2} END {print "]"}' dns-hosts.txt)
lines=$(awk '!/^#/ && NF {printf "%s\"%s\"", (n++ ? "," : "["), $0} END {print "]"}' dnsmasq-lines.txt)
pct exec 107 -- pihole-FTL --config dns.hosts "$hosts"
pct exec 107 -- pihole-FTL --config misc.dnsmasq_lines "$lines"

# 3. Lists, then rebuild gravity.
for f in adlists.sql domainlist.sql; do
  pct push 107 "$f" "/tmp/$f"
  pct exec 107 -- sh -c "pihole-FTL sqlite3 /etc/pihole/gravity.db < /tmp/$f"
done
pct exec 107 -- pihole -g
```

Groups and clients: recreate by hand from `groups.txt` / `clients.txt` if anything beyond
the Default group exists.

Check: `nslookup worker.home 192.168.0.53` and `nslookup grafana.lab.home 192.168.0.53`
should both return 192.168.0.108, and `pct exec 107 -- pihole-FTL --config dns.hosts | tr ',' '\n' | wc -l` should give 35.

## Istio and the cluster

Pi-hole is outside the mesh, and nothing in it overlaps with cluster DNS: `cluster.local`
stays in CoreDNS, and only `home`/`lan` are forwarded here. ztunnel's DNS proxy
(ambient, Istio 1.30) only answers for ServiceEntries (there are none) and passes
everything else through to CoreDNS unchanged. Pods reaching `https://*.lab.home` go out to
192.168.0.108 and back in through ServiceLB to the gateway, which the
`gateway-front-doors` probe exercises continuously.

**Why the wildcard has one IP.** ServiceLB also listens on the control plane (.112),
but `debian` is cordoned, so the gateway pod can only run on the worker. A second
`address=/lab.home/192.168.0.112` would add nothing while the worker is down. Revisit it if
`debian` is ever made schedulable.

## Notes on the data

- `.local` and `.lan` names (`gitea.local`, `i2p.local`, `jellyfin.lan`, `kavita.lan`,
  `paperless.local`) are older entries. `.local` is reserved for mDNS, so some clients
  won't ask Pi-hole for these names. Prefer `.home`.
- Stale, candidates for removal in the Pi-hole UI: `paperless.local` → .108 (Paperless is
  scaled to 0), `jellyfin.home` → .117 (Jellyfin is reached as `jellyfin.lan` via NPM).
- Several names share an IP on purpose: 192.168.0.119 is the nginx-proxy-manager host, and .103, .116, .117 and .118 each serve more than one name.
- The wildcard catches typos: an unknown `x.lab.home` reaches the gateway and gets a 404,
  not NXDOMAIN.
- Single DNS server: if CT 107 is down, so are LAN names and the pods' `home` lookups.
  `docs/bootstrap.md` phase 2 has the fallback (router as DNS).
