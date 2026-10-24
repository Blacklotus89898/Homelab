# Homelab — Claude Code Instructions

## What this repo is

GitOps source of truth for a k3s cluster. ArgoCD (app-of-apps, root at `bootstrap/root-app.yaml`) reconciles everything in `apps/` automatically.

**The one rule: all cluster changes go through git commit → push → ArgoCD sync.** Never `kubectl apply`/`kubectl edit`/`kubectl scale` live objects outside `bootstrap/` — ArgoCD will revert out-of-band changes. Diagnose with kubectl freely; change via git only.

## Cluster facts (verified 2026-10-23)

- Nodes: `debian` (control-plane, SchedulingDisabled) = **192.168.0.112**; `k3s-worker-01` = **192.168.0.108**. k3s v1.34.5+k3s1, containerd, Debian 12.
- SSH (key auth via Windows ssh-agent): `ssh debian.home`, `ssh k3s-worker-01`, `ssh ubuntu.home` — user `blacklotus`.
- kubectl: local kubeconfig `~/.kube/config`, cluster-admin, server `https://192.168.0.112:6443`.
- Passwordless sudo on debian only: `kubectl`, `journalctl`, `systemctl` (see `/etc/sudoers.d/900-claude-ops`; k3s kubectl is `/usr/local/bin/kubectl`).
- Node-level ops on the worker (no sudo there): one-shot busybox pod with explicit `nodeName` + `hostPath` mount — bypasses the scheduler/cordon. Ship files via ConfigMap (`--from-file`), never by embedding content in YAML.
- k3s CNI paths are nonstandard: binaries `/var/lib/rancher/k3s/data/cni`, config `/var/lib/rancher/k3s/agent/etc/cni/net.d`.
- StorageClass `local-path`. ArgoCD UI: http://192.168.0.108:31991 or https://argocd.lab.home.
- Front door (ADR 0009): Istio gateway on 80/443 (ServiceLB; traefik disabled), `https://<svc>.lab.home`, routes in `platform/gateways/routes.yaml`.
- Hosts outside the cluster (Glance LXC, Proxmox VM specs): `hosts/`.
- Offline/legacy: 192.168.0.103, 192.168.0.101 (pi).

## Verifying changes

```bash
kubectl get nodes                                   # node health
kubectl -n argocd get applications                  # sync status of everything
kubectl -n argocd get app <name> -w                 # watch one app converge
kubectl get events -A --sort-by=.lastTimestamp | tail -20
```

## Conventions

- Commit messages: conventional commits (`docs:`, `feat:`, `fix:`, `chore:`). release-please manages versions — never hand-tag.
- Secrets: `.env` is gitignored and stays out. Nothing secret-shaped goes into manifests or commit messages — flag to the user instead.
- `todo.md` holds open work (gitignored). Solutions belong in the knowledge base, not the todo.

## Tulip — the approval boundary (non-negotiable)

Tulip (`github.com/Blacklotus89898/Tulip`, ns `tulip`) trades only with the operator's approval (Tulip ADR 0002 §3). With cluster-admin you *could* reach around that gate, so these are hard rules:
- **Never** read `tulip-approval-*` secrets (or `TULIP_APPROVAL_PASSPHRASE_HASH`), and never ask the user for their passphrase.
- **Never** call Tulip's `/approve/…` or `/killswitch` endpoints, and never approve, disarm or "click through" on the user's behalf — not even "to test".
- Through MCP you may read (incl. `broker_account`), `propose`, `review_suggestion`, `decline`, `kill_switch_arm` and `cycle_run`. That is the whole surface.
- **Questrade (co-pilot, Tulip ADR 0003):** never read the `tulip-questrade` secret, the rotated token under Tulip's `/data`, or use any Questrade token outside Tulip — refresh tokens are single-use, so one stray refresh silently breaks Tulip's chain. Never ask the user to paste a token; they seal it themselves. Tulip is read-only on Questrade; the user places every order.

## Knowledge base — use it in every session

The `knowledge` MCP tools are connected at user scope; their full usage rules live in DaVinci's `AGENTS.md`. Condensed:

- **Before** answering any ops/SRE question or touching a failing component: `search_knowledge` with concrete terms (error strings, pod names, commands). Cite the source path you used.
- **After** solving anything non-trivial: `write_knowledge` (heading required) with symptom / root cause / exact fix / prevention.
- Scripts and one-liners go in `tools/<name>.md` (retrieved via `get_tool`), runbooks in `runbooks/`, environment facts in `environment/`.
- Never store todos or speculation — they pollute retrieval.

## Roadmap — start here for improvement work

**`docs/ROADMAP.md`** is the canonical, living plan (phases, status, standing constraints, decision log). For any "improve the homelab / what's next" work: read it first, take the next unchecked item, and when done update the file (status, decision log) and commit — that file is the project's memory across sessions. Disk space is the first-class constraint; see the roadmap's "Standing constraints".

## Useful commands

- `/status` — cluster + GitOps health one-pager
- `/deploy <app>` — push and watch an app sync to healthy
