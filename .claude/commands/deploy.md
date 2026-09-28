---
description: Push and watch an ArgoCD app sync to healthy
argument-hint: [app]
---

Deploy $ARGUMENTS through the GitOps flow:

1. `git status` — if there are uncommitted changes, show them and ask before committing; otherwise confirm we're deploying committed state.
2. `git push` (if there's anything to push).
3. Watch convergence: `kubectl -n argocd wait --for=jsonpath='{.status.health.status}'=Healthy app/$ARGUMENTS --timeout=300s` (poll `kubectl -n argocd get app $ARGUMENTS` if wait isn't supported for this shape).
4. Verify the workloads: pods and recent events in the app's target namespace.
5. If sync is stuck or health is degraded: `kubectl -n argocd describe app $ARGUMENTS`, `kubectl diff`, logs of failing pods, then `search_knowledge` with the exact error signature before proposing a fix. Fixes are git edits — never `kubectl apply`.

Report: sync status before → after, what changed, workload health.
