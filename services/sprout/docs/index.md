# sprout

Language learning: read, mine, review, speak (Mandarin first)

| Field | Value |
|---|---|
| Namespace | `sprout` |
| Image | `ghcr.io/blacklotus89898/sprout:9b34d51b1bab82626f46d747cbc81a58b42ae3c4` |
| URL | https://sprout.lab.home |
| Health | `/health` |
| Storage | none |
| Source | [Blacklotus89898/Sprout](https://github.com/Blacklotus89898/Sprout) |

## Deploy a new version

The service repo's CI pushes `:<commit sha>`. Bump `image:` in
`services/sprout/deployment.yaml` in a PR, and ArgoCD rolls it out.

## Operations

```bash
kubectl -n argocd get app sprout                 # Synced / Healthy
kubectl -n sprout get pods,svc
kubectl -n sprout logs deploy/sprout -f
```

Restarts and scaling go through git (Homelab CLAUDE.md: no live `kubectl` edits).
