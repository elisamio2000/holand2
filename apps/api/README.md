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
- POST /assessments/holland/score
- POST /assessments/mbti/score
- POST /recommendations
- GET /recommendations/catalog/jobs
- GET /recommendations/catalog/majors
- POST /recommendations/feedback
- GET /admin/alerts/recommendation-quality (admin only)
- GET /admin/recommendation-quality/trends (admin only)
- GET /admin/recommendation-quality/drift (admin only)
- GET /monitoring/metrics (admin only; includes quality-loop KPIs)
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

## Known limits

- PDF export depends on the host having a working WeasyPrint runtime; when unavailable, use `format=html`.
- Counselor case visibility is assignment-driven; unassigned students are intentionally hidden.
- Legacy reports without `user_id` are restricted to admin access.

## Seed taxonomy dataset

python -m app.scripts.seed_jobs

Swagger UI:

- http://localhost:8000/docs
