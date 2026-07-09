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

Swagger UI:

- http://localhost:8000/docs
