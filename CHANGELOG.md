# Changelog

## 1.0.0 (2026-08-04)


### Features

* add cert-manager v1.21.0 and gateway-api v1.6.1 ([f2b5adf](https://github.com/Blacklotus89898/Homelab/commit/f2b5adf37f4128749edbed9a2aad645ef8655477))
* add Istio ambient 1.30.3 + ingress gateway ([cd026ad](https://github.com/Blacklotus89898/Homelab/commit/cd026ad4a8f476393786e01a3cee7ba365c2d8b4))
* add Jenkins CI with Backstage integration ([e7c45b9](https://github.com/Blacklotus89898/Homelab/commit/e7c45b96a90f7f9f5c08fd676f2dfee3c518dbd8))
* add pod-cleanup CronJob to prune completed/failed pods every 15min ([89581c1](https://github.com/Blacklotus89898/Homelab/commit/89581c15d145b9f97c36c67311a78f7a27d7bf43))
* **backstage:** add GitHub OAuth login provider ([616df75](https://github.com/Blacklotus89898/Homelab/commit/616df751f0272d463f8bb8b15f4addccf377cc19))
* **backstage:** add Kubernetes plugin with RBAC and catalog annotations ([5df0dc2](https://github.com/Blacklotus89898/Homelab/commit/5df0dc25835de591edcde72fe392805c2ba07d1b))
* custom backstage image with full plugin support ([d7b51bc](https://github.com/Blacklotus89898/Homelab/commit/d7b51bc66fc34a201de5af142adfdc977d106a2a))
* harden Backstage auth, add plugins, ArgoCD integration, and update docs ([8e00997](https://github.com/Blacklotus89898/Homelab/commit/8e00997f954e0956157ae3b30d4a83983da34f47))
* migration of kavita, and linkding ([630e692](https://github.com/Blacklotus89898/Homelab/commit/630e692e46dee1e162061cc84c397dd704102f3a))
* OTel operator, OpenObserve, observability platform + fix gateway NodePort conflict ([94a4f3b](https://github.com/Blacklotus89898/Homelab/commit/94a4f3b0c1e6b483c9208b5f821faddbdeb59779))
* seal Jenkins API token and enable Backstage backend connection ([ddf415b](https://github.com/Blacklotus89898/Homelab/commit/ddf415be3556fffb9774eae6e67cad8f95001efd))
* workflow and revision hitory limit ([2349de2](https://github.com/Blacklotus89898/Homelab/commit/2349de256215f824ca732c4d59bc249b07478eeb))


### Bug Fixes

* add libsqlite3-dev for better-sqlite3 native build ([e5fee64](https://github.com/Blacklotus89898/Homelab/commit/e5fee643bd64bde156c66a0f60f657075cae8cd3))
* allow external HTTPS connections in Backstage CSP for home widgets ([a2ad2cc](https://github.com/Blacklotus89898/Homelab/commit/a2ad2cc78a5c7769d27ed1e5c285f287b613d630))
* allow packages/*/src in Docker context for multi-stage build ([744cc08](https://github.com/Blacklotus89898/Homelab/commit/744cc08f0c5464005455f8fef10577f7eca380fa))
* ArgoCD service NodePort for port-forward workaround ([e20ef1b](https://github.com/Blacklotus89898/Homelab/commit/e20ef1b9d6e4c409407655724b10b2c0d59bd7d3))
* Backstage GitHub login button and 404 on logo click ([77262df](https://github.com/Blacklotus89898/Homelab/commit/77262df96e0dfb537df41c0e6699ce11175b4beb))
* **backstage:** register all 12 frontend plugins in App.tsx to resolve apiRef crashes ([2fd19e9](https://github.com/Blacklotus89898/Homelab/commit/2fd19e98b5dff435059f268e9190b367b92a938a))
* **backstage:** register all frontend plugins and polyfill crypto.randomUUID for HTTP ([7eb33b3](https://github.com/Blacklotus89898/Homelab/commit/7eb33b3483b8f3d014c9a875531299c24b1ed562))
* comment out backstage-jenkins secret ref until token is sealed ([64a6adf](https://github.com/Blacklotus89898/Homelab/commit/64a6adfd8f5ca91d29343583c8a9f6c7987245b9))
* correct OpenObserve values structure (auth section, replicaCount keys, disable o2ai) ([1dd6b23](https://github.com/Blacklotus89898/Homelab/commit/1dd6b235f5b45f9d8e82b5eca492c76a22d7a937))
* CreateNamespace=true for kavita and linkding to avoid sync race ([6321ba5](https://github.com/Blacklotus89898/Homelab/commit/6321ba59d35fff19b04c5a2c5ea5d0f88abacddf))
* disable OpenObserve postgres, use sqlite meta store ([5978e57](https://github.com/Blacklotus89898/Homelab/commit/5978e573107873d19943d573060cbbd8458b5735))
* downgrade OpenObserve to 0.80.3 (standalone, no CNPG/Prometheus deps) ([a0dd385](https://github.com/Blacklotus89898/Homelab/commit/a0dd385b1ab81b7eb1ecd8849699c72a27d885ff))
* enable recursive directory scan for app-of-apps ([281bcff](https://github.com/Blacklotus89898/Homelab/commit/281bcffb5d72218b618fc80b34abee3ee90b601b))
* exclude release-please bot branch from Jenkins multibranch scan ([d8aed96](https://github.com/Blacklotus89898/Homelab/commit/d8aed96a64a1c88ca19771464abf12c1faa24a60))
* gh-backstage-oauth secret name ([2b68ef5](https://github.com/Blacklotus89898/Homelab/commit/2b68ef5f95ac731f5b21df5e7dbcb1e31a3a5031))
* Istio CNI k3s path + gateway NodePort for Traefik coexistence ([7b44114](https://github.com/Blacklotus89898/Homelab/commit/7b441144ef2bcb4ebfe5a2ed76007dbcc861a62c))
* istio-cni binary path for k3s 1.34 (/var/lib/rancher/k3s/data/cni) ([2073789](https://github.com/Blacklotus89898/Homelab/commit/207378905c2e568dadc1d1d3720ac2a1feccecc4))
* kubeconform xargs pipe, switch to mkdocs-techdocs-core, add techdocs-core plugin to mkdocs.yml ([b63a0f9](https://github.com/Blacklotus89898/Homelab/commit/b63a0f9f7f5b00de022237f90b8cc9764bee7f4f))
* match gateway NodePorts to already-assigned values (30233/30131/30328) ([b6eafe3](https://github.com/Blacklotus89898/Homelab/commit/b6eafe3b556e63d10cbbde181138c5e93a5a6431))
* OpenObserve replicaCount as object for cluster-mode chart ([c7dec79](https://github.com/Blacklotus89898/Homelab/commit/c7dec79254020c7b0abc30889d85e7c8a088b539))
* OpenObserve replicaCount structure for cluster-mode chart ([f9cf093](https://github.com/Blacklotus89898/Homelab/commit/f9cf093eec6f5b63a03cdd4447e64be9afc770b0))
* pass release-please outputs via env to avoid JSON shell injection in summary ([37fb0e0](https://github.com/Blacklotus89898/Homelab/commit/37fb0e0821a80efcde7633f168cee5bb1e8531f0))
* poort number ([4231d1f](https://github.com/Blacklotus89898/Homelab/commit/4231d1f748e8f19a1f2c79ac41f5aaae56d47b9f))
* prevent crash of argocd oom ([b326cd4](https://github.com/Blacklotus89898/Homelab/commit/b326cd465ad6f48ca6cd18573d1f36735797732c))
* raise arc-runners LimitRange defaults for DinD Docker builds ([a3a47bc](https://github.com/Blacklotus89898/Homelab/commit/a3a47bc8647228fc8fd108a0407e619ad66e2436))
* regenerate yarn.lock and skip yarn tsc in Docker build ([e9bb58c](https://github.com/Blacklotus89898/Homelab/commit/e9bb58c3669d6e70a38142ada146be225ce5800b))
* regenerate yarn.lock with proper resolution ([59b45ce](https://github.com/Blacklotus89898/Homelab/commit/59b45ce8d647d1862218fd3bc22d98ae1ba57d35))
* register notificationsPlugin and signalsPlugin in frontend app ([da7932c](https://github.com/Blacklotus89898/Homelab/commit/da7932ceb857ff610eb4866bffec5f9a56ca02d1))
* register template as github.com blob URL so scaffolder finds integration ([6115ad5](https://github.com/Blacklotus89898/Homelab/commit/6115ad5fb3ce423a0e7e031e4411f9ec95dcd25d))
* register template directly in Backstage config, revert catalog glob ([1b5fcff](https://github.com/Blacklotus89898/Homelab/commit/1b5fcff951a6cd20e9a2493542356981e4fb7859))
* remove creationTimestamp from SealedSecret template.metadata to pass kubeconform ([ebb4019](https://github.com/Blacklotus89898/Homelab/commit/ebb4019df2801f661de90471b217ff630febe32f))
* remove github-actions and home plugin imports — no /alpha export in current versions ([ffdd343](https://github.com/Blacklotus89898/Homelab/commit/ffdd343aaa3bfe4208d71bb8542e9920a2c982c2))
* remove invalid periodic() trigger from multibranch Job DSL ([2bdf293](https://github.com/Blacklotus89898/Homelab/commit/2bdf293349ef20ed3761731d2c4472c42f53bdb3))
* remove NotificationsSidebarItem - legacy plugin incompatible with new frontend system ([dcf83d1](https://github.com/Blacklotus89898/Homelab/commit/dcf83d1ad9bcdd354e7d9ed81d9c2ca1c9c2a6c1))
* remove plugins copy from Dockerfile (excluded by dockerignore) ([bf8fe68](https://github.com/Blacklotus89898/Homelab/commit/bf8fe685883bcc11c6eb3c70812b24485ce05e6f))
* resolve merge conflicts in application manifests ([2ec5b17](https://github.com/Blacklotus89898/Homelab/commit/2ec5b17dd93c7679beb18f248b0b25824c048fa8))
* set 2 executors on Jenkins controller for homelab builds ([4642e82](https://github.com/Blacklotus89898/Homelab/commit/4642e827621d07c2f12e9a7cd3629fe8ae700e65))
* set explicit controllerServiceAccount for ARC runner scale set ([4c91f16](https://github.com/Blacklotus89898/Homelab/commit/4c91f16a5ec78566e8ae69e8252c313e18a8e156))
* switch to node:24-trixie-slim matching official template ([1478719](https://github.com/Blacklotus89898/Homelab/commit/147871936abb66bf638cb7f2080abe6661b35af8))
* use explicit github.com URL for skeleton in scaffolder template ([d016709](https://github.com/Blacklotus89898/Homelab/commit/d016709adf2fafc3b22c03437c95dfc79b04d0c4))
* use kubernetes pod agent with python for Jenkins builds ([4a67c61](https://github.com/Blacklotus89898/Homelab/commit/4a67c616ee72bec32b03f0d1eab176db9165483d))
* use named imports for legacy notifications and signals plugins ([c7b9048](https://github.com/Blacklotus89898/Homelab/commit/c7b9048ad2c121c43b0ba0c0bf5134724cdd16c8))
* use yarn install without --immutable (seed lockfile is stale) ([7082cfc](https://github.com/Blacklotus89898/Homelab/commit/7082cfcf09d136edd37eb90b706ab6b81820cbcc))
* wire ArgoCD and Home plugins, remove broken github-actions import ([ad0e49a](https://github.com/Blacklotus89898/Homelab/commit/ad0e49a95695cb9b9ff774287437e761aa86720d))


### Reverts

* GitHub auth not in pre-built 1.28.0 image, back to guest ([28ba981](https://github.com/Blacklotus89898/Homelab/commit/28ba9813081e31e4c4fe9e346b6fb9b9276e9f8d))
