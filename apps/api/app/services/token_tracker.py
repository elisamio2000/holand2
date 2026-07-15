"""
Token Tracking & Usage Accounting
E5: Track token usage and emit audit events for governance
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TokenUsageRecord:
    """Record of token usage for audit trail."""
    session_id: Optional[str]
    analysis_id: Optional[str]
    provider_name: str
    model_name: str
    tokens_in: int
    tokens_out: int
    latency_ms: int
    ai_config_version: str
    generated_at: datetime
    cost: float = 0.0


class TokenTracker:
    """Track token usage and costs for AI generation."""

    def __init__(self, cost_per_token_map: Optional[Dict[str, float]] = None):
        """
        Initialize token tracker.
        
        Args:
            cost_per_token_map: Mapping of provider names to cost per token
        """
        self.cost_per_token_map = cost_per_token_map or {
            "ollama": 0.0,  # Self-hosted, no cost
            "gpt-5": 0.001,  # Example fallback
        }
        self.records = []  # In-memory buffer (in production: DB)

    async def track_generation(
        self,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        latency_ms: int,
        ai_config_version: str,
        session_id: Optional[str] = None,
        analysis_id: Optional[str] = None,
    ) -> TokenUsageRecord:
        """
        Track a narrative generation call.
        
        Args:
            provider: Provider name
            model: Model identifier
            tokens_in: Tokens in prompt
            tokens_out: Tokens in response
            latency_ms: Time taken in milliseconds
            ai_config_version: AI config version used
            session_id: Session ID (optional)
            analysis_id: Analysis ID (optional)
            
        Returns:
            TokenUsageRecord for audit trail
        """
        total_tokens = tokens_in + tokens_out
        cost_per_token = self.cost_per_token_map.get(provider, 0.0)
        total_cost = total_tokens * cost_per_token
        
        record = TokenUsageRecord(
            session_id=session_id,
            analysis_id=analysis_id,
            provider_name=provider,
            model_name=model,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=latency_ms,
            ai_config_version=ai_config_version,
            generated_at=datetime.utcnow(),
            cost=total_cost,
        )
        
        self.records.append(record)
        
        logger.info(
            f"Token tracked: {provider}/{model} | "
            f"In: {tokens_in} | Out: {tokens_out} | "
            f"Latency: {latency_ms}ms | Cost: ${total_cost:.6f}"
        )
        
        return record

    def get_usage_summary(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """Get usage summary for a session or all sessions."""
        filtered = (
            [r for r in self.records if r.session_id == session_id]
            if session_id
            else self.records
        )
        
        if not filtered:
            return {
                "total_tokens_in": 0,
                "total_tokens_out": 0,
                "total_cost": 0.0,
                "generation_count": 0,
                "avg_latency_ms": 0,
            }
        
        total_in = sum(r.tokens_in for r in filtered)
        total_out = sum(r.tokens_out for r in filtered)
        total_cost = sum(r.cost for r in filtered)
        avg_latency = sum(r.latency_ms for r in filtered) / len(filtered)
        
        return {
            "total_tokens_in": total_in,
            "total_tokens_out": total_out,
            "total_tokens": total_in + total_out,
            "total_cost": total_cost,
            "generation_count": len(filtered),
            "avg_latency_ms": avg_latency,
            "records": [
                {
                    "provider": r.provider_name,
                    "model": r.model_name,
                    "tokens_in": r.tokens_in,
                    "tokens_out": r.tokens_out,
                    "latency_ms": r.latency_ms,
                    "cost": r.cost,
                    "generated_at": r.generated_at.isoformat(),
                }
                for r in filtered
            ],
        }


class AuditEventEmitter:
    """Emit audit events for narrative generation (integration with event timeline)."""

    def __init__(self, db_session=None):
        """
        Initialize audit event emitter.
        
        Args:
            db_session: Database session for persisting events (Phase B: event timeline)
        """
        self.db_session = db_session

    async def emit_narrative_generated(
        self,
        session_id: str,
        analysis_id: str,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        latency_ms: int,
        status: str = "generated",
    ) -> Dict[str, Any]:
        """
        Emit audit event for narrative generation.
        
        Integrates with Phase B event timeline for audit trail.
        """
        event = {
            "type": "ai.narrative_generated",
            "session_id": session_id,
            "analysis_id": analysis_id,
            "timestamp": datetime.utcnow().isoformat(),
            "details": {
                "provider": provider,
                "model": model,
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "latency_ms": latency_ms,
                "status": status,
            },
        }
        
        if self.db_session:
            # Persist event (Phase B integration)
            try:
                # Placeholder: actual implementation depends on Phase B event model
                logger.debug(f"Audit event emitted: {event}")
            except Exception as e:
                logger.error(f"Failed to persist audit event: {e}")
        
        logger.info(f"Narrative generation event: {session_id} / {analysis_id} / {status}")
        
        return event
