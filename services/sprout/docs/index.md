# sprout

Language learning: read, mine, review, speak (Mandarin first)

| Field | Value |
|---|---|
| Namespace | `sprout` |
| Image | `ghcr.io/blacklotus89898/sprout:d15cde3fffeb836f1967e29d7979049aee4e556a` |
| URL | https://sprout.lab.home |
| Health | `/health` |
| Storage | none |
| Source | [Blacklotus89898/Sprout](https://github.com/Blacklotus89898/Sprout) |

## Deploy a new version

The service repo's CI pushes `:<commit sha>`. Bump `image:` in
`services/sprout/deployment.yaml` in a PR, and ArgoCD rolls it out.

## Translation (Claude API key)

The Translate section needs a Claude API key in the SealedSecret
`sprout-anthropic`. Without it, Sprout runs and the section says translation
isn't configured. Seal the key yourself; agents never handle it:

```bash
read -rs KEY   # paste the key, press Enter (not echoed, not in shell history)
kubectl create secret generic sprout-anthropic -n sprout   --from-literal=ANTHROPIC_API_KEY="$KEY" --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller     --controller-namespace sealed-secrets --format yaml > services/sprout/sealed-anthropic.yaml
unset KEY
```

Commit `sealed-anthropic.yaml` in a PR. After the merge, restart the pod so it
reads the key: bump the image or add a template annotation in git. Cost
controls: 30 paid calls per minute across all users, a cache of 500
translations, 1000 characters per request, low effort.

## Operations

```bash
kubectl -n argocd get app sprout                 # Synced / Healthy
kubectl -n sprout get pods,svc
kubectl -n sprout logs deploy/sprout -f
```

Restarts and scaling go through git (Homelab CLAUDE.md: no live `kubectl` edits).
