# Performance Hardening (Phase F / WS-H) — k6 Load Test Harness

Status: skeleton only. See `docs/qa-gate-matrix-fa.md` (gate `G4-perf`) and the
deferred-items list in the Phase F summary for what's still missing.

## What's here

- `k6/smoke-health.js` — ramps virtual users toward a configurable target (default
  1000) against the API's public, unauthenticated endpoints (`/health`,
  `/monitoring/metrics`, `/monitoring/readiness`). Safe to run against local Docker
  with no test-account setup required.

## What's NOT here yet (deferred)

- Authenticated, write-heavy scenarios (session start → answers → complete → report),
  which are the realistic "1000 concurrent users" path. These need a seeded
  load-test service account and are deferred until a staging environment is assigned
  to this pipeline (per coordinator: "No staging URL is assigned for this pipeline
  right now").
- Tuned SLO thresholds. The `http_req_duration` / error-rate thresholds in
  `smoke-health.js` are placeholders — they must be recalibrated against a real
  baseline run before this gate can be treated as blocking.
- Web (Next.js) load scenario — this skeleton only covers the API.

## Running locally

Requires [k6](https://k6.io/docs/get-started/installation/) installed locally (not
included in `requirements.txt`/`package.json` — it's a standalone CLI, so no repo
dependency changes were made for this skeleton).

```powershell
# Against local Docker stack (docker-compose up already running):
k6 run perf/k6/smoke-health.js

# Custom target / staging (once assigned):
k6 run -e BASE_URL=https://staging.example.com -e TARGET_VUS=1000 -e RAMP_DURATION=5m perf/k6/smoke-health.js
```

## CI policy

Per coordinator direction: perf runs are **non-blocking** and **manual/nightly only**
(`.github/workflows/perf.yml`, `workflow_dispatch` + optional `schedule`). This must
never be added to the default PR-blocking `ci.yml` pipeline.
