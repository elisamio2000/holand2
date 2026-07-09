import pytest


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


@pytest.mark.asyncio
async def test_versioning_workflow_and_diff(client) -> None:
    create = await client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    assert create.status_code == 201
    version_id = create.json()["id"]

    review = await client.post(
        f"/admin/assessment-versions/{version_id}/review", json={"actor": "reviewer"}
    )
    assert review.status_code == 200
    assert review.json()["status"] == "reviewed"

    approve = await client.post(
        f"/admin/assessment-versions/{version_id}/approve", json={"actor": "approver"}
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    publish = await client.post(
        f"/admin/assessment-versions/{version_id}/publish", json={"actor": "publisher"}
    )
    assert publish.status_code == 200
    assert publish.json()["status"] == "published"

    clone = await client.post(
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

    diff = await client.get(f"/admin/assessment-versions/{version_id}/diff?compare_to={clone_id}")
    assert diff.status_code == 200
    payload = diff.json()
    assert payload["from_version_id"] == version_id
    assert payload["to_version_id"] == clone_id
    assert payload["added"] == []
    assert payload["removed"] == []
    assert payload["changed"] == []


@pytest.mark.asyncio
async def test_formula_workflow_and_simulate(client) -> None:
    create = await client.post(
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
        r = await client.post(f"/admin/formula-versions/{formula_id}/{action}", json={"actor": "qa"})
        assert r.status_code == 200
    assert r.json()["status"] == "published"

    simulate = await client.post(
        f"/admin/formula-versions/{formula_id}/simulate",
        json={"variables": {"left": 8, "right": 2}},
    )
    assert simulate.status_code == 200
    assert simulate.json()["result"] == 80.0


@pytest.mark.asyncio
async def test_session_api_start_answer_complete_result(client) -> None:
    create = await client.post("/admin/assessment-versions/draft", json=_holland_draft_payload())
    version_id = create.json()["id"]
    await client.post(f"/admin/assessment-versions/{version_id}/review", json={"actor": "r"})
    await client.post(f"/admin/assessment-versions/{version_id}/approve", json={"actor": "a"})
    await client.post(f"/admin/assessment-versions/{version_id}/publish", json={"actor": "p"})

    start = await client.post("/sessions/start", json={"assessment_type": "holland"})
    assert start.status_code == 201
    body = start.json()
    session_id = body["session_id"]
    assert body["status"] == "in_progress"
    assert len(body["questions"]) == 2

    answers = []
    for q in body["questions"]:
        answers.append({"question_id": q["id"], "option_id": q["options"][-1]["id"]})
    submit = await client.post(f"/sessions/{session_id}/answers", json={"answers": answers})
    assert submit.status_code == 200
    assert submit.json()["answered_count"] == 2

    complete = await client.post(f"/sessions/{session_id}/complete")
    assert complete.status_code == 200
    result = complete.json()
    assert result["session_id"] == session_id
    assert len(result["code"]) == 3
    assert result["raw_scores"]["R"] == 5.0
    assert result["raw_scores"]["I"] == 5.0

    fetch = await client.get(f"/sessions/{session_id}/result")
    assert fetch.status_code == 200
    assert fetch.json()["session_id"] == session_id
