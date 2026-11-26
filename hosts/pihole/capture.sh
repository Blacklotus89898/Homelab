#!/usr/bin/env bash
# Capture Pi-hole CT 107's configuration into hosts/pihole/, without secrets.
#
# Run from a real terminal at the repo root (not a `!` shell): ssh asks once
# for the Proxmox root password (no standing keys, by policy).
#
#   hosts/pihole/capture.sh            # PVE defaults to root@192.168.0.115
#   PVE=root@proxmox.home hosts/pihole/capture.sh
#
# Read-only on Pi-hole: it reads pihole.toml and queries gravity.db. Secrets
# (password hashes, TOTP secret) are redacted ON THE PROXMOX HOST, so they
# never reach this machine; the script then refuses to finish if anything
# secret-looking survived. Review `git diff` before committing: the repo is public.
set -euo pipefail

PVE=${PVE:-root@192.168.0.115}
CT=${CT:-107}
out=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

ssh "$PVE" "CT=$CT bash -s" >"$tmp/capture.tar" <<'REMOTE'
set -euo pipefail
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
x() { pct exec "$CT" -- "$@"; }
q() { x pihole-FTL sqlite3 -batch /etc/pihole/gravity.db "$1"; }

# Settings. Any key named like a secret gets its value replaced.
x cat /etc/pihole/pihole.toml |
  sed -E 's/^([[:space:]]*[A-Za-z_]*(pwhash|password|passwd|secret|token|totp)[A-Za-z_]*[[:space:]]*=[[:space:]]*).*/\1"<redacted>"/I' \
  >"$d/pihole.toml"

# Local DNS, in the formats restore expects (one entry per line).
x pihole-FTL --config dns.hosts | tr -d '[]' | tr ',' '\n' | sed -E 's/^ *"?//; s/"? *$//' | grep . >"$d/dns-hosts.live" || true
x pihole-FTL --config misc.dnsmasq_lines | tr -d '[]' | tr ',' '\n' | sed -E 's/^ *"?//; s/"? *$//' | grep . >"$d/dnsmasq-lines.live" || true
x pihole-FTL --config dns.cnameRecords >"$d/cname-records.live"

# Lists, as SQL that restore can replay into a fresh gravity.db.
q "SELECT 'INSERT OR IGNORE INTO adlist (address, enabled, type, comment) VALUES (' || quote(address) || ', ' || enabled || ', ' || type || ', ' || quote(comment) || ');' FROM adlist ORDER BY id;" >"$d/adlists.sql"
q "SELECT 'INSERT OR IGNORE INTO domainlist (type, domain, enabled, comment) VALUES (' || type || ', ' || quote(domain) || ', ' || enabled || ', ' || quote(comment) || ');' FROM domainlist ORDER BY id;" >"$d/domainlist.sql"
# Groups and clients: reference only (restore by hand if any exist beyond Default).
q "SELECT id || ' | ' || name || ' | enabled=' || enabled || ' | ' || ifnull(description, '') FROM \"group\" ORDER BY id;" >"$d/groups.txt"
q "SELECT ip || ' | ' || ifnull(comment, '') FROM client ORDER BY id;" >"$d/clients.txt"

{ x pihole-FTL --version; x sh -c 'pihole -v 2>/dev/null || true'; } >"$d/version.txt"
# Drop the free-text Notes: the Pi-hole installer writes its generated admin
# password there in plain text.
pct config "$CT" | grep -v '^description:' >"$d/lxc-$CT.conf"

tar -C "$d" -cf - .
REMOTE

mkdir -p "$tmp/x"
tar -C "$tmp/x" -xf "$tmp/capture.tar"

# Second line of defence: nothing hash- or key-like may leave this script.
# Hashes, keys, and plaintext passwords ("password is X", "password: X", "passwd=X"),
# but not pihole.toml's comments about passwords.
if { grep -rlE '\$(BALLOON|argon2|pbkdf2|2[aby]\$)|[0-9a-f]{64}|-----BEGIN' "$tmp/x"
     grep -rniE '^[^#]*pass(word|wd)?([[:space:]]+is[[:space:]]+|[[:space:]]*[:=][[:space:]]*"?)[A-Za-z0-9]' "$tmp/x" |
       grep -v '<redacted>' | cut -d: -f1; } | sort -u >"$tmp/leaks" && [ -s "$tmp/leaks" ]; then
  # File names only: never print the value itself.
  echo "capture.sh: something secret-looking survived redaction in: $(xargs -n1 basename <"$tmp/leaks" | tr '\n' ' ')" >&2
  echo "Nothing written. Extend the redaction sed for that key, then rerun." >&2
  exit 1
fi

stamp=$(date +%F)
# $2 = comment marker: "#" by default, "--" for the .sql files (sqlite has no # comments).
hdr() { printf '%s %s, captured %s by hosts/pihole/capture.sh. Do not edit by hand.\n' "${2:-#}" "$1" "$stamp"; }

{ hdr "Pi-hole FTL settings (/etc/pihole/pihole.toml), secrets redacted"; cat "$tmp/x/pihole.toml"; } >"$out/pihole.toml"
{ hdr "adlists (gravity.db adlist; type 0 = block, 1 = allow)" --; cat "$tmp/x/adlists.sql"; } >"$out/adlists.sql"
{ hdr "allow/deny entries (gravity.db domainlist; type 0 exact allow, 1 exact deny, 2 regex allow, 3 regex deny)" --; cat "$tmp/x/domainlist.sql"; } >"$out/domainlist.sql"
{ hdr "groups: id | name | enabled | description"; cat "$tmp/x/groups.txt"; } >"$out/groups.txt"
{ hdr "clients: ip | comment"; cat "$tmp/x/clients.txt"; } >"$out/clients.txt"
{ hdr "Pi-hole and FTL versions"; cat "$tmp/x/version.txt"; } >"$out/version.txt"
{ hdr "Proxmox LXC config (pct config $CT)"; cat "$tmp/x/lxc-$CT.conf"; } >"$out/lxc-$CT.conf"

# dns-hosts.txt / dnsmasq-lines.txt keep their hand-written headers: only report drift.
diff <(grep -v '^#' "$out/dns-hosts.txt" | sort) <(sort "$tmp/x/dns-hosts.live") >/dev/null &&
  echo "dns-hosts.txt: matches Pi-hole" ||
  { echo "dns-hosts.txt: DIFFERS from Pi-hole, live list:"; cat "$tmp/x/dns-hosts.live"; }
diff <(grep -v '^#' "$out/dnsmasq-lines.txt" | sort) <(sort "$tmp/x/dnsmasq-lines.live") >/dev/null &&
  echo "dnsmasq-lines.txt: matches Pi-hole" ||
  { echo "dnsmasq-lines.txt: DIFFERS from Pi-hole, live lines:"; cat "$tmp/x/dnsmasq-lines.live"; }
echo "cnameRecords: $(cat "$tmp/x/cname-records.live")"
echo "Wrote $out/{pihole.toml,adlists.sql,domainlist.sql,groups.txt,clients.txt,version.txt,lxc-$CT.conf}. Review git diff before committing."
