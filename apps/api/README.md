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
- POST /reports/generate
- GET /reports/{report_id}

## Seed taxonomy dataset

python -m app.scripts.seed_jobs

Swagger UI:

- http://localhost:8000/docs
