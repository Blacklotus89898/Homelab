# sprout

Language learning: read, mine, review, speak (Mandarin first)

| Field | Value |
|---|---|
| Namespace | `sprout` |
| Image | `ghcr.io/blacklotus89898/sprout:6eb8f3efdfae0ff832491c3523f149debc0376a1` |
| URL | https://sprout.lab.home |
| Health | `/health` |
| Storage | none |
| Source | [Blacklotus89898/Sprout](https://github.com/Blacklotus89898/Sprout) |

## Deploy a new version

The service repo's CI pushes `:<commit sha>`. Bump `image:` in
`services/sprout/deployment.yaml` in a PR, and ArgoCD rolls it out.

## Translation (Google Translate API key)

Translate uses the Google Cloud Translation API (Basic): the first 500k
characters a month are free, then $20 per million. Word colors come from the
CC-CEDICT dictionary, with no AI (Sprout ADR 0002). Without the key, Sprout runs
and the section says translation isn't configured.

1. In Google Cloud: enable the **Cloud Translation API**, then go to
   Credentials, **Create API key**, and **restrict it to the Cloud Translation
   API**. Billing must be on for the project; the free tier still applies.
2. Seal it yourself (agents never handle it):

```bash
read -rs KEY   # paste the key, press Enter (not echoed, not in shell history)
kubectl create secret generic sprout-google-translate -n sprout   --from-literal=GOOGLE_TRANSLATE_API_KEY="$KEY" --dry-run=client -o yaml | kubeseal --controller-name sealed-secrets-controller     --controller-namespace sealed-secrets --format yaml > services/sprout/sealed-google-translate.yaml
unset KEY
```

3. Commit `sealed-google-translate.yaml` in a PR. After the merge, restart the
   pod so it reads the key: bump the image or add a template annotation in git.

Cost controls in Sprout: 1000 characters per request, 30 calls per minute
across all users, a 500-entry cache.

## Operations

```bash
kubectl -n argocd get app sprout                 # Synced / Healthy
kubectl -n sprout get pods,svc
kubectl -n sprout logs deploy/sprout -f
```

Restarts and scaling go through git (Homelab CLAUDE.md: no live `kubectl` edits).
