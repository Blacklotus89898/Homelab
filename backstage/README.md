# Backstage — Homelab Developer Portal

Custom Backstage instance for the homelab, deployed via ArgoCD to the `backstage` namespace.

- **Live URL:** http://192.168.0.108:30900
- **Platform version:** 1.53.0 (new declarative frontend)
- **Image:** `ghcr.io/blacklotus89898/backstage:latest` (built by `.github/workflows/build-backstage.yaml`)

## Local development

```bash
cd backstage
yarn install
yarn start          # frontend on :3000
yarn start-backend  # backend on :7007
```

Uses SQLite in-memory for local dev. Production uses PostgreSQL (deployed alongside via the Helm chart).

## Adding a plugin

### Frontend plugin

```bash
yarn workspace app add @backstage/plugin-<name>
```

Import from `/alpha` in `packages/app/src/App.tsx` and add to the `features` array.

### Backend plugin/module

```bash
yarn workspace backend add @backstage/plugin-<name>-backend
```

Add `backend.add(import('@backstage/plugin-<name>-backend'))` to `packages/backend/src/index.ts`.

## Installed plugins

| Package | Type | What it does |
|---|---|---|
| `@backstage/plugin-kubernetes` | frontend | k3s pod/resource view on entity pages |
| `@backstage/plugin-github-actions` | frontend | CI run history on entity pages — **pending**, v0.6.16 has no `/alpha` export |
| `@backstage/plugin-home` | frontend | Home page at `/home` |
| `@backstage/plugin-techdocs` | frontend + backend | Rendered docs per service |
| `@backstage/plugin-scaffolder` | frontend + backend | New service templates |
| `@roadiehq/backstage-plugin-argo-cd` | frontend | ArgoCD sync/health tab on entity pages |
| `@backstage/plugin-catalog-backend-module-github` | backend | Auto-discovers `catalog-info.yaml` from GitHub org |
| `@backstage/plugin-notifications` + signals | frontend + backend | Real-time notifications |
| `@backstage/plugin-search` (pg) | backend | Full-text search backed by PostgreSQL |
| `@backstage/plugin-jenkins-backend` | backend | Jenkins integration — serves build data to frontend |
| `@backstage/plugin-jenkins` | frontend | Jenkins build tab on entity pages — **pending**, v0.9.10 has no `/alpha` export |

## Auth

GitHub OAuth only. Configured via `backstage-github-auth` SealedSecret (namespace: `backstage`).
No guest access.

## Catalog

Entities are loaded from two sources:
1. `catalog/all.yaml` in this repo (via `raw.githubusercontent.com`)
2. GitHub org auto-discovery — scans `Blacklotus89898/*` for `catalog-info.yaml` every 30 minutes

To add a new entity manually, add a file to `catalog/components/` and register it in `catalog/all.yaml`.

## ArgoCD integration

Requires `ARGOCD_TOKEN` env var from the `backstage-argocd-token` SealedSecret.
The proxy routes `/argocd/api` → `http://argocd-server.argocd.svc.cluster.local/api/v1/`.

To add the ArgoCD tab to a catalog entity, add this annotation:
```yaml
annotations:
  argocd/app-name: <argo-application-name>
```

## Secrets reference

| Secret name | Namespace | Keys | Purpose |
|---|---|---|---|
| `backstage-github-token` | backstage | `GITHUB_TOKEN` | Catalog + integrations |
| `backstage-github-auth` | backstage | `AUTH_GITHUB_CLIENT_ID`, `AUTH_GITHUB_CLIENT_SECRET` | GitHub OAuth login |
| `backstage-k8s-token` | backstage | `K8S_SA_TOKEN` | Kubernetes plugin |
| `backstage-argocd-token` | backstage | `ARGOCD_TOKEN` | ArgoCD proxy auth |
| `backstage-jenkins` | backstage | `JENKINS_API_KEY` | Jenkins backend plugin auth |

## Rebuilding the image

Push to `main` — the `build-backstage.yaml` workflow builds and pushes `ghcr.io/blacklotus89898/backstage:latest`. ArgoCD picks it up on next sync (image pull policy: `Always`).

## Upgrading Backstage platform version

1. Update `backstage.json` → `"version": "x.y.z"`
2. Run `yarn install` to update lockfile
3. Fix any peer dependency issues
4. Push → CI rebuilds image
5. **Wipe the PostgreSQL PVC** (forward-only migrations — old schema rejected):
   ```bash
   kubectl delete pod -n backstage backstage-postgresql-0
   kubectl delete pvc data-backstage-postgresql-0 -n backstage
   ```
