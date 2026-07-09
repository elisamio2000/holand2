import pytest

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
