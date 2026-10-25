# petal

Pipeline orchestrator (Petal ADR 0003): Go control plane + step-runner executing pipeline steps in a Docker-in-Docker sidecar, with a git-sync checkout.

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | yes | Main container pinned to a Petal commit-sha tag (since 2026-10-21; bumped by hand after a Petal CI build); sidecars pinned: `petal-dind:27.5.1`, `git-sync:v4.1.0` (`services/petal/deployment.yaml`) |
| SLO | yes | Blackbox probe on :30990 (`infrastructure/blackbox-exporter/vmprobe.yaml`) |
| Recovery | git | Manifests in `services/petal/`; workspace PVC = accepted loss |

## Overview

| Field | Value |
|---|---|
| Namespace | `petal` |
| Image | `ghcr.io/blacklotus89898/petal:<commit-sha>` (+ petal-dind 27.5.1, git-sync v4.1.0) |
| API auth | mutating routes need `Authorization: Bearer $PETAL_API_TOKEN` (SealedSecret `petal-api-token`); reads open on the LAN |
| URL | http://192.168.0.108:30990 |

## Operations

```bash
kubectl -n petal rollout restart deployment/petal
kubectl -n petal logs deployment/petal --tail=100
```

## Secrets (Petal ADR 0006)

A pipeline step requests a secret by name (`secrets: [ghcr-push]`) and reads
it from the file at `$PETAL_SECRET_GHCR_PUSH_FILE`. Two things must both be
true in git for that to work:

1. **The value** is a key of the `petal-secrets` SealedSecret
   (`services/petal/sealed-secrets.yaml`).
2. **The grant**: `repos-configmap.yaml` lists the name under the repo's
   `secrets:` (or `self.secrets` for the Petal repo). Only runs at the repo's
   `trusted_refs` (default: its `default_ref`) receive it.

`sealed-secrets.yaml` has no comments on purpose: `--merge-into` rewrites the
file. It holds `e2e-canary`, a random non-sensitive test value.

Adding a real credential (operator only — never paste it into a chat or a
commit). Run it on your own machine, in PowerShell:

```powershell
# Prompts for the value without echoing it; writes only ciphertext.
$v = Read-Host -AsSecureString "value"
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($v))
$f = New-TemporaryFile; [IO.File]::WriteAllText($f, $plain); $plain = $null
kubectl create secret generic petal-secrets -n petal --from-file=ghcr-push=$f --dry-run=client -o json |
  kubeseal --controller-namespace sealed-secrets --format yaml --merge-into services/petal/sealed-secrets.yaml
Remove-Item $f
```

Then add the grant, commit, push. A new value reaches the running pod in about
a minute (no restart); a new grant needs a Petal restart (the config is read
at startup).

Masking replaces every value with `***` in the run's logs, outputs and
errors, but it is best-effort.

**Docker access is a privilege too.** Only `docker: true` steps get
`DOCKER_HOST`, and only where the config grants `docker: true` at a trusted
ref (today: Petal's own `docker-image`). Every other step runs on dind's
bridge with no daemon access. A docker step shares the privileged DinD daemon
and can read **every** secret file and other runs' workspaces, so grant
docker only where you'd grant everything. The ref gate only means something
while branch protection on `main` is enforced: today, admin pushes bypass it.

E2E check: run `secrets-e2e` on `homelab@main`. The log shows
`value in the log: ***` and a 12-character hash prefix, and the
`without-secret` step proves a step that didn't ask can't see it.
