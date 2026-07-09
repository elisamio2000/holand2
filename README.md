# Holand Platform

A professional platform for Holland and MBTI assessments with smart guidance for education and career pathways.

## What this repository contains

- Product and execution documentation in Persian
- MVP scope for a clean, accurate, and scalable implementation
- Data model and scoring design foundations
- Holand web app scaffold at apps/web/apps/holand-web-app

## Immediate next build steps

1. Implement authentication and user profile flow.
2. Implement assessment engine for Holland (RIASEC) and MBTI.
3. Build recommendation service for career and study tracks.
4. Add counselor dashboard and reporting.
5. Add analytics, A/B tests, and model quality monitoring.

## Docs

- docs/discovery-and-product-planning-fa.md
- docs/product-strategy-fa.md
- docs/technical-architecture-fa.md
- docs/questionnaire-scoring-design-fa.md
- docs/mvp-execution-plan-fa.md
- docs/esanj-benchmark-and-interpretation-requirements-fa.md
- docs/job-taxonomy-modernization-and-ethics-fa.md
- docs/beta-launch-runbook-fa.md

## Monitoring / Observability baseline (Phase 10)

- Structured request logs with JSON payload (`event`, `request_id`, `path`, `status_code`, `duration_ms`).
- Optional Sentry hook initialization via environment settings.
- Baseline metrics endpoint:
  - `GET /monitoring/metrics`
- Recommendation quality admin alert endpoint:
  - `GET /admin/alerts/recommendation-quality`

### Environment keys

- `OBSERVABILITY_LOG_LEVEL` (default: `INFO`)
- `SENTRY_DSN` (optional)
- `SENTRY_TRACES_SAMPLE_RATE` (default: `0.1`)

## Web App (Holand Base)

- Source path: apps/web/apps/holand-web-app
- Base route for platform design: /career-guidance
- Current design modules:
	- /career-guidance/assessments
	- /career-guidance/assessments/history
	- /career-guidance/assessments/compare
	- /career-guidance/reports
	- /career-guidance/counselor
	- /career-guidance/expert-lab

### Run locally

1. Go to apps/web/apps/holand-web-app
2. Install dependencies
3. Run dev server

Example:

```bash
cd apps/web/apps/holand-web-app
npm install
npm run dev
```
