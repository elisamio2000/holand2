# API Quick Start

## Run locally

1. Create virtual env
2. Install dependencies
3. Start server

Example commands:

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

## Endpoints

- GET /health
- GET /monitoring/metrics (admin only; includes quality-loop KPIs)
- GET /monitoring/readiness
- POST /assessments/holland/score
- POST /assessments/mbti/score
- POST /recommendations
- GET /recommendations/catalog/jobs
- GET /recommendations/catalog/majors
- POST /recommendations/feedback
- GET /admin/alerts/recommendation-quality (admin only)
- GET /admin/recommendation-quality/trends (admin only)
- GET /admin/recommendation-quality/drift (admin only)
- GET /analytics/funnel
- POST /reports/generate (auth required)
- GET /reports/history (auth required)
- GET /reports/{report_id} (auth required)
- GET /reports/{report_id}/export?format=pdf|html (auth required)
- GET /counselor/dashboard (counselor/admin only)

## Report & counselor usage

1. Create or login and use the returned access token.
2. Generate reports through `/reports/generate`; ownership is bound to the authenticated user.
3. End users can access only their own reports/history.
4. Counselors can access reports only for assigned students (`counselor_assignments` table).
5. Admins can access all reports and can inspect any counselor dashboard via `?counselor_id=...`.

## Beta operational readiness thresholds

- Completion rate: `BETA_COMPLETION_RATE_THRESHOLD_PERCENT` (default `70`)
- Minimum completion sample size: `BETA_COMPLETION_MIN_SESSIONS` (default `10`)
- 5xx error rate: `BETA_5XX_ERROR_RATE_THRESHOLD_PERCENT` (default `1`)
- Recommendation quality alert threshold: `RECOMMENDATION_QUALITY_ALERT_THRESHOLD_PERCENT` (default `35`)

## Smoke check command

Run this against a running API instance:

python -m app.scripts.smoke_beta_readiness --base-url http://127.0.0.1:8000

## Known limits

- PDF export depends on the host having a working WeasyPrint runtime; when unavailable, use `format=html`.
- Counselor case visibility is assignment-driven; unassigned students are intentionally hidden.
- Legacy reports without `user_id` are restricted to admin access.

## Seed taxonomy dataset

python -m app.scripts.seed_jobs

Swagger UI:

- http://localhost:8000/docs
