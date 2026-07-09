"""Tests for the Expert Lab draft/review/publish workflow API."""

import pytest


async def _create_draft(client, title="Sample question"):
    response = await client.post(
        "/expert-lab/drafts",
        json={
            "kind": "question",
            "title": title,
            "body": "Do you enjoy building things with your hands?",
            "author": "analyst@holand.dev",
        },
    )
    assert response.status_code == 201
    return response.json()


class TestExpertLabWorkflow:
    @pytest.mark.asyncio
    async def test_create_draft(self, client):
        draft = await _create_draft(client)
        assert draft["kind"] == "question"
        assert len(draft["versions"]) == 1
        assert draft["versions"][0]["status"] == "draft"
        assert draft["versions"][0]["version_number"] == 1

    @pytest.mark.asyncio
    async def test_full_review_publish_flow(self, client):
        draft = await _create_draft(client)
        draft_id = draft["id"]

        submit = await client.post(f"/expert-lab/drafts/{draft_id}/submit")
        assert submit.status_code == 200
        assert submit.json()["status"] == "in_review"

        approve = await client.post(
            f"/expert-lab/drafts/{draft_id}/approve",
            json={"reviewer": "reviewer@holand.dev", "notes": "Looks good"},
        )
        assert approve.status_code == 200
        assert approve.json()["status"] == "approved"
        assert approve.json()["reviewer"] == "reviewer@holand.dev"

        publish = await client.post(f"/expert-lab/drafts/{draft_id}/publish")
        assert publish.status_code == 200
        assert publish.json()["status"] == "published"

    @pytest.mark.asyncio
    async def test_cannot_publish_before_approval(self, client):
        draft = await _create_draft(client)
        draft_id = draft["id"]
        response = await client.post(f"/expert-lab/drafts/{draft_id}/publish")
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_reject_flow(self, client):
        draft = await _create_draft(client)
        draft_id = draft["id"]
        await client.post(f"/expert-lab/drafts/{draft_id}/submit")

        reject = await client.post(
            f"/expert-lab/drafts/{draft_id}/reject",
            json={"reviewer": "reviewer@holand.dev", "notes": "Needs rewording"},
        )
        assert reject.status_code == 200
        assert reject.json()["status"] == "rejected"

    @pytest.mark.asyncio
    async def test_revision_creates_new_version(self, client):
        draft = await _create_draft(client)
        draft_id = draft["id"]

        revision = await client.post(
            f"/expert-lab/drafts/{draft_id}/revisions",
            json={"body": "Updated wording of the question", "author": "analyst@holand.dev"},
        )
        assert revision.status_code == 201
        assert revision.json()["version_number"] == 2
        assert revision.json()["status"] == "draft"

    @pytest.mark.asyncio
    async def test_get_missing_draft_404(self, client):
        response = await client.get("/expert-lab/drafts/does-not-exist")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_drafts(self, client):
        await _create_draft(client, title="Q1")
        await _create_draft(client, title="Q2")
        response = await client.get("/expert-lab/drafts")
        assert response.status_code == 200
        assert len(response.json()) == 2
