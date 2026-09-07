# Homelab Architecture

Full architectural picture of the cluster, rendered with [Mermaid](https://mermaid.js.org).
Pair with the [README](../README.md) for operational commands and known issues.

- [Cluster overview](#cluster-overview)
- [GitOps flow (app-of-apps)](#gitops-flow)
- [Sync waves](#sync-waves)
- [CI/CD flows](#cicd-flows)
- [Petal pipeline run (end to end)](#petal-pipeline-run)
- [Observability](#observability)
- [Traffic and network](#traffic-and-network)
- [Secrets flow](#secrets-flow)

---

## Cluster overview

Two nodes. The control plane is cordoned (`SchedulingDisabled`) — every workload lands on
`k3s-worker-01`, which is why every namespace has a LimitRange and DinD namespaces are sized carefully.

```mermaid
flowchart TB
  subgraph net["LAN 192.168.0.0/24"]
    USER["Users / browser"]
    GH["GitHub<br/>Blacklotus89898 org"]
  end

  subgraph debian["node: debian — control-plane (SchedulingDisabled)"]
    K3SAPI["k3s API server"]
  end

  subgraph worker["node: k3s-worker-01 (192.168.0.x) — all workloads"]
    direction TB
    subgraph argons["namespace: argocd"]
      ARGO["ArgoCD server<br/>+ app-of-apps controller<br/>NodePort 31991"]
    end
    subgraph ss["namespace: sealed-secrets"]
      SSC["sealed-secrets controller"]
    end
    subgraph cm["namespace: cert-manager"]
      CM["cert-manager<br/>(no ClusterIssuer yet)"]
    end
    subgraph istio["namespace: istio-system + istio-cni"]
      ZTUN["ztunnel (L4 mesh)"]
      ICNI["istio-cni (k3s CNI paths)"]
      GW["istio-ingressgateway<br/>(installed, unused)"]
    end
    subgraph monitoring["namespace: monitoring (ambient)"]
      OTEL["OTel collector<br/>logs + kubeletstats"]
    end
    subgraph oo["namespace: openobserve (ambient)"]
      OO["OpenObserve<br/>SQLite single-node<br/>20Gi PVC · NodePort 30500"]
    end
    subgraph bs["namespace: backstage — NOT in mesh"]
      BACK["Backstage 1.53.0<br/>custom ghcr image<br/>NodePort 30900"]
      PG["PostgreSQL<br/>PVC data-backstage-postgresql-0"]
    end
    subgraph jenkinsns["namespace: jenkins — NOT in mesh"]
      JENK["Jenkins (JCasC)<br/>NodePort 30808"]
    end
    subgraph arc["namespaces: arc-systems / arc-runners — NOT in mesh"]
      ARCC["ARC controller"]
      LISTEN["listener pod"]
      ARCR["runner pods (ephemeral)<br/>+ DinD sidecar"]
    end
    subgraph petalns["namespace: petal — NOT in mesh"]
      PP["petal<br/>API + UI + scheduler + step-runner<br/>NodePort 30990"]
      PDIND["petal-dind sidecar<br/>(fuse-overlayfs)"]
      PSTEP["pipeline step containers<br/>(siblings inside DinD)"]
      PGIT["git-sync sidecar"]
    end
    subgraph svcs["ambient service namespaces"]
      LINK["linkding :30090"]
      KAV["kavita :30050<br/>hostPath VirtioFS"]
      ABS["audiobookshelf :30030"]
    end
    LP["StorageClass: local-path<br/>PVCs live here"]
  end

  AUTH["authentik :30080<br/>(existing, not GitOps)"]

  USER --> ARGO & BACK & JENK & OO & LINK & KAV & ABS & PP
  PP --- PDIND --- PSTEP
  PGIT --> PP
  BACK --- PG
  OTEL --> OO
  LINK & KAV & ABS -.-> ZTUN
  LP --- worker
```

---

## GitOps flow

Everything is declared in this repo; ArgoCD reconciles it. The root app-of-apps
(`bootstrap/root-app.yaml`, applied once by hand) watches `apps/` — each subdir is an
Application that points either at this repo (raw manifests or Helm-with-git-values) or
at an upstream Helm/OCI chart.

```mermaid
flowchart LR
  DEV["git push"] --> REPO["GitHub<br/>Blacklotus89898/Homelab"]
  REPO -->|"SSH repo connection<br/>(id_ed25519)"| ROOT["root-app<br/>watches apps/*"]
  ROOT -->|"creates/updates"| APPS["ArgoCD Applications<br/>one per apps/ subdir"]
  APPS -->|"native Helm chart<br/>argocd, istio, jenkins,<br/>backstage, otel, cert-manager,<br/>sealed-secrets, arc"| CHARTS["Upstream Helm repos<br/>+ ghcr OCI (ARC)"]
  APPS -->|"git source"| LOCAL["This repo:<br/>services/* (petal, linkding,<br/>kavita, audiobookshelf)<br/>infrastructure/namespaces"]
  CHARTS & LOCAL --> SYNC["ArgoCD sync<br/>automated · selfHeal<br/>ServerSideApply"]
  SYNC --> K8S["k3s cluster"]
```

Adding a service = one new subdir under `apps/` + a namespace + a LimitRange — the root
app picks it up on the next sync. See README "Adding a new service".

---

## Sync waves

Resources inside each app are annotated with `argocd.argoproj.io/sync-wave` so the
bootstrap order is deterministic:

```mermaid
flowchart LR
  Wm10["wave -10<br/>ArgoCD self-mgmt"] --> Wm5["wave -5<br/>namespaces<br/>(ambient labels here)"] --> Wm4["wave -4<br/>sealed-secrets<br/>cert-manager<br/>gateway-api CRDs"] --> Wm3["wave -3<br/>Istio ambient"] --> Wm2["wave -2<br/>OTel operator<br/>istio-ingressgateway<br/>ARC controller"] --> Wm1["wave -1<br/>OpenObserve<br/>ARC runner infra<br/>pod-cleanup"] --> W0["wave 0<br/>OTel collector · platform-observability<br/>ARC runners · backstage-k8s-rbac<br/>audiobookshelf · jenkins-infra<br/>kavita · linkding · petal"] --> W1["wave 1<br/>Backstage · Jenkins"]
```

Namespaces carry their Istio ambient label at creation time (wave -5) so pods in
enrolled namespaces never start outside the mesh.

---

## CI/CD flows

Three build/trigger paths coexist. GH-hosted runners build container images;
on-cluster runners and Jenkins run jobs that need cluster-adjacent resources.

```mermaid
flowchart TB
  subgraph gh["GitHub Actions (GH-hosted runners)"]
    BB["build-backstage.yaml<br/>backstage/** changed"] -->|"buildx + trivy"| GHCRB["ghcr.io/blacklotus89898/backstage<br/>latest + sha (public)"]
    BP["build-petal.yaml (Petal repo)<br/>go test → buildx + trivy"] --> GHCRP["ghcr.io/blacklotus89898/petal<br/>latest + sha"]
    RP["release.yml<br/>release-please"] --> REL["Release PR → changelog"]
  end

  subgraph arcflow["ARC on-cluster runners (homelab-runner)"]
    WF["workflows with<br/>runs-on: homelab-runner"] --> L["listener long-polls GitHub"] --> RP2["ephemeral runner pod<br/>+ DinD sidecar"] --> DKR["docker/build-push-action<br/>works unchanged"]
  end

  subgraph jenkinsflow["Jenkins (multibranch)"]
    MB["homelab multibranch job<br/>scans all branches"] --> JF["Jenkinsfile at repo root"]
  end

  subgraph petalflow["Petal triggers (Petal repo)"]
    WH["petal-trigger.yaml<br/>signed webhook on push (dormant)"] --> PAPI["POST /api/triggers/github<br/>HMAC-SHA256 verified"]
    CRON["cron schedules<br/>minute-bucket dedup"] --> POOL["petal run queue<br/>(SQLite dedup)"]
    MAN["manual trigger via UI"] --> PAPI2["POST /api/runs"]
  end

  GHCRB -->|"imagePullPolicy: Always"| BSDEPLOY["Backstage deploy<br/>(ArgoCD)"]
  GHCRP --> PETALDEPLOY["Petal deploy (ArgoCD)"]
```

---

## Petal pipeline run

The core principle: **Petal decides and remembers; Docker runs; YAML describes.**
Every trigger funnels into one deduplicated queue (SQLite, unique `dedup_key`), a
small worker pool executes runs via the first-party step-runner (ADR 0002 — it
superseded the original Dagger-engine executor), and every state change lands in
the append-only event log.

```mermaid
sequenceDiagram
  autonumber
  participant T as Trigger (UI / webhook / cron)
  participant API as petal API
  participant DB as SQLite registry (PVC)
  participant Pool as worker pool
  participant SR as step-runner (Docker API client)
  participant D as DinD sidecar (step containers)
  participant Reg as Container registry

  T->>API: run request
  API->>DB: Enqueue (dedup_key unique — at-least-once triggers fire once)
  API->>DB: event: queued
  Pool->>DB: ClaimNext (atomic tx)
  Pool->>DB: event: started
  Pool->>SR: Execute(run)
  SR->>SR: load .petal/pipelines/<name>.yaml from git-synced workdir
  SR->>SR: snapshot repo → /data/work/<run_id> (per-run workspace)
  loop each step, sequential fail-fast
    SR->>D: pull image → create container (run: sh -eu, /src bind-mounted)
    D->>Reg: pull step image (layer cache on PVC)
    SR->>D: stream stdout/stderr → /data/logs/<run_id>/<step>.log
    SR->>DB: events: step.started / step.finished (exit code)
  end
  SR->>SR: read output files → JSON
  SR-->>Pool: Result {status, output}
  Pool->>DB: Finish + event: output
  Note over DB: full audit trail: trigger → run → per-step events
```

Step containers are **plain siblings in the DinD sidecar**: petal talks the
Docker Engine API to the `petal-dind` privileged sidecar
(`DOCKER_HOST=tcp://127.0.0.1:2375`, fuse-overlayfs storage driver) — the same
DinD pattern the ARC runners use. No engine, no SDK, no docker CLI.

---

## Observability

Logs and metrics flow through the OTel collector into OpenObserve. Traces
(Petal Phase C) are the next leg.

```mermaid
flowchart LR
  subgraph sources["Cluster"]
    PODS["pod logs<br/>(all namespaces)"]
    KUBE["kubeletstats<br/>node/pod/container metrics"]
    FUTURE["OTel traces<br/>(Petal runs — planned)"]
  end
  subgraph mon["namespace: monitoring"]
    COLL["OTel collector"]
  end
  subgraph oons["namespace: openobserve (ambient)"]
    OO["OpenObserve<br/>SQLite single-node · 20Gi PVC<br/>30-day compaction"]
  end
  USER2["Dashboards / alerts UI<br/>:30500"]
  PODS & KUBE -->|"fluent-forward / OTLP<br/>basic auth YWRtaW4..."| COLL
  COLL --> OO
  FUTURE -.-> COLL
  OO --> USER2
```

Alert rules (OOMKill, disk >80%, node NotReady) are still TODO — see `todo.md`.

---

## Traffic and network

No Ingress yet — everything is plain-HTTP NodePort, which is why most service
namespaces are **excluded** from the ambient mesh (ztunnel intercepts and drops
unencrypted NodePort traffic). `platform/gateways/` is empty pending the Istio
Gateway/HTTPRoute + cert-manager work.

```mermaid
flowchart LR
  IN["LAN clients"] --> NP["NodePorts on k3s-worker-01"]
  NP --> P30080[":30080 authentik<br/>(not GitOps)"]
  NP --> P30030[":30030 audiobookshelf"]
  NP --> P30050[":30050 kavita"]
  NP --> P30090[":30090 linkding"]
  NP --> P30500[":30500 OpenObserve"]
  NP --> P30808[":30808 Jenkins"]
  NP --> P30900[":30900 Backstage"]
  NP --> P30990[":30990 Petal"]
  NP --> P31991[":31991 ArgoCD"]
  subgraph mesh["Istio ambient (L4)"]
    Z["ztunnel sidecar-less proxy<br/>mTLS between enrolled namespaces"]
  end
  audiobookshelf & kavita & linkding & openobserve & monitoring & homelab -.-> Z
```

| Namespace | In mesh? | Why |
|---|---|---|
| monitoring, openobserve, homelab, kavita, linkding, audiobookshelf | ✅ | no NodePort exposure conflict |
| backstage, jenkins, petal | ❌ | plain-HTTP NodePort access |
| arc-systems | ❌ | webhook TLS conflicts with ztunnel |
| arc-runners | ❌ | DinD conflicts with ambient |

---

## Secrets flow

Secrets are never stored plaintext in git (two known exceptions tracked in
`todo.md`: OpenObserve's secret and the Backstage postgres password). `kubeseal`
encrypts against the controller's key; only the in-cluster controller can decrypt.

```mermaid
flowchart LR
  OP["Operator"] -->|"kubectl create secret --dry-run"| RAW["raw Secret manifest"]
  RAW -->|"pipe through kubeseal"| SEALED["SealedSecret (committed to git)"]
  SEALED -->|"git push → ArgoCD sync"| SSC["sealed-secrets controller<br/>ns: sealed-secrets"]
  SSC -->|"unseal (controller key only)"| S["Secret in target namespace"]
  S --> CONSUMERS["ARC runners (GitHub PAT)<br/>Backstage (ArgoCD token, Jenkins key)<br/>+ any service"]
```

Sealed secrets in the repo: ARC GitHub PAT (`infrastructure/arc-runners/`),
Backstage ArgoCD token + Jenkins API key (`infrastructure/backstage-k8s-rbac/`).
Rotation procedures for each are in the README.
