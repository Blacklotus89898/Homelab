---
description: Cluster + GitOps health one-pager
---

Produce a homelab health report. Run these, then summarize:

1. `kubectl get nodes`
2. `kubectl get pods -A` — surface anything not Running/Completed, plus anything with high RESTARTS
3. `kubectl -n argocd get applications` — anything OutOfSync or Unhealthy
4. `kubectl get events -A --sort-by=.lastTimestamp` — last ~20, warnings only
5. `ssh debian.home "uptime; df -h / | tail -1"` and `ssh k3s-worker-01 "uptime; df -h / | tail -1"`

Output format: a compact status table, then a "⚠ Anomalies" section (or "no anomalies"). For each anomaly, `search_knowledge` with its signature and cite any matching runbook with its path. Do not fix anything — report only, with proposed next steps.
