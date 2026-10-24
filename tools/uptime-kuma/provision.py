#!/usr/bin/env python3
"""Provision uptime-kuma from monitors.yaml — idempotent, re-runnable after a rebuild.

uptime-kuma has no declarative config, so this script is its "config as code":
it creates the admin on first run, then makes the live instance match
monitors.yaml (create missing monitors/groups, update drifted ones by name).
Monitors that exist only in the UI are left alone (never deleted).

Usage (from the repo root, kubectl pointed at the cluster):
    pip install uptime-kuma-api pyyaml
    python tools/uptime-kuma/provision.py [--url http://192.168.0.108:30320] [--dry-run] [--prune]

Credentials: KUMA_USERNAME / KUMA_PASSWORD env vars if set (an admin created in
the UI), otherwise the SealedSecret-backed Secret monitoring/uptime-kuma-admin
(infrastructure/uptime-kuma/sealed-admin.yaml) — which is what a rebuild uses to
create the admin on a fresh instance. Never printed.
"""
import argparse
import base64
import json
import os
import pathlib
import subprocess
import sys
import time

import yaml
from uptime_kuma_api import MonitorType, NotificationType, UptimeKumaApi
from uptime_kuma_api.api import Event, _check_arguments_monitor, _convert_monitor_input

HERE = pathlib.Path(__file__).resolve().parent
TYPES = {"http": MonitorType.HTTP, "port": MonitorType.PORT, "dns": MonitorType.DNS}


def secret_field(field: str) -> str:
    raw = subprocess.run(
        ["kubectl", "-n", "monitoring", "get", "secret", "uptime-kuma-admin",
         "-o", f"jsonpath={{.data.{field}}}"],
        check=True, capture_output=True, text=True).stdout
    return base64.b64decode(raw).decode()


def monitor_fields(m: dict, defaults: dict, group: dict, parent_id, notif_id) -> dict:
    kind = m["type"]
    f = {
        "type": TYPES[kind],
        "name": m["name"],
        "parent": parent_id,
        "interval": group.get("interval", defaults["interval"]),
        "retryInterval": defaults["retryInterval"],
        "maxretries": defaults["retries"],
        # notify: false = visible on the status page, never pages (offline/legacy hosts)
        "notificationIDList": [] if m.get("notify") is False else [notif_id],
        "description": m.get("note", ""),
    }
    if kind == "http":
        f.update(url=m["url"], ignoreTls=m.get("ignore_tls", False), maxredirects=0,
                 accepted_statuscodes=m.get("http_codes", defaults["http_codes"]))
    elif kind == "port":
        f.update(hostname=m["hostname"], port=m["port"])
    elif kind == "dns":
        f.update(hostname=m["hostname"], dns_resolve_server=m["dns_resolve_server"],
                 dns_resolve_type="A", port=53)
    return f


def connect(url: str, attempts: int = 12) -> UptimeKumaApi:
    """A freshly started uptime-kuma accepts the socket before its handlers are
    ready (first call times out, observed on 2.1.2) — retry until it answers."""
    for i in range(attempts):
        api = UptimeKumaApi(url, timeout=10)
        try:
            api.need_setup()
            api.timeout = 30
            return api
        except Exception:  # noqa: BLE001 — socketio TimeoutError while booting
            api.disconnect()
            if i == attempts - 1:
                raise
            time.sleep(5)
    raise RuntimeError("unreachable")


def add_monitor_v2(api: UptimeKumaApi, **kwargs) -> dict:
    """uptime-kuma-api 1.2.1 targets 1.x; 2.x added a NOT NULL `conditions`
    column the library never sends. Same code path as api.add_monitor, plus it."""
    data = api._build_monitor_data(**kwargs)
    _convert_monitor_input(data)
    _check_arguments_monitor(data)
    data.setdefault("conditions", [])  # a list — the server JSON-encodes it (a "[]" string breaks DNS monitors)
    with api.wait_for_event(Event.MONITOR_LIST):
        return api._call("add", data)


def save_status_page_v2(api: UptimeKumaApi, slug: str, title: str, groups: list) -> None:
    """The library's save_status_page reads an `incident` key that 2.x renamed;
    send saveStatusPage directly with the library's own payload builder."""
    cfg = api._call("getStatusPage", slug)["config"]
    data = api._build_status_page_data(
        slug=slug, id=cfg["id"], title=title, description=cfg.get("description"),
        showCertificateExpiry=True, publicGroupList=groups)
    api._call("saveStatusPage", data)


def drifted(live: dict, want: dict) -> bool:
    for k, v in want.items():
        if k in ("type", "notificationIDList"):
            continue
        if live.get(k) != v:
            return True
    return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://192.168.0.108:30320")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--prune", action="store_true",
                    help="delete monitors in managed groups that are gone from monitors.yaml")
    args = ap.parse_args()
    spec = yaml.safe_load((HERE / "monitors.yaml").read_text(encoding="utf-8"))
    user = os.environ.get("KUMA_USERNAME") or secret_field("username")
    pw = os.environ.get("KUMA_PASSWORD") or secret_field("password")

    api = connect(args.url)
    try:
        if api.need_setup():
            print("first run: creating admin user")
            if not args.dry_run:
                api.setup(user, pw)
        try:
            api.login(user, pw)
        except Exception as e:  # noqa: BLE001 — surface a usable hint, not a stack trace
            print(f"login failed for user '{user}': {e}. "
                  "An admin already exists that is not the sealed one: set KUMA_USERNAME / "
                  "KUMA_PASSWORD to that account and re-run.", file=sys.stderr)
            return 2

        if not args.dry_run:
            s = spec["settings"]
            cur = api.get_settings()
            if cur.get("keepDataPeriodDays") != s["keepDataPeriodDays"] or cur.get("primaryBaseURL") != s["primaryBaseURL"]:
                api.set_settings(password=pw, keepDataPeriodDays=s["keepDataPeriodDays"],
                                 primaryBaseURL=s["primaryBaseURL"])
                print(f"settings: retention {s['keepDataPeriodDays']}d, base URL {s['primaryBaseURL']}")

        n = spec["notification"]
        notif = next((x for x in api.get_notifications() if x["name"] == n["name"]), None)
        if notif is None:
            print(f"notification: create {n['name']}")
            notif_id = None if args.dry_run else api.add_notification(
                name=n["name"], type=NotificationType.NTFY, isDefault=True, applyExisting=False,
                ntfyserverurl=n["ntfyserverurl"], ntfytopic=n["ntfytopic"],
                ntfyPriority=n["ntfyPriority"])["id"]
        else:
            notif_id = notif["id"]

        live = {m["name"]: m for m in api.get_monitors()}
        created = updated = unchanged = 0
        page_groups = []
        for g in spec["groups"]:
            grp = live.get(g["name"])
            if grp is None:
                print(f"group: create {g['name']}")
                gid = None if args.dry_run else add_monitor_v2(api, type=MonitorType.GROUP, name=g["name"])["monitorID"]
            else:
                gid = grp["id"]
            ids = []
            for m in g["monitors"]:
                want = monitor_fields(m, spec["defaults"], g, gid, notif_id)
                cur = live.get(m["name"])
                if cur is None:
                    print(f"  + {m['name']}")
                    if not args.dry_run:
                        ids.append(add_monitor_v2(api, **want)["monitorID"])
                    created += 1
                elif drifted(cur, want):
                    print(f"  ~ {m['name']}")
                    if not args.dry_run:
                        api.edit_monitor(cur["id"], **want)
                    ids.append(cur["id"])
                    updated += 1
                else:
                    ids.append(cur["id"])
                    unchanged += 1
            page_groups.append({"name": g["name"], "monitorList": [{"id": i} for i in ids]})

        # --prune: delete monitors that sit inside a MANAGED group but are no
        # longer in monitors.yaml (e.g. a retired service). Monitors outside the
        # managed groups are never touched — hand-made checks survive.
        pruned = 0
        if args.prune:
            group_ids = {live[g["name"]]["id"] for g in spec["groups"] if g["name"] in live}
            wanted = {m["name"] for g in spec["groups"] for m in g["monitors"]}
            for m in live.values():
                if m.get("parent") in group_ids and m["name"] not in wanted:
                    print(f"  - {m['name']}")
                    if not args.dry_run:
                        api.delete_monitor(m["id"])
                    pruned += 1

        sp = spec["status_page"]
        if not args.dry_run:
            if sp["slug"] not in {p["slug"] for p in api.get_status_pages()}:
                api.add_status_page(sp["slug"], sp["title"])
                print(f"status page: create /status/{sp['slug']}")
            save_status_page_v2(api, sp["slug"], sp["title"], page_groups)

        print(json.dumps({"created": created, "updated": updated, "unchanged": unchanged,
                          "pruned": pruned, "dry_run": args.dry_run}))
        return 0
    finally:
        api.disconnect()


if __name__ == "__main__":
    sys.exit(main())
