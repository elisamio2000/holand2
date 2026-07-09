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
- GET /monitoring/metrics
- GET /monitoring/readiness
- POST /assessments/holland/score
- POST /assessments/mbti/score
- POST /recommendations
- GET /recommendations/catalog/jobs
- GET /recommendations/catalog/majors
- POST /reports/generate
- GET /reports/{report_id}
- GET /analytics/funnel
- GET /admin/alerts/recommendation-quality

## Beta operational readiness thresholds

- Completion rate: `BETA_COMPLETION_RATE_THRESHOLD_PERCENT` (default `70`)
- Minimum completion sample size: `BETA_COMPLETION_MIN_SESSIONS` (default `10`)
- 5xx error rate: `BETA_5XX_ERROR_RATE_THRESHOLD_PERCENT` (default `1`)
- Recommendation quality alert threshold: `RECOMMENDATION_QUALITY_ALERT_THRESHOLD_PERCENT` (default `35`)

## Smoke check command

Run this against a running API instance:

python -m app.scripts.smoke_beta_readiness --base-url http://127.0.0.1:8000

## Seed taxonomy dataset

python -m app.scripts.seed_jobs

Swagger UI:

- http://localhost:8000/docs
