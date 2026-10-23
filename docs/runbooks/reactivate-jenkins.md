# Reactivate Jenkins (retired 2026-10-23, ADR 0010)

Jenkins was removed from the cluster, not from git. Everything needed to bring it back
is in the repo; this page is the ordered path and the list of edits the retirement made
elsewhere. Last running state: tag `retired/jenkins-arc-2026-10-23`.

## What it was

| | |
|---|---|
| Chart | `jenkins` 5.9.68 from `https://charts.jenkins.io` (Application `archive/apps/jenkins/application.yaml`, wave 1) |
| Image | `jenkins/jenkins:lts-jdk21@sha256:c1e4c349…` (digest-pinned in `apps/jenkins/values.yaml` once moved back) |
| Config | JCasC only — no setup wizard; one multibranch job `homelab` over this repo, `scriptPath('Jenkinsfile')` (root `Jenkinsfile`: YAML validation in a `python:3.12-slim` pod agent) |
| Namespace | `jenkins` (not in the ambient mesh); LimitRange in `infrastructure/jenkins/` (Application `archive/apps/jenkins-infra/`) |
| Storage | PVC `jenkins` 10Gi `local-path` — **deleted with the app**; only build history lived there (8 builds) |
| Access | NodePort 30808; `https://jenkins.lab.home` via the gateway |
| Resources | 250m / 512Mi requested, 2 CPU / 2Gi limit, 2 executors on the controller |

## Reactivate

1. **Register the chart repo in ArgoCD** (one-time per ArgoCD install):
   ```bash
   argocd repo add https://charts.jenkins.io --type helm --name jenkins
   ```
2. **Restore the namespace** — re-add to `infrastructure/namespaces/namespaces.yaml`:
   ```yaml
   ---
   # Jenkins CI — NodePort access; excluded from ambient mesh
   apiVersion: v1
   kind: Namespace
   metadata:
     name: jenkins
   ```
3. **Move the Applications back** — the root app-of-apps picks them up from `apps/`:
   ```bash
   git mv archive/apps/jenkins apps/jenkins
   git mv archive/apps/jenkins-infra apps/jenkins-infra
   ```
   Bump the chart/image pin first if the archived ones are stale (check
   `https://charts.jenkins.io` and the LTS JDK21 digest); `additionalPlugins` use
   `:latest` and resolve at boot (the startup probe allows 10 min).
4. **Front door + monitoring** (revert the retirement edits):
   - `platform/gateways/routes.yaml`: the `jenkins` HTTPRoute (ns `jenkins`, service
     `jenkins`, port 8080, host `jenkins.lab.home`, sync-wave 5, sectionName https).
   - `tools/uptime-kuma/monitors.yaml`: `Jenkins` (apps group, http
     `http://jenkins.jenkins.svc.cluster.local:8080/login`) and `jenkins.lab.home`
     (front-door group, `https://jenkins.lab.home/login`); re-run
     `tools/uptime-kuma/provision.py`.
   - `hosts/glance/glance.yml`: the Jenkins site in the homelab monitor
     (`url: https://jenkins.lab.home/login` — `/` is 403 for anonymous, `icon: di:jenkins`),
     then copy to the Glance LXC (`hosts/README.md`).
   - `README.md` NodePort table: 30808 jenkins.
5. **Backstage integration (optional)** — a fresh Jenkins has a fresh admin, so the old
   API token is invalid:
   1. Jenkins UI → admin → Configure → API Token → generate.
   2. Seal it (key `JENKINS_API_KEY`) as `infrastructure/backstage-k8s-rbac/sealed-jenkins-token.yaml`:
      ```bash
      kubectl create secret generic backstage-jenkins -n backstage \
        --from-literal=JENKINS_API_KEY=<token> --dry-run=client -o yaml \
      | kubeseal --controller-name sealed-secrets-controller \
          --controller-namespace sealed-secrets --format yaml \
      > infrastructure/backstage-k8s-rbac/sealed-jenkins-token.yaml
      ```
   3. `apps/backstage/values.yaml`: add `backstage-jenkins` to `extraEnvVarsSecrets` and
      restore the `jenkins:` block:
      ```yaml
      jenkins:
        instances:
          - name: default
            baseUrl: http://jenkins.jenkins.svc.cluster.local:8080
            username: admin
            apiKey: ${JENKINS_API_KEY}
      ```
      Do **not** restore the old `/jenkins` proxy with
      `credentials: dangerously-allow-unauthenticated` — it exposed the Jenkins API to any
      browser.
   4. Backend: `yarn workspace backend add @backstage/plugin-jenkins-backend` and
      `backend.add(import('@backstage/plugin-jenkins-backend'));` in
      `backstage/packages/backend/src/index.ts`; build the image (CI), bump the tag, let the
      canary roll.
   5. Catalog: `catalog/components/jenkins.yaml` back to `lifecycle: production`;
      `catalog/apis.yaml` `jenkins-api` entity.
6. **Verify:** `kubectl -n argocd get app jenkins jenkins-infra` Synced/Healthy;
   `https://jenkins.lab.home/login` 200; the `homelab` job scans branches and builds `main`.
