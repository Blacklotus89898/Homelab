# ADR 0003 — No Velero: the git repo is the DR story

- **Status:** Accepted (user decision)
- **Date:** 2026-09-29; restore-drill reframed 2026-10-13; keyring backup closed 2026-10-21

## Context

Velero (or any PV backup system) was proposed for resilience. The user **declined it
2026-09-29**. What the data actually is: manifests (all in git), SQLite-backed app state
(pet catalogs, linkding bookmarks, uptime-kuma monitors), logs (OpenObserve, debug-only),
metrics (vmsingle, 30d). PV contents were explicitly accepted as non-recoverable.

The real single point of failure wasn't the PVs — it was the **sealed-secrets master keyring**:
git holds only ciphertext, and the decrypt keys lived solely in the cluster. Host loss =
every sealed secret gone. (Closed 2026-10-21: user-side backup, password manager, out-of-band
— never in this repo.)

## Decision

DR posture = **this repo is the source of truth**. The quarterly drill is a git-rebuild
rehearsal + completeness audit (git↔live parity, floater characterization), not a restore
test of a backup product we don't run. The one out-of-git artifact a rebuild needs is the
sealed-secrets keyring — user-held, re-exported after each ~monthly controller rotation.

## Consequences

- Rebuild path is documented in `docs/bootstrap.md` (ordered procedure + out-of-git layers
  checklist). Velero must not be re-proposed unless the user asks.
- PV data loss is policy, not risk: media re-obtainable, logs/metrics ephemeral, app state
  accepted-loss per component.
- Anything not in git is a rebuild gap by definition — the bootstrap checklist is the honest
  ledger of those (k3s config, node OS state, UI-configured services, floaters).
