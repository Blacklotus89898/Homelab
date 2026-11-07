"""Render templates/homelab-service from THIS checkout through the live Backstage
scaffolder dry-run. Nothing is pushed: publish steps only report.

usage:
  export BACKSTAGE_TOKEN=$(kubectl -n backstage get secret backstage-external-access \
      -o jsonpath='{.data.BACKSTAGE_AUTOMATION_TOKEN}' | base64 -d)
  python tools/scaffolder-dry-run/dryrun.py . /tmp/render sprout '{"name":"sprout", ...}'
Then run yamllint and kubeconform on the files under /tmp/render/<case>/
(the kubeconform command is in docs/guides/onboarding-a-service.md §3).
"""
import base64
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

import yaml

root, out, case, values = sys.argv[1], sys.argv[2], sys.argv[3], json.loads(sys.argv[4])

tdir = pathlib.Path(root, "templates", "homelab-service")
template = yaml.safe_load((tdir / "template.yaml").read_text(encoding="utf-8"))
files = [
    {"path": p.relative_to(tdir).as_posix(), "base64Content": base64.b64encode(p.read_bytes()).decode()}
    for p in (tdir / "skeleton").rglob("*")
    if p.is_file()
]

body = json.dumps({"template": template, "values": values, "secrets": {}, "directoryContents": files}).encode()
req = urllib.request.Request(
    os.environ.get("BACKSTAGE_URL", "http://192.168.0.108:30900") + "/api/scaffolder/v2/dry-run",
    data=body,
    method="POST",
    headers={"Content-Type": "application/json", "Authorization": "Bearer " + os.environ["BACKSTAGE_TOKEN"]},
)
try:
    res = json.load(urllib.request.urlopen(req, timeout=120))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:3000])
    sys.exit(1)

for line in res.get("log", []):
    b = line.get("body", {})
    if b.get("status") == "failed" or "rror" in str(b.get("message", "")):
        print("LOG:", b.get("stepId"), b.get("status"), str(b.get("message"))[:800])

dest = pathlib.Path(out, case)
for f in res.get("directoryContents", []):
    p = dest / f["path"]
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_bytes(base64.b64decode(f["base64Content"]))
    print("rendered:", f["path"])
print("output:", json.dumps(res.get("output", {}))[:600])
