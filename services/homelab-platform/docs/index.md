# homelab-platform

The Homelab GitOps platform repo - the code that drives this cluster. This page is the
fleet-wide scorecard rollup; each service's own TechDocs page carries its details.

## Fleet scorecard (2026-11-05)

| Service | Image pinned | SLO | Recovery | URL |
|---|---|---|---|---|
| argocd | chart `10.2.1` | yes | git | :31991 |
| audiobookshelf | digest-only | no (suspended) | git | :30030 |
| authentik | digest | yes | git | https://auth.lab.home |
| backstage | CI sha tag | yes | git | :30900 |
| heartbeat | `alpine/git:2.54.0` | n/a (is the dead-man switch) | git | - |
| jenkins | retired 2026-10-23 (ADR 0010) | - | git (`archive/apps/`) | - |
| kavita | `0.9.1` + digest | yes | git | :30050 |
| linkding | `1.47.0` + digest | yes | git | :30090 |
| monitoring-stack | chart `0.95.0` | yes (grafana) | git | https://grafana.lab.home |
| ntfy | `v2.28.0` | yes | git | https://ntfy.lab.home |
| opencost | chart `2.5.32` | yes | git | https://opencost.lab.home |
| openobserve | `v0.14.6` | no | git | :30500 |
| paperless | no (deprecated) | no | git (PVs = accepted loss) | - |
| petal | commit-sha tag | yes | git | :30990 |
| tulip | commit-sha tag | yes | git | https://tulip.lab.home |
| uptime-kuma | `2.1.2` | yes | git | https://uptime.lab.home |
| warden | commit-sha tag | yes | git | https://warden.lab.home/map |

Annotation truth lives on each catalog component (`homelab.io/image-pinned`,
`homelab.io/has-slo`, `homelab.io/recovery`) - this table is the human-readable view.

## Platform shape

- App-of-apps root: `bootstrap/root-app.yaml` -> everything in `apps/` reconciles automatically.
- Golden path: Backstage scaffolder template -> PR -> CI gates -> merge -> ArgoCD converges -> catalog ingests.
- CI: GitHub Actions `validate-pr.yaml` (9 jobs incl. strict TechDocs builds) + image builds on GitHub-hosted runners; Petal for cluster pipelines (Jenkins/ARC retired, ADR 0010).

## Operations

```bash
kubectl -n argocd get applications   # fleet sync status
kubectl get nodes                    # node health
```
