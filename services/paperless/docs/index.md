# paperless

Document management system - **deprecated**: scaled to zero 2026-09-28, no ArgoCD
Application remains, PVCs retained on disk (disk is the first-class constraint;
deleting them is a standing user decision away).

## Scorecard

| Check | Status | Notes |
|---|---|---|
| Image pinned | no | No running workload - catalog entry retained for history |
| SLO | no | Disabled |
| Recovery | git | Manifests could be re-created from git history; PVC contents = accepted loss (2026-09-29 decision) |

## Overview

| Field | Value |
|---|---|
| Namespace | - (none) |
| Image | n/a (scaled to zero) |
| URL | none (disabled) |
