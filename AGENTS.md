# AGENTS.md — Homelab

Guide for any coding agent (Claude Code, Codex, Cursor, Copilot, Gemini…) and human contributor.

## What this repo is

GitOps source of truth for a k3s cluster. ArgoCD (app-of-apps, root at `bootstrap/root-app.yaml`)
reconciles everything in `apps/` automatically. Sibling repos (Petal, Tulip, Warden, Sprout,
DaVinci) ship code and images; this repo decides how they run.

**The one rule: all cluster changes go through git commit → push → ArgoCD sync.** Never
`kubectl apply`/`edit`/`scale` live objects outside `bootstrap/` — ArgoCD reverts out-of-band
changes. Diagnose with kubectl freely; change via git only.

Read first: `docs/overview.md` → `docs/architecture.md` → `docs/adr/` → **`docs/ROADMAP.md`**
(the canonical living plan and decision log — start here for any "what's next" work, and update it
when an item is done). Disk space is the first-class constraint (see the roadmap's "Standing constraints").

## Layout

```
bootstrap/        root app + what must exist before ArgoCD (only place kubectl apply is allowed)
apps/<name>/      ArgoCD Application per app (application.yaml / values.yaml)
services/<name>/  manifests for services we build (deployment pinned to :<sha>, SealedSecrets, scrape, docs/)
infrastructure/   cluster-level jobs (heartbeat, pod-cleanup, node-prune…)
platform/         gateways + routes (platform/gateways/routes.yaml), shared platform config
policies/         Kyverno policies (CI-enforced, not installed in-cluster)
catalog/          Backstage catalog entities; backstage/ = the portal itself
templates/        Backstage scaffolder templates (homelab-service, petal-run)
hosts/            things outside the cluster (Glance LXC, Proxmox VM specs)
environments/, clusters/   overlays / per-cluster config
docs/             overview, architecture, adr/, guides/, runbooks/, ROADMAP.md
tools/            operator tooling (e.g. uptime-kuma monitors)
archive/          retired config — don't modify or depend on it
```

## Cluster facts (verified 2026-10-23)

- Nodes: `debian` (control-plane, SchedulingDisabled) = **192.168.0.112**; `k3s-worker-01` = **192.168.0.108**. k3s v1.34.5+k3s1, containerd, Debian 12.
- SSH (key auth via ssh-agent): `ssh debian.home`, `ssh k3s-worker-01`, `ssh ubuntu.home` — user `blacklotus`.
- kubectl: local kubeconfig `~/.kube/config`, cluster-admin, server `https://192.168.0.112:6443`.
- Passwordless sudo on debian only: `kubectl`, `journalctl`, `systemctl` (`/etc/sudoers.d/900-claude-ops`; k3s kubectl is `/usr/local/bin/kubectl`).
- Node-level ops on the worker (no sudo there): one-shot busybox pod with explicit `nodeName` + `hostPath` mount. Ship files via ConfigMap (`--from-file`), never by embedding content in YAML.
- k3s CNI paths are nonstandard: binaries `/var/lib/rancher/k3s/data/cni`, config `/var/lib/rancher/k3s/agent/etc/cni/net.d`.
- StorageClass `local-path`. ArgoCD UI: http://192.168.0.108:31991 or https://argocd.lab.home.
- Front door (ADR 0009): Istio gateway on 80/443 (ServiceLB; traefik disabled), `https://<svc>.lab.home`, routes in `platform/gateways/routes.yaml`.
- Proxmox host: password auth only, held by the user — no standing keys by policy; never install one.
- Offline/legacy: 192.168.0.103, 192.168.0.101 (pi).

## Verifying changes

```bash
kubectl get nodes                                   # node health
kubectl -n argocd get applications                  # sync status of everything
kubectl -n argocd get app <name> -w                 # watch one app converge
kubectl get events -A --sort-by=.lastTimestamp | tail -20
```

PR checks (`.github/workflows/validate-pr.yaml`, must be green): yamllint, kubeconform +
kustomize render, Kyverno policies (no `:latest`, resources and probes required), Helm templates,
TechDocs builds, NodePort conflict check, Trivy.

## Adding a feature or service

- **New service:** follow `docs/guides/onboarding-a-service.md` step by step (written from real
  traps). Shape: the service repo owns code, image CI (`ghcr.io/blacklotus89898/<name>:<sha>`) and
  ADRs; Homelab owns `apps/<name>/application.yaml`, `services/<name>/`, the route, monitoring and
  `catalog/components/<name>.yaml`. The Backstage template `templates/homelab-service` scaffolds it.
- **Deploying a new image:** bump the SHA in `services/<name>/` — never `:latest`.
- **Platform change:** branch, edit manifests, PR, let `Validate PR` pass, merge, then watch the
  ArgoCD app converge (commands above). Decisions → new ADR in `docs/adr/`; roadmap item → tick it
  and add to the decision log in `docs/ROADMAP.md`.

## Conventions

- Conventional commits (`docs:`, `feat:`, `fix:`, `chore:`); release-please manages versions — never hand-tag.
- Secrets: SealedSecrets only (`kubeseal`). `.env` is gitignored. Nothing secret-shaped in manifests or
  commit messages — this repo is public; flag it to the user instead.
- `todo.md` holds open work (gitignored). Solutions belong in the knowledge base, not the todo.

## Tulip — the approval boundary (non-negotiable)

Tulip (ns `tulip`) trades only with the operator's approval (Tulip ADR 0002 §3). With cluster-admin
you *could* reach around that gate, so these are hard rules:
- **Never** read `tulip-approval-*` secrets (or `TULIP_APPROVAL_PASSPHRASE_HASH`), and never ask the user for their passphrase.
- **Never** call Tulip's `/approve/…` or `/killswitch` endpoints, and never approve, disarm or "click through" on the user's behalf — not even "to test".
- Paper training (Tulip ADR 0005): `TULIP_AUTOEXECUTE=paper` is the operator's setting — it auto-fills only the loop's own rules suggestions in the paper book. Never enable it beyond paper mode, never extend it to MCP/brain proposals, and never use `propose` expecting it to fill.
- Through MCP you may read (incl. `broker_account`, `rebalance_preview`, `scorecard`), `propose` (a justification is required), `review_suggestion`, `decline`, `kill_switch_arm` and `cycle_run`. That is the whole surface.
- **Questrade (co-pilot, Tulip ADR 0003):** never read the `tulip-questrade` secret, the rotated token under Tulip's `/data`, or use any Questrade token outside Tulip — refresh tokens are single-use, so one stray refresh silently breaks Tulip's chain. Never ask the user to paste a token; they seal it themselves. Tulip is read-only on Questrade; the user places every order.

## Knowledge base — use it in every session

If the `knowledge` MCP (DaVinci) is connected — full rules in DaVinci's `AGENTS.md`:

- **Before** answering any ops/SRE question or touching a failing component: `search_knowledge` with concrete terms (error strings, pod names, commands). Cite the source path you used.
- **After** solving anything non-trivial: `write_knowledge` (heading required) with symptom / root cause / exact fix / prevention.
- Scripts and one-liners go in `tools/<name>.md` (retrieved via `get_tool`), runbooks in `runbooks/`, environment facts in `environment/`.
- Never store todos or speculation — they pollute retrieval.
