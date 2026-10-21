# ADR 0001 — VictoriaMetrics single-binary, not kube-prometheus-stack

- **Status:** Accepted
- **Date:** 2026-09-29 (codified from the ROADMAP decision log 2026-10-21)

## Context

Monitoring was the Phase 1 item, under the standing constraint that rules everything here:
**disk is the #1 bottleneck** — one Proxmox host, nearly full, every component must justify its
footprint. kube-prometheus-stack (Prometheus + Alertmanager + operator + node-exporter +
kube-state-metrics, each with own images and typically 1–2Gi+ all-in) is the default answer
everywhere else. We needed metrics, alerting to the phone, and a Grafana — not a footprint.

Also cluster-specific: this is k3s with the **sqlite datastore** (no etcd to scrape) and the
**embedded** kube-scheduler/kube-controller-manager (no separate service endpoints).

## Decision

Run `victoria-metrics-k8s-stack 0.95.0` (app v1.153.0) in `monitoring`: **vmsingle**
(single-binary TSDB) + vmagent (scrape) + Grafana + vmalert + vmalertmanager. fullname
`vmstack` — the chart default exceeds k8s' 63-char label limit on operator CRs.

Sizing: 30d retention, vmsingle PVC cap 8Gi, Grafana PVC 2Gi. k3s quirks handled:
`kubeEtcd.enabled: false` (headless etcd Service selects nothing on sqlite), scheduler/
controller-manager rules disabled (embedded → Kube*Down false-positives forever).

## Consequences

- **~2Gi all-in including images** (actual: vmsingle ~2.3Gi of its 8Gi cap) vs multi-Gi for
  the stack. Disk target met.
- vmsingle is a single writer: its memory limit must clear its **loaded working set**, not its
  request — the 2026-10-20 OOM lesson (512Mi cap sat at a ~507Mi idle set; 187 restarts;
  now 512Mi req / 2Gi limit).
- vmsingle serves the Prometheus query API at its root, so **Grafana and OpenCost share it**
  as their one datasource (ADR: OpenCost reuses vmsingle; no second TSDB).
- VictoriaMetrics CRs (VMProbe/VmRule) are validated in CI by kubeconform against the
  datreeio CRDs-catalog — which lags the live CRDs; newer field aliases get rejected
  (`vmProberSpec`, `static` vs `staticConfig`). Verify against the catalog, not GitHub master.
