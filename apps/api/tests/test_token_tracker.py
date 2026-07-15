"""
Tests for Token Tracking & Audit Events (E5)
"""

import pytest
from datetime import datetime

from apps.api.app.services.token_tracker import TokenTracker, AuditEventEmitter, TokenUsageRecord


@pytest.fixture
def token_tracker():
    """Token tracker instance."""
    return TokenTracker()


@pytest.fixture
def audit_emitter():
    """Audit event emitter instance."""
    return AuditEventEmitter()


@pytest.mark.asyncio
async def test_track_generation_ollama(token_tracker):
    """Test tracking an Ollama generation (free provider)."""
    record = await token_tracker.track_generation(
        provider="ollama",
        model="mistral:7b",
        tokens_in=150,
        tokens_out=200,
        latency_ms=2500,
        ai_config_version="1.0",
        session_id="session123",
        analysis_id="analysis456",
    )
    
    assert record.provider_name == "ollama"
    assert record.tokens_in == 150
    assert record.tokens_out == 200
    assert record.latency_ms == 2500
    assert record.cost == 0.0  # Free provider
    assert record.session_id == "session123"


@pytest.mark.asyncio
async def test_track_generation_paid_provider(token_tracker):
    """Test tracking a paid provider (fallback)."""
    record = await token_tracker.track_generation(
        provider="gpt-5",
        model="gpt-5-mini",
        tokens_in=100,
        tokens_out=150,
        latency_ms=1500,
        ai_config_version="1.0",
    )
    
    # Should calculate cost: (100 + 150) * 0.001 = 0.25
    assert record.cost == 0.25
    assert record.provider_name == "gpt-5"


@pytest.mark.asyncio
async def test_usage_summary_empty(token_tracker):
    """Test usage summary with no records."""
    summary = token_tracker.get_usage_summary()
    
    assert summary["total_tokens_in"] == 0
    assert summary["total_tokens_out"] == 0
    assert summary["total_cost"] == 0.0
    assert summary["generation_count"] == 0


@pytest.mark.asyncio
async def test_usage_summary_aggregation(token_tracker):
    """Test usage summary aggregation."""
    # Track multiple generations
    await token_tracker.track_generation(
        provider="ollama",
        model="mistral:7b",
        tokens_in=100,
        tokens_out=150,
        latency_ms=2000,
        ai_config_version="1.0",
        session_id="session123",
    )
    
    await token_tracker.track_generation(
        provider="ollama",
        model="mistral:7b",
        tokens_in=80,
        tokens_out=120,
        latency_ms=1500,
        ai_config_version="1.0",
        session_id="session123",
    )
    
    summary = token_tracker.get_usage_summary(session_id="session123")
    
    assert summary["total_tokens_in"] == 180  # 100 + 80
    assert summary["total_tokens_out"] == 270  # 150 + 120
    assert summary["generation_count"] == 2
    assert summary["avg_latency_ms"] == 1750  # (2000 + 1500) / 2


@pytest.mark.asyncio
async def test_usage_summary_filtered_by_session(token_tracker):
    """Test usage summary filtering by session ID."""
    await token_tracker.track_generation(
        provider="ollama",
        model="mistral:7b",
        tokens_in=100,
        tokens_out=150,
        latency_ms=2000,
        ai_config_version="1.0",
        session_id="session1",
    )
    
    await token_tracker.track_generation(
        provider="ollama",
        model="mistral:7b",
        tokens_in=50,
        tokens_out=75,
        latency_ms=1000,
        ai_config_version="1.0",
        session_id="session2",
    )
    
    summary1 = token_tracker.get_usage_summary(session_id="session1")
    summary2 = token_tracker.get_usage_summary(session_id="session2")
    
    assert summary1["total_tokens_in"] == 100
    assert summary2["total_tokens_in"] == 50


@pytest.mark.asyncio
async def test_audit_event_emission(audit_emitter):
    """Test audit event emission."""
    event = await audit_emitter.emit_narrative_generated(
        session_id="session123",
        analysis_id="analysis456",
        provider="ollama",
        model="mistral:7b",
        tokens_in=150,
        tokens_out=200,
        latency_ms=2500,
        status="generated",
    )
    
    assert event["type"] == "ai.narrative_generated"
    assert event["session_id"] == "session123"
    assert event["analysis_id"] == "analysis456"
    assert event["details"]["provider"] == "ollama"
    assert event["details"]["tokens_in"] == 150
    assert event["details"]["status"] == "generated"
    assert "timestamp" in event


def test_token_usage_record_structure():
    """Test TokenUsageRecord data structure."""
    record = TokenUsageRecord(
        session_id="session123",
        analysis_id="analysis456",
        provider_name="ollama",
        model_name="mistral:7b",
        tokens_in=100,
        tokens_out=150,
        latency_ms=2000,
        ai_config_version="1.0",
        generated_at=datetime.utcnow(),
        cost=0.0,
    )
    
    assert record.session_id == "session123"
    assert record.tokens_in == 100
    assert record.provider_name == "ollama"
    assert record.cost == 0.0
