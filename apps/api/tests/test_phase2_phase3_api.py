import pytest
from sqlalchemy import delete

from app.models.assessment import QuestionOption

from app.deps import get_current_user
from app.main import app
from app.models.user import User, UserRole


def _holland_draft_payload() -> dict:
    return {
        "assessment_type": "holland",
        "title": "Holland draft test v1",
        "created_by": "test-admin",
        "questions": [
            {
                "kind": "likert",
                "dimension": "R",
                "text": "I enjoy practical technical work.",
                "order_index": 0,
                "is_reverse_scored": False,
                "options": [
                    {"label": "1", "value": 1, "pole": "R", "weight": 1.0, "order_index": 0},
                    {"label": "2", "value": 2, "pole": "R", "weight": 2.0, "order_index": 1},
                    {"label": "3", "value": 3, "pole": "R", "weight": 3.0, "order_index": 2},
                    {"label": "4", "value": 4, "pole": "R", "weight": 4.0, "order_index": 3},
                    {"label": "5", "value": 5, "pole": "R", "weight": 5.0, "order_index": 4},
                ],
            },
            {
                "kind": "likert",
                "dimension": "I",
                "text": "I enjoy deep analysis.",
                "order_index": 1,
                "is_reverse_scored": False,
                "options": [
                    {"label": "1", "value": 1, "pole": "I", "weight": 1.0, "order_index": 0},
                    {"label": "2", "value": 2, "pole": "I", "weight": 2.0, "order_index": 1},
                    {"label": "3", "value": 3, "pole": "I", "weight": 3.0, "order_index": 2},
                    {"label": "4", "value": 4, "pole": "I", "weight": 4.0, "order_index": 3},
                    {"label": "5", "value": 5, "pole": "I", "weight": 5.0, "order_index": 4},
                ],
            },
        ],
    }


def _reverse_scored_holland_payload() -> dict:
    return {
        "assessment_type": "holland",
        "title": "Holland reverse-score test",
        "created_by": "test-admin",
        "questions": [
            {
                "kind": "likert",
                "dimension": "R",
                "text": "I enjoy reverse scored practical work.",
                "order_index": 0,
                "is_reverse_scored": True,
                "options": [
                    {"label": "1", "value": 1, "pole": "R", "weight": 1.0, "order_index": 0},
                    {"label": "2", "value": 2, "pole": "R", "weight": 2.0, "order_index": 1},
                    {"label": "3", "value": 3, "pole": "R", "weight": 3.0, "order_index": 2},
                    {"label": "4", "value": 4, "pole": "R", "weight": 4.0, "order_index": 3},
                    {"label": "5", "value": 5, "pole": "R", "weight": 5.0, "order_index": 4},
                ],
            }
        ],
    }


@pytest.fixture
def admin_user() -> User:
    return User(
        id="test-admin-id",
        username="admin",
        email="admin@holand.dev",
        hashed_password="not-used-in-tests",
        role=UserRole.ADMIN,
        is_active=True,
    )


@pytest.fixture
def admin_client(client, admin_user: User):
    async def _override_current_user() -> User:
        return admin_user

    app.dependency_overrides[get_current_user] = _override_current_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.asyncio
async def test_admin_versioning_requires_authentication(client) -> None:
    response = await client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_versioning_workflow_and_diff(admin_client) -> None:
    create = await admin_client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    assert create.status_code == 201
    version_id = create.json()["id"]

    review = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/review", json={"actor": "reviewer"}
    )
    assert review.status_code == 200
    assert review.json()["status"] == "reviewed"

    approve = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/approve", json={"actor": "approver"}
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    publish = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/publish", json={"actor": "publisher"}
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"

    clone = await admin_client.post(
        "/admin/assessment-versions/draft",
        json={
            "assessment_type": "holland",
            "title": "Holland draft test v2",
            "created_by": "test-admin",
            "clone_from_version_id": version_id,
        },
    )
    assert clone.status_code == 201
    clone_id = clone.json()["id"]

    diff = await admin_client.get(f"/admin/assessment-versions/{version_id}/diff?compare_to={clone_id}")
    assert diff.status_code == 200
    payload = diff.json()
    assert payload["from_version_id"] == version_id
    assert payload["to_version_id"] == clone_id
    assert payload["added"] == []
    assert payload["removed"] == []
    assert payload["changed"] == []


@pytest.mark.asyncio
async def test_formula_workflow_and_simulate(admin_client) -> None:
    create = await admin_client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "mbti_preference_percentage",
            "assessment_type": "mbti",
            "expression": {"expr": "(left / (left + right)) * 100 if (left + right) > 0 else 50"},
            "input_variables": ["left", "right"],
            "output_metric": "preference_percentage",
            "created_by": "test-analyst",
        },
    )
    assert create.status_code == 201
    formula_id = create.json()["id"]

    for action in ("review", "approve", "publish"):
        r = await admin_client.post(
            f"/admin/formula-versions/{formula_id}/{action}", json={"actor": "qa"}
        )
        assert r.status_code == 200
    assert r.json()["status"] == "published"

    simulate = await admin_client.post(
        f"/admin/formula-versions/{formula_id}/simulate",
        json={"variables": {"left": 8, "right": 2}},
    )
    assert simulate.status_code == 200
    assert simulate.json()["result"] == 80.0


@pytest.mark.asyncio
async def test_formula_publish_is_blocked_when_unit_tests_fail(client) -> None:
    create = await client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "mbti_preference_percentage",
            "assessment_type": "mbti",
            "expression": {"expr": "(left / (left + right)) * 100 if (left + right) > 0 else 50"},
            "input_variables": ["left", "right"],
            "output_metric": "preference_percentage",
            "created_by": "test-analyst",
            "unit_tests": [
                {"variables": {"left": 8, "right": 2}, "expected": 10.0, "tolerance": 0.01}
            ],
        },
    )
    assert create.status_code == 201
    formula_id = create.json()["id"]

    review = await client.post(f"/admin/formula-versions/{formula_id}/review", json={"actor": "qa"})
    assert review.status_code == 200
    approve = await client.post(
        f"/admin/formula-versions/{formula_id}/approve", json={"actor": "qa"}
    )
    assert approve.status_code == 200

    publish = await client.post(
        f"/admin/formula-versions/{formula_id}/publish", json={"actor": "qa"}
    )
    assert publish.status_code == 409
    assert "publish gate failed" in publish.json()["detail"].lower()
    assert "unit_tests" in publish.json()["detail"]

    reports = await client.get(
        f"/admin/version-validation-reports?entity_id={formula_id}&entity_type=formula_version"
    )
    assert reports.status_code == 200
    payload = reports.json()
    assert payload
    assert payload[0]["ok"] is False
    assert payload[0]["gate"] == "formula_publish"


@pytest.mark.asyncio
async def test_formula_publish_is_blocked_by_validation_rule_bounds(client) -> None:
    create = await client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "mbti_preference_percentage",
            "assessment_type": "mbti",
            "expression": {"expr": "(left / (left + right)) * 100 if (left + right) > 0 else 50"},
            "input_variables": ["left", "right"],
            "output_metric": "preference_percentage",
            "created_by": "test-analyst",
            "validation_rules": {"min": 0, "max": 60},
            "unit_tests": [{"variables": {"left": 8, "right": 2}, "expected": 80.0}],
        },
    )
    assert create.status_code == 201
    formula_id = create.json()["id"]
    review = await client.post(f"/admin/formula-versions/{formula_id}/review", json={"actor": "qa"})
    assert review.status_code == 200
    approve = await client.post(
        f"/admin/formula-versions/{formula_id}/approve", json={"actor": "qa"}
    )
    assert approve.status_code == 200

    publish = await client.post(
        f"/admin/formula-versions/{formula_id}/publish", json={"actor": "qa"}
    )
    assert publish.status_code == 409
    detail = publish.json()["detail"].lower()
    assert "validation_rules.max" in detail


@pytest.mark.asyncio
async def test_formula_publish_is_blocked_by_drift_threshold(client) -> None:
    base = await client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "mbti_preference_percentage",
            "assessment_type": "mbti",
            "expression": {"expr": "(left / (left + right)) * 100 if (left + right) > 0 else 50"},
            "input_variables": ["left", "right"],
            "output_metric": "preference_percentage",
            "created_by": "test-analyst",
            "unit_tests": [{"variables": {"left": 8, "right": 2}, "expected": 80.0}],
        },
    )
    assert base.status_code == 201
    base_id = base.json()["id"]
    await client.post(f"/admin/formula-versions/{base_id}/review", json={"actor": "qa"})
    await client.post(f"/admin/formula-versions/{base_id}/approve", json={"actor": "qa"})
    base_publish = await client.post(f"/admin/formula-versions/{base_id}/publish", json={"actor": "qa"})
    assert base_publish.status_code == 200

    candidate = await client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "mbti_preference_percentage",
            "assessment_type": "mbti",
            "expression": {"expr": "(right / (left + right)) * 100 if (left + right) > 0 else 50"},
            "input_variables": ["left", "right"],
            "output_metric": "preference_percentage",
            "created_by": "test-analyst",
            "validation_rules": {"max_drift": 5},
            "unit_tests": [{"variables": {"left": 8, "right": 2}, "expected": 20.0}],
        },
    )
    assert candidate.status_code == 201
    candidate_id = candidate.json()["id"]
    await client.post(f"/admin/formula-versions/{candidate_id}/review", json={"actor": "qa"})
    await client.post(f"/admin/formula-versions/{candidate_id}/approve", json={"actor": "qa"})

    publish = await client.post(f"/admin/formula-versions/{candidate_id}/publish", json={"actor": "qa"})
    assert publish.status_code == 409
    detail = publish.json()["detail"].lower()
    assert "max_drift" in detail
    assert "delta" in detail


@pytest.mark.asyncio
async def test_session_api_start_answer_complete_result(client) -> None:
    create = await client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
async def test_session_api_start_answer_complete_result(admin_client) -> None:
    create = await admin_client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    version_id = create.json()["id"]
    await admin_client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "r"})
    await admin_client.post(f"/admin/assessment-versions/{version_id}/approve", json={"actor": "a"})
    await admin_client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "p"})

    start = await admin_client.post("/sessions/start", json={"assessment_type": "holland"})
    assert start.status_code == 201
    body = start.json()
    session_id = body["session_id"]
    assert body["status"] == "in_progress"
    assert len(body["questions"]) == 2

    answers = []
    for q in body["questions"]:
        answers.append({"question_id": q["id"], "option_id": q["options"][-1]["id"]})
    submit = await admin_client.post(f"/sessions/{session_id}/answers", json={"answers": answers})
    assert submit.status_code == 200
    assert submit.json()["answered_count"] == 2

    complete = await admin_client.post(f"/sessions/{session_id}/complete")
    assert complete.status_code == 200
    result = complete.json()
    assert result["session_id"] == session_id
    assert len(result["code"]) == 3
    assert result["raw_scores"]["R"] == 5.0
    assert result["raw_scores"]["I"] == 5.0

    fetch = await admin_client.get(f"/sessions/{session_id}/result")
    assert fetch.status_code == 200
    assert fetch.json()["session_id"] == session_id


@pytest.mark.asyncio
async def test_assessment_quality_report_flags_missing_dimensions_and_duplicates(client) -> None:
    payload = _holland_draft_payload()
    payload["questions"][1]["dimension"] = "R"
    payload["questions"][1]["text"] = payload["questions"][0]["text"]

    create = await client.post("/admin/assessment-versions/draft", json=payload)
    assert create.status_code == 201
    version_id = create.json()["id"]

    report = await client.get(f"/admin/assessment-versions/{version_id}/quality-report")
    assert report.status_code == 200
    body = report.json()
    assert body["ok"] is False
    codes = {issue["code"] for issue in body["issues"]}
    assert "holland_dimension_missing" in codes
    assert "duplicate_question_text" in codes
async def test_assessment_edit_endpoints_and_preflight(admin_client) -> None:
    create = await admin_client.post(
        "/admin/assessment-versions/draft",
        json={
            "assessment_type": "holland",
            "title": "Empty draft",
            "created_by": "test-admin",
            "questions": [],
        },
    )
    assert create.status_code == 201
    version_id = create.json()["id"]

    preflight = await admin_client.get(f"/admin/assessment-versions/{version_id}/preflight")
    assert preflight.status_code == 200
    assert preflight.json()["ready_to_publish"] is False
    assert preflight.json()["blocking_issue_count"] > 0

    add_question = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/questions",
        json={
            "kind": "likert",
            "dimension": "R",
            "text": "I enjoy building practical things.",
            "order_index": 0,
            "is_reverse_scored": False,
            "options": [
                {"label": "Disagree", "value": 1, "pole": "R", "weight": 1.0, "order_index": 0},
                {"label": "Agree", "value": 2, "pole": "R", "weight": 2.0, "order_index": 1},
            ],
        },
    )
    assert add_question.status_code == 201
    question_id = add_question.json()["questions"][0]["id"]

    add_option = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/questions/{question_id}/options",
        json={"label": "Strongly agree", "value": 3, "pole": "R", "weight": 3.0, "order_index": 2},
    )
    assert add_option.status_code == 201
    option_id = add_option.json()["questions"][0]["options"][-1]["id"]

    patch_option = await admin_client.patch(
        f"/admin/assessment-versions/{version_id}/questions/{question_id}/options/{option_id}",
        json={"weight": 3.5},
    )
    assert patch_option.status_code == 200

    patch_question = await admin_client.patch(
        f"/admin/assessment-versions/{version_id}/questions/{question_id}",
        json={"text": "I enjoy hands-on technical work."},
    )
    assert patch_question.status_code == 200

    reorder_options = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/questions/{question_id}/options/reorder",
        json={
            "items": [
                {"option_id": patch_question.json()["questions"][0]["options"][0]["id"], "order_index": 2},
                {"option_id": patch_question.json()["questions"][0]["options"][1]["id"], "order_index": 1},
                {"option_id": option_id, "order_index": 0},
            ]
        },
    )
    assert reorder_options.status_code == 200

    review = await admin_client.post(
        f"/admin/assessment-versions/{version_id}/review", json={"actor": "qa-reviewer"}
    )
    assert review.status_code == 200
    edit_after_review = await admin_client.patch(
        f"/admin/assessment-versions/{version_id}/questions/{question_id}",
        json={"text": "Should fail while not in draft"},
    )
    assert edit_after_review.status_code == 409

    missing_actor = await admin_client.post(f"/admin/assessment-versions/{version_id}/approve", json={})
    assert missing_actor.status_code == 422


@pytest.mark.asyncio
async def test_formula_update_preflight_and_publish_gate(admin_client) -> None:
    create = await admin_client.post(
        "/admin/formula-versions/draft",
        json={
            "formula_key": "holland_normalization_ratio",
            "assessment_type": "holland",
            "expression": {"expr": "(value / total) * 100 if total > 0 else 0"},
            "input_variables": ["value", "total"],
            "output_metric": "normalized_percentage",
            "created_by": "test-analyst",
        },
    )
    assert create.status_code == 201
    formula_id = create.json()["id"]

    bad_update = await admin_client.patch(
        f"/admin/formula-versions/{formula_id}",
        json={"expression": {"expr": "(value / missing) * 100"}},
    )
    assert bad_update.status_code == 400

    valid_update = await admin_client.patch(
        f"/admin/formula-versions/{formula_id}",
        json={
            "expression": {"expr": "(value / total) * 100 if total > 0 else 0"},
            "input_variables": ["value", "total"],
            "output_metric": "normalized_percentage",
        },
    )
    assert valid_update.status_code == 200

    preflight = await admin_client.get(f"/admin/formula-versions/{formula_id}/preflight")
    assert preflight.status_code == 200
    assert preflight.json()["ready_to_publish"] is True

    await admin_client.post(f"/admin/formula-versions/{formula_id}/review", json={"actor": "reviewer"})
    await admin_client.post(f"/admin/formula-versions/{formula_id}/approve", json={"actor": "approver"})
    publish = await admin_client.post(
        f"/admin/formula-versions/{formula_id}/publish",
        json={"actor": "publisher"},
    )
    assert publish.status_code == 200


@pytest.mark.asyncio
async def test_assessment_publish_is_blocked_by_quality_gate(client) -> None:
    payload = _holland_draft_payload()
    payload["questions"][1]["dimension"] = "R"
    payload["questions"][1]["text"] = payload["questions"][0]["text"]

    create = await client.post("/admin/assessment-versions/draft", json=payload)
    assert create.status_code == 201
    version_id = create.json()["id"]

    review = await client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "qa"})
    assert review.status_code == 200
    approve = await client.post(
        f"/admin/assessment-versions/{version_id}/approve", json={"actor": "qa"}
    )
    assert approve.status_code == 200

    publish = await client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "qa"})
    assert publish.status_code == 409
    detail = publish.json()["detail"].lower()
    assert "publish gate failed" in detail
    assert "duplicate_question_text" in detail

    reports = await client.get(
        f"/admin/version-validation-reports?entity_id={version_id}&entity_type=assessment_version"
    )
    assert reports.status_code == 200
    payload = reports.json()
    assert payload
    assert payload[0]["ok"] is False
    assert payload[0]["gate"] == "question_bank_quality"


@pytest.mark.asyncio
async def test_reverse_scored_likert_uses_mirrored_weight(client) -> None:
    create = await client.post("/admin/assessment-versions/draft", json=_reverse_scored_holland_payload())
    assert create.status_code == 201
    version_id = create.json()["id"]
    await client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "r"})
    await client.post(f"/admin/assessment-versions/{version_id}/approve", json={"actor": "a"})
    await client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "p"})

    start = await client.post("/sessions/start", json={"assessment_type": "holland"})
    assert start.status_code == 201
    body = start.json()
    session_id = body["session_id"]
    question = body["questions"][0]

    submit = await client.post(
        f"/sessions/{session_id}/answers",
        json={"answers": [{"question_id": question["id"], "option_id": question["options"][0]["id"]}]},
    )
    assert submit.status_code == 200

    complete = await client.post(f"/sessions/{session_id}/complete")
    assert complete.status_code == 200
    assert complete.json()["raw_scores"]["R"] == 5.0


@pytest.mark.asyncio
async def test_complete_session_returns_integrity_error_for_missing_option(client, db_session) -> None:
    create = await client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    assert create.status_code == 201
    version_id = create.json()["id"]
    await client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "r"})
    await client.post(f"/admin/assessment-versions/{version_id}/approve", json={"actor": "a"})
    await client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "p"})

    start = await client.post("/sessions/start", json={"assessment_type": "holland"})
    session = start.json()
    session_id = session["session_id"]
    selected_option_id = session["questions"][0]["options"][0]["id"]

    submit = await client.post(
        f"/sessions/{session_id}/answers",
        json={"answers": [{"question_id": q["id"], "option_id": q["options"][0]["id"]} for q in session["questions"]]},
    )
    assert submit.status_code == 200

    await db_session.execute(delete(QuestionOption).where(QuestionOption.id == selected_option_id))
    await db_session.commit()

    complete = await client.post(f"/sessions/{session_id}/complete")
    assert complete.status_code == 500
    assert "data integrity error" in complete.json()["detail"].lower()
