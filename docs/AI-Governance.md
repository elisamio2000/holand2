# Phase E: AI Governance & Narrative Generation

**Version:** 1.0  
**Status:** v1 Release Ready  
**Last Updated:** 2026-07-15

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [AI Provider Integration](#ai-provider-integration)
4. [Narrative Generation](#narrative-generation)
5. [Configuration & Governance](#configuration--governance)
6. [Token Tracking & Audit Trail](#token-tracking--audit-trail)
7. [Ollama Setup Guide](#ollama-setup-guide)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Phase E implements an **AI-driven narrative generation system** for student assessments, centered on:

- **Provider Abstraction**: Pluggable LLM backends (Ollama self-hosted, with fallback support)
- **Age-Band Profiles**: 4 distinct AI configurations (child/teen/adult/senior) with age-appropriate styling
- **Governance**: Token counting, audit events, versioning, and graceful degradation
- **Composite Synthesis**: Multi-assessment narratives (e.g., Holland + MBTI) with reconciliation

### Key Principles

1. **No Paid APIs in v1**: All narratives generated via self-hosted Ollama (zero cost)
2. **Config-Driven**: No hardcoded prompts, models, or thresholds
3. **Fallback-First**: Always ensures graceful degradation if AI unavailable
4. **Audit Trail**: Every generation logged with tokens, latency, model version
5. **Age-Aware**: Per-age-band styling ensures developmentally appropriate output

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────┐
│        Report Generation Endpoint            │
│    POST /analysis/generate-narrative         │
└────────────────┬────────────────────────────┘
                 │
         ┌───────▼────────┐
         │ NarrativeService│
         └───────┬────────┘
                 │
        ┌────────┴────────┐
        │                 │
    ┌───▼──────┐   ┌─────▼─────────┐
    │TokenTracker│   │AuditEventEmitter│
    └───┬──────┘   └─────┬─────────┘
        │                 │
        ├─────────────────┤
        │                 │
   ┌────▼─────────┐  ┌───▼──────────┐
   │ AIProvider   │  │CompositeNarrative │
   │  Registry    │  │  Service      │
   └────┬─────────┘  └───┬──────────┘
        │                │
        │ (default)      │
    ┌───▼──────────┐     │
    │OllamaProvider│  (multi-assessment)
    └───┬──────────┘     │
        │                │
        │        ┌───────▼───────┐
        └────────▶│ Ollama Server │
                 │ (self-hosted) │
                 └───────────────┘
```

---

## AI Provider Integration

### AIProvider Interface

Located: `apps/api/app/services/ai_provider.py`

All AI providers implement the `AIProvider` abstract base class:

```python
class AIProvider(ABC):
    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        """Generate narrative from prompt."""
        pass
    
    async def health_check(self) -> bool:
        """Check provider availability."""
        pass
    
    def cost_per_token(self) -> float:
        """Return cost per token for accounting."""
        pass
```

### OllamaProvider Implementation

**File**: `apps/api/app/services/ollama_provider.py`

The default v1 provider:

- **Self-Hosted**: Assumes Ollama running locally (default: `http://localhost:11434`)
- **Async HTTP Client**: Uses `aiohttp` for non-blocking calls
- **Token Counting**: Accurate token tracking from Ollama API responses
- **Health Check**: Pings `/api/tags` endpoint
- **Graceful Retry**: Up to 2 retries on transient failures

### Provider Registry

**File**: `apps/api/app/services/ai_provider.py`

Allows hot-swappable provider selection:

```python
registry = AIProviderRegistry()
registry.register("ollama", ollama_provider, set_default=True)
registry.register("fallback", fallback_provider)

provider = registry.get("ollama")  # or registry.default()
```

---

## Narrative Generation

### NarrativeService

**File**: `apps/api/app/services/narrative_service.py`

Core service for generating structured narratives:

```python
narrative = await narrative_service.generate_narrative(
    assessment_type="holland",
    age_band=AgeBand.TEEN,
    hardcards=hardcards_output,
    scores=scores_dict,
    session_id="session_id",
    analysis_id="analysis_id",
)
```

### Output Structure

All narratives include:

```json
{
  "version": "1.0",
  "ai_config_version": "1.0",
  "generated_at": "2026-07-15T10:30:00Z",
  "provider": {
    "name": "ollama",
    "model": "mistral:7b"
  },
  "tokens": {
    "in": 150,
    "out": 200
  },
  "latency_ms": 2500,
  "narrative": {
    "interpretation": "You show strong interests in creative fields...",
    "strengths": "Artistic ability, visual thinking...",
    "development_areas": "Technical skills...",
    "recommended_paths": "Design, UX/UI, illustration...",
    "faq": "Q: Can I combine interests? A: Yes..."
  },
  "status": "generated"
}
```

### Fallback Behavior

If AI provider is unavailable:

```json
{
  "status": "fallback",
  "provider": { "name": "fallback", "model": "template" },
  "narrative": {
    "interpretation": "(template-based)",
    "strengths": "(from hardcards)",
    "development_areas": "Continue exploring...",
    "recommended_paths": "(from hardcards)",
    "faq": "Q: What are these results?..."
  },
  "error": "Provider error message"
}
```

---

## Configuration & Governance

### Age-Band Profiles

**File**: `apps/api/app/schemas/ai_config.py`

Four default profiles; each configures:

- `ai_provider`: Provider name (e.g., "ollama")
- `model_name`: Model identifier (e.g., "mistral:7b")
- `temperature`: Creativity level (0.6 for child, 0.7 for others)
- `max_tokens`: Response length cap (400–600 depending on age band)
- `system_prompt_template`: Role/context for the LLM
- `style_guidelines`: Age-appropriate tone, length, focus (stored for frontend hints)
- `ai_config_version`: Version for audit trail

#### Child (6-12)
- **Tone**: Playful, encouraging, simple vocabulary
- **System Prompt**: "You are a friendly, encouraging guidance counselor..."
- **Max Tokens**: 400
- **Audience**: Child + parent (dual-read format)

#### Teen (13-17)
- **Tone**: Relatable, authentic, non-preachy
- **System Prompt**: "You are a supportive guidance counselor..."
- **Max Tokens**: 500
- **Audience**: Teenager with optional parent visibility

#### Adult (18-50)
- **Tone**: Professional, data-driven, action-oriented
- **System Prompt**: "You are a professional career coach..."
- **Max Tokens**: 600
- **Audience**: Professional adult

#### Senior (50+)
- **Tone**: Respectful, wisdom-acknowledging
- **System Prompt**: "You are a compassionate life coach..."
- **Max Tokens**: 500
- **Audience**: Mature adult

### Modifying Profiles (Phase F)

Profiles are stored in code and can be:

1. **In-Memory** (v1): Loaded at startup from `DEFAULT_PROFILES`
2. **Database** (Phase F+): Stored in admin settings table for hot updates

To customize, edit `apps/api/app/schemas/ai_config.py` and redeploy.

---

## Token Tracking & Audit Trail

### TokenTracker

**File**: `apps/api/app/services/token_tracker.py`

Tracks all narrative generations for accounting:

```python
tracker = TokenTracker()

record = await tracker.track_generation(
    provider="ollama",
    model="mistral:7b",
    tokens_in=150,
    tokens_out=200,
    latency_ms=2500,
    ai_config_version="1.0",
    session_id="session123",
    analysis_id="analysis456",
)

summary = tracker.get_usage_summary(session_id="session123")
# Returns: total_tokens, total_cost, avg_latency, generation_count
```

### Cost Model

- **Ollama (self-hosted)**: $0.00 per token ✓
- **GPT-5 (fallback)**: $0.001 per token
- Costs multiplied across (tokens_in + tokens_out)

### Audit Events

**File**: `apps/api/app/services/token_tracker.py`

Integrates with Phase B event timeline:

```python
event = await audit_emitter.emit_narrative_generated(
    session_id="...",
    analysis_id="...",
    provider="ollama",
    model="mistral:7b",
    tokens_in=150,
    tokens_out=200,
    latency_ms=2500,
    status="generated",
)
```

Stored events enable:
- Usage dashboards (Phase F)
- Cost allocation per user/session
- Model performance analysis
- Audit compliance

---

## Ollama Setup Guide

### Prerequisites

- **Docker** (or native Ollama installation)
- **GPU** (optional, for faster inference; CPU works but slower)
- **Disk Space**: ~4–7GB for mistral:7b model

### Quick Start (Docker)

1. **Run Ollama in Docker**:

   ```bash
   docker run -d \
     --name ollama \
     -p 11434:11434 \
     -v ollama:/root/.ollama \
     ollama/ollama:latest
   ```

2. **Download model**:

   ```bash
   docker exec ollama ollama pull mistral:7b
   ```

   (First pull may take 5–10 minutes depending on connection)

3. **Verify**:

   ```bash
   curl http://localhost:11434/api/tags
   ```

   Should return: `{"models": [{"name": "mistral:7b", ...}]}`

### Local Installation (No Docker)

1. **Download Ollama**: https://ollama.ai
2. **Install** and start service
3. **Download model**:

   ```bash
   ollama pull mistral:7b
   ```

### Configuration in API

In `apps/api/app/config.py` or environment:

```python
OLLAMA_BASE_URL = "http://localhost:11434"  # or your server IP
```

### Health Check

API automatically checks Ollama health on startup. If unreachable, fallback mode activates.

---

## API Reference

### POST /analysis/generate-narrative

**Endpoint**: Generate narrative for an assessment

**Request**:

```json
{
  "analysis_id": "analysis_456",
  "session_id": "session_123",
  "assessment_type": "holland",
  "age_band": "teen",
  "hardcards": {
    "scores_table": {"R": 80, "I": 75, "A": 85},
    "interpretation": "Strong artistic interests",
    "next_steps": ["Explore design careers", "Take art electives"]
  },
  "scores": {"R": 80, "I": 75, "A": 85, "S": 70, "E": 72, "C": 68}
}
```

**Response** (200 OK):

```json
{
  "version": "1.0",
  "ai_config_version": "1.0",
  "generated_at": "2026-07-15T10:30:00Z",
  "provider": {"name": "ollama", "model": "mistral:7b"},
  "tokens": {"in": 150, "out": 200},
  "latency_ms": 2500,
  "narrative": {
    "interpretation": "...",
    "strengths": "...",
    "development_areas": "...",
    "recommended_paths": "...",
    "faq": "..."
  },
  "status": "generated"
}
```

**Error Handling**:
- Invalid age_band → 400 Bad Request
- Missing hardcards → 400 Bad Request
- Ollama unavailable → 200 OK (fallback response)

---

## Troubleshooting

### Ollama Not Responding

**Symptom**: Narrative returns fallback status

**Check**:

```bash
curl http://localhost:11434/api/tags
```

**Solution**:

1. Ensure Ollama is running: `docker ps | grep ollama`
2. Pull model if missing: `ollama pull mistral:7b`
3. Check logs: `docker logs ollama`
4. Verify firewall: Port 11434 open on network

### Slow Narrative Generation

**Cause**: Model running on CPU (not GPU)

**Solution**:

1. Check Ollama logs for GPU detection
2. Ensure GPU drivers installed (NVIDIA CUDA, AMD ROCm)
3. Run Ollama on machine with GPU

### Hallucinated or Inappropriate Output

**Cause**: Model inherent variability

**Mitigation** (Phase F+):

- Add fact-checking layer (secondary LLM)
- Implement content filters
- Use higher temperature (0.6 vs 0.7) for consistency

### High Token Counts

**Cause**: Verbose model responses or large input

**Solution**:

1. Lower `max_tokens` in age-band profile
2. Trim hardcards input
3. Use more concise system prompts

---

## Versioning & Maintenance

### ai_config_version

Incremented when profile semantics change:

- `1.0` → initial release
- `1.1` → prompt refinement (same structure)
- `2.0` → breaking change (new output fields)

### Migration Path

As new features roll out (Phase F+):

1. New profiles created in DB (or code)
2. Existing analyses inherit profile_version for reproducibility
3. Audit trail tracks version for each generation

---

## Next Steps (Phase F & Beyond)

- **Reporting UI**: Admin dashboard for token usage, cost allocation
- **Fact-Checking**: Secondary LLM validates claims
- **A/B Testing**: Compare model profiles; measure effectiveness
- **Paid Integrations**: Optional support for GPT-4, Claude (post-v1)
- **Content Filters**: Ensure outputs meet safety guidelines

---

## References

- [Ollama Documentation](https://ollama.ai)
- [Mistral LLM](https://mistral.ai)
- Phase D: Analysis Templates & Hardcards
- Phase B: Event Timeline & Audit Trail
- Phase C: Age-Band Selection

---

**Questions?** Contact the development team or open an issue in the repository.
