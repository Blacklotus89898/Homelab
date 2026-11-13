# sprout

Language learning: read, mine, review, speak (Mandarin first)

| Field | Value |
|---|---|
| Namespace | `sprout` |
| Image | `ghcr.io/blacklotus89898/sprout:f16aaaa7223ffe0213c6f997aee4c4d57df408d8` |
| URL | https://sprout.lab.home |
| Health | `/health` |
| Storage | none |
| Source | [Blacklotus89898/Sprout](https://github.com/Blacklotus89898/Sprout) |

## Deploy a new version

The service repo's CI pushes `:<commit sha>`. Bump `image:` in
`services/sprout/deployment.yaml` in a PR, and ArgoCD rolls it out.

## Translation

In desktop Chrome (138+), Sprout translates **on the device** with Chrome's
built-in Translator API: free, no key needed (Sprout ADR 0003). The key below
is optional and only serves phones, Safari and Firefox.

### Optional: Google Translate API key

The fallback uses the Google Cloud Translation API (Basic): the first 500k
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

## Saved words and the tutor

- **Saved words** live in each browser's `localStorage` (Sprout ADR 0005).
  Nothing is stored in the cluster: no PVC, no database. Clearing site data
  deletes them; the Words page has Export/Import for backups.
- **Conversation tutor** runs on Chrome's built-in model (Gemini Nano) on the
  learner's own machine: no key, no server call, nothing to configure here.
  It needs desktop Chrome 148+, about 22 GB of free disk and a GPU with more
  than 4 GB of memory. Mandarin is experimental (Chrome doesn't list Chinese
  yet); Spanish is supported.

## Operations

```bash
kubectl -n argocd get app sprout                 # Synced / Healthy
kubectl -n sprout get pods,svc
kubectl -n sprout logs deploy/sprout -f
```

Restarts and scaling go through git (Homelab CLAUDE.md: no live `kubectl` edits).
