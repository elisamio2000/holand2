# Phase C: Assessment Authoring & Age-Branching API

## Overview

Phase C introduces professional assessment authoring with age-branching support. This document specifies:
- All 9+ API endpoints (CRUD for assessments, questions, scoring models, branches)
- Data models and schema
- Frontend authoring UI components
- Integration patterns

---

## Base Path
```
/api/assessments/{version_id}
```

All endpoints require admin/authoring role authorization (Bearer token with admin scope).

---

## Assessment Version Endpoints

### GET /api/assessments/{version_id}
**Retrieve a single assessment version**

**Parameters:**
- `version_id` (path, required): UUID of assessment version
- `age_group` (query, optional): Filter to specific age group (child|teen|adult|senior)

**Response:**
```json
{
  "id": "uuid",
  "assessment_type": "holland",
  "version": 1,
  "title": "Assessment Title",
  "status": "draft",
  "is_age_branched": true,
  "publish_state": {
    "child": "draft",
    "teen": "draft",
    "adult": "draft",
    "senior": "draft"
  },
  "created_at": "2026-07-15T00:00:00Z",
  "created_by": "user@example.com"
}
```

**Status Codes:**
- 200: Success
- 404: Assessment not found
- 403: Unauthorized

---

### PUT /api/assessments/{version_id}
**Update assessment metadata**

**Request Body:**
```json
{
  "title": "Updated Title",
  "notes": "Updated notes",
  "is_age_branched": true
}
```

**Response:** Updated assessment object (as above)

**Status Codes:**
- 200: Success
- 409: Version not editable (published/archived)
- 404: Not found

---

### DELETE /api/assessments/{version_id}
**Delete assessment (cascades to questions, branches, scoring models)**

**Status Codes:**
- 204: Success
- 404: Not found

---

## Age-Branching Endpoints

### GET /api/assessments/{version_id}/branches
**List all age branches for an assessment**

**Response:**
```json
[
  {
    "id": "uuid",
    "assessment_id": "uuid",
    "age_group": "child",
    "state": "draft",
    "created_at": "2026-07-15T00:00:00Z",
    "created_from_id": null
  },
  {
    "id": "uuid",
    "assessment_id": "uuid",
    "age_group": "teen",
    "state": "draft",
    "created_at": "2026-07-15T00:00:00Z",
    "created_from_id": "uuid"  // if copied from another branch
  }
]
```

**Status Codes:**
- 200: Success
- 404: Assessment not found

---

### POST /api/assessments/{version_id}/branches/{age_group}/init
**Initialize an age branch (copy-on-first-edit)**

Copies all questions and scoring models from parent version to the target age branch.

**Parameters:**
- `age_group` (path, required): child|teen|adult|senior

**Request Body:**
```json
{}
```

**Response:**
```json
{
  "id": "uuid",
  "assessment_id": "uuid",
  "age_group": "child",
  "state": "draft",
  "created_from_id": null,
  "created_at": "2026-07-15T00:00:00Z"
}
```

**Status Codes:**
- 200: Success
- 404: Assessment not found
- 409: Branch already initialized

---

### PUT /api/assessments/{version_id}/branches/{age_group}/state
**Update branch workflow state**

Valid transitions: draft → reviewed → approved → published

**Parameters:**
- `age_group` (path, required): child|teen|adult|senior

**Request Body:**
```json
{
  "state": "reviewed"
}
```

**Response:** Updated branch object

**Status Codes:**
- 200: Success
- 400: Invalid state transition
- 404: Branch not found

---

## Question Bank Endpoints

### GET /api/assessments/{version_id}/questions
**List all questions for an assessment**

**Query Parameters:**
- `age_group` (optional): Filter by age group

**Response:**
```json
[
  {
    "id": "uuid",
    "assessment_version_id": "uuid",
    "kind": "likert",
    "dimension": "R",
    "text": "I like working with my hands",
    "order_index": 0,
    "is_reverse_scored": false,
    "age_variants": {
      "child": "I like to make things",
      "teen": "I enjoy building and creating"
    },
    "options": [
      {
        "id": "uuid",
        "label": "Strongly Disagree",
        "value": 1,
        "pole": "R",
        "weight": 1.0,
        "order_index": 0
      }
    ],
    "created_at": "2026-07-15T00:00:00Z"
  }
]
```

---

### POST /api/assessments/{version_id}/questions
**Create a new question**

**Request Body:**
```json
{
  "kind": "likert",
  "dimension": "R",
  "text": "I like working with my hands",
  "order_index": 0,
  "is_reverse_scored": false,
  "options": [
    {
      "label": "Strongly Disagree",
      "value": 1,
      "pole": "R",
      "weight": 1.0,
      "order_index": 0
    },
    {
      "label": "Strongly Agree",
      "value": 5,
      "pole": "R",
      "weight": 1.0,
      "order_index": 1
    }
  ],
  "age_variants": {
    "child": "I like to make things"
  }
}
```

**Status Codes:**
- 201: Created
- 400: Invalid request
- 409: Version not editable

---

### PUT /api/assessments/{version_id}/questions/{question_id}
**Update an existing question**

Same request body schema as POST.

**Status Codes:**
- 200: Success
- 404: Question not found
- 409: Version not editable

---

### DELETE /api/assessments/{version_id}/questions/{question_id}
**Delete a question**

**Status Codes:**
- 204: Success
- 404: Question not found

---

### POST /api/assessments/{version_id}/questions/reorder
**Reorder questions (drag-drop support)**

**Request Body:**
```json
{
  "items": [
    {
      "question_id": "uuid",
      "order_index": 0
    },
    {
      "question_id": "uuid",
      "order_index": 1
    }
  ]
}
```

**Response:** Reordered questions array

**Status Codes:**
- 200: Success
- 404: Question not found

---

## Scoring Models Endpoints

### GET /api/assessments/{version_id}/scoring-models
**List all scoring models for an assessment**

**Response:**
```json
[
  {
    "id": "uuid",
    "assessment_version_id": "uuid",
    "name": "Holland Hexagon Score",
    "algorithm": "weighted_sum",
    "weight": 1.0,
    "output_type": "score",
    "config_json": {
      "thresholds": [10, 20, 30, 40],
      "dimension_weights": {
        "R": 1.0,
        "I": 1.0,
        "A": 1.0,
        "S": 1.0,
        "E": 1.0,
        "C": 1.0
      }
    },
    "version": 1,
    "created_at": "2026-07-15T00:00:00Z"
  }
]
```

---

### POST /api/assessments/{version_id}/scoring-models
**Create a new scoring model**

**Request Body:**
```json
{
  "formula_key": "holland_hexagon",
  "expression": {
    "algorithm": "weighted_sum",
    "rules": []
  }
}
```

**Response:** Created model object

**Status Codes:**
- 201: Created
- 400: Invalid config

---

### PUT /api/assessments/{version_id}/scoring-models/{model_id}
**Update a scoring model**

Version is automatically incremented. `config_json` is extensible and validated per Phase D/E requirements.

**Request Body:**
```json
{
  "name": "Updated Model Name",
  "config_json": {
    "updated_field": "value"
  }
}
```

**Response:** Updated model (version incremented)

**Status Codes:**
- 200: Success
- 404: Model not found

---

### DELETE /api/assessments/{version_id}/scoring-models/{model_id}
**Delete a scoring model**

**Status Codes:**
- 204: Success
- 404: Model not found

---

## Data Model Reference

### AssessmentVersion
```sql
CREATE TABLE assessment_versions (
  id UUID PRIMARY KEY,
  assessment_type ENUM ('holland', 'mbti', 'combined'),
  version INT,
  title VARCHAR(200),
  status ENUM ('draft', 'reviewed', 'approved', 'published', 'archived'),
  is_age_branched BOOLEAN,
  publish_state JSON,
  created_by VARCHAR(200),
  approved_by VARCHAR(200),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE (assessment_type, version)
);
```

### Question
```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY,
  assessment_version_id UUID NOT NULL,
  kind ENUM ('likert', 'forced_choice'),
  dimension VARCHAR(4),  -- R/I/A/S/E/C or EI/SN/TF/JP
  text TEXT,
  age_variants JSON,  -- {child: "...", teen: "...", ...}
  order_index INT,
  is_reverse_scored BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions(id)
);
```

### QuestionOption
```sql
CREATE TABLE question_options (
  id UUID PRIMARY KEY,
  question_id UUID NOT NULL,
  label VARCHAR(300),
  value INT,
  pole VARCHAR(1),  -- R/I/A/S/E/C or E/I/S/N/T/F/J/P
  weight FLOAT,
  order_index INT,
  created_at TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

### AssessmentBranch
```sql
CREATE TABLE assessment_branches (
  id UUID PRIMARY KEY,
  assessment_id UUID NOT NULL,
  age_group ENUM ('child', 'teen', 'adult', 'senior'),
  branch_version_id UUID,  -- Points to AssessmentVersion for this branch
  state ENUM ('draft', 'reviewed', 'approved', 'published'),
  created_from_id UUID,  -- If copied from another branch
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE (assessment_id, age_group),
  FOREIGN KEY (assessment_id) REFERENCES assessments(id)
);
```

### ScoringModel
```sql
CREATE TABLE scoring_models (
  id UUID PRIMARY KEY,
  assessment_version_id UUID NOT NULL,
  name VARCHAR(255),
  algorithm VARCHAR(100),
  weight DECIMAL(5, 2),
  output_type ENUM ('score', 'category', 'narrative'),
  config_json JSON,
  version INT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (assessment_version_id) REFERENCES assessment_versions(id)
);
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "detail": "Error message describing what went wrong",
  "error_code": "error_type"
}
```

Common error codes:
- `validation_error` — Invalid request body
- `not_found` — Resource not found
- `unauthorized` — Missing or invalid auth token
- `version_not_editable` — Cannot edit published/archived versions
- `state_transition_invalid` — Invalid workflow state transition

---

## Rate Limiting

Authoring endpoints are rate-limited to 100 requests per minute per user.

---

## Versioning Strategy

Scoring models use semantic versioning:
- **Major version (v1, v2, ...)**: Breaking schema changes (Phase F requirement)
- **Minor version**: Non-breaking updates to config JSON
- Version is incremented automatically on each UPDATE

---

## Migration Notes

To deploy Phase C:

```bash
# Run Alembic migrations
alembic upgrade head

# Apply initial assessment version seed data
python scripts/seed_assessments.py
```

---

## Related Documentation

- **Authoring UX Guide**: `docs/authoring-ux-guide.md`
- **Data Model Diagram**: `docs/data-model.md`
- **Frontend Components**: `apps/web/packages/holand-core/src/components/authoring/`
