# homelab-platform

The Homelab GitOps platform repo - the code that drives this cluster. This page is the
fleet-wide scorecard rollup; each service's own TechDocs page carries its details.

## Fleet scorecard (2026-10-14)

| Service | Image pinned | SLO | Recovery | URL |
|---|---|---|---|---|
| argocd | chart `10.2.1` | yes | git | :31991 |
| audiobookshelf | digest-only | no (suspended) | git | :30030 |
| authentik | `2025.2.4` | no (postgres parked) | git | :30080 |
| backstage | CI sha tag | yes | git | :30900 |
| jenkins | chart `*` floats | no | git | :30808 |
| kavita | `0.9.1` + digest | yes | git | :30050 |
| linkding | `1.46.2` + digest | yes | git | :30090 |
| openobserve | `v0.14.6` | no | git | :30500 |
| paperless | no (deprecated) | no | git (PVs = accepted loss) | - |
| petal | commit-sha tag | yes | git | :30990 |

Annotation truth lives on each catalog component (`homelab.io/image-pinned`,
`homelab.io/has-slo`, `homelab.io/recovery`) - this table is the human-readable view.

## Platform shape

- App-of-apps root: `bootstrap/root-app.yaml` -> everything in `apps/` reconciles automatically.
- Golden path: Backstage scaffolder template -> PR -> CI gates -> merge -> ArgoCD converges -> catalog ingests.
- CI: GitHub Actions `validate-pr.yaml` (9 jobs incl. strict TechDocs builds) + Jenkins for image builds.

## Operations

```bash
kubectl -n argocd get applications   # fleet sync status
kubectl get nodes                    # node health
```
