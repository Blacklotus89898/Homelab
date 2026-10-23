#!/bin/sh
# End-to-end check of the Backstage -> Petal trigger (Petal ADR 0003):
#   1. create a scaffolder task for template:default/petal-run as the
#      `automation` service caller (backend.auth.externalAccess),
#   2. wait for the task to finish and read its petal:run outputs,
#   3. confirm Petal recorded the run with Backstage provenance and that the
#      per-entity source filter returns it.
#
# Starts ONE real pipeline run (docker-image: privileged build, pushes to
# ttl.sh for 1h). Needs kubectl (reads the token from the cluster secret).
#
#   sh tools/petal-e2e/run.sh [entity-ref] [pipeline]
set -eu

ENTITY="${1:-component:default/petal}"
PIPELINE="${2:-docker-image}"
BACKSTAGE="${BACKSTAGE_URL:-http://192.168.0.108:30900}"
PETAL="${PETAL_URL:-http://192.168.0.108:30990}"

TOKEN=$(kubectl -n backstage get secret backstage-external-access \
  -o jsonpath='{.data.BACKSTAGE_AUTOMATION_TOKEN}' | base64 -d)

body=$(printf '{"templateRef":"template:default/petal-run","values":{"entity":"%s","pipeline":"%s"}}' "$ENTITY" "$PIPELINE")
task=$(curl -sf -X POST "$BACKSTAGE/api/scaffolder/v2/tasks" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "$body" |
  python -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "scaffolder task: $task"

i=0
while :; do
  status=$(curl -sf "$BACKSTAGE/api/scaffolder/v2/tasks/$task" -H "Authorization: Bearer $TOKEN" |
    python -c 'import json,sys; print(json.load(sys.stdin)["status"])')
  case "$status" in completed|failed|cancelled) break ;; esac
  i=$((i + 1)); [ "$i" -gt 60 ] && { echo "task still $status after 120s"; exit 1; }
  sleep 2
done
echo "task status: $status"

curl -sf "$BACKSTAGE/api/scaffolder/v2/tasks/$task/events" -H "Authorization: Bearer $TOKEN" |
  python -c '
import json,sys
for e in json.load(sys.stdin):
    m = e.get("body",{}).get("message")
    if m: print("  |", m.strip()[:200])
'
[ "$status" = completed ] || exit 1

# The completion event carries the rendered template output; the
# "Open run in Petal" link ends in ?run=<id>.
run=$(curl -sf "$BACKSTAGE/api/scaffolder/v2/tasks/$task/events" -H "Authorization: Bearer $TOKEN" |
  python -c '
import json,sys
for e in json.load(sys.stdin):
    if e.get("type") == "completion":
        for l in e["body"].get("output",{}).get("links",[]):
            if "?run=" in l.get("url",""): print(l["url"].split("?run=")[1])
')
echo "petal run: ${run:-?}  ->  https://petal.lab.home/?run=$run"
[ -n "$run" ] || { echo "no run id in the task output"; exit 1; }

src=$(python -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "backstage:$ENTITY#")
curl -sf "$PETAL/api/runs?source=$src" | python -c '
import json,sys
want = sys.argv[1]
runs = json.load(sys.stdin)
for r in runs[:5]:
    print("  ", r["id"], r["status"], r["trigger_kind"], r["trigger_source"])
hit = [r for r in runs if r["id"] == want]
assert hit, "run %s not returned by the source filter" % want
assert hit[0]["trigger_kind"] == "backstage", hit[0]["trigger_kind"]
print("OK: filter returns", want, "as trigger_kind=backstage")
' "$run"
