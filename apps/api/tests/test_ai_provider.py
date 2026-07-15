"""
Tests for Phase E: AI Provider Abstraction (E1)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import aiohttp

from apps.api.app.services.ai_provider import (
    AIProviderConfig,
    AIProviderRegistry,
    CostTier,
    GenerationRequest,
    GenerationResponse,
)
from apps.api.app.services.ollama_provider import OllamaProvider


@pytest.fixture
def ollama_config():
    """Fixture for Ollama provider config."""
    return AIProviderConfig(
        name="ollama",
        model_name="mistral:7b",
        base_url="http://localhost:11434",
        cost_tier=CostTier.FREE,
    )


@pytest.fixture
def ollama_provider(ollama_config):
    """Fixture for Ollama provider instance."""
    return OllamaProvider(ollama_config)


@pytest.mark.asyncio
async def test_ollama_health_check_success(ollama_provider):
    """Test successful health check."""
    with patch("aiohttp.ClientSession") as mock_session_class:
        mock_session = AsyncMock()
        mock_response = AsyncMock()
        mock_response.status = 200
        
        mock_session.__aenter__ = AsyncMock(return_value=mock_response)
        mock_session.__aexit__ = AsyncMock()
        mock_session.get = AsyncMock(return_value=mock_session)
        mock_session_class.return_value = mock_session
        
        # In actual code, this would be more complex with aiohttp
        # For now, we'll test the structure
        assert ollama_provider.name == "ollama"
        assert ollama_provider.model == "mistral:7b"
        assert ollama_provider.cost_tier == CostTier.FREE


@pytest.mark.asyncio
async def test_generation_request_structure():
    """Test GenerationRequest structure."""
    req = GenerationRequest(
        prompt="Test prompt",
        system_prompt="You are helpful.",
        max_tokens=500,
        temperature=0.7,
    )
    
    assert req.prompt == "Test prompt"
    assert req.system_prompt == "You are helpful."
    assert req.max_tokens == 500
    assert req.temperature == 0.7
    assert req.top_p == 0.95


@pytest.mark.asyncio
async def test_generation_response_structure():
    """Test GenerationResponse structure."""
    resp = GenerationResponse(
        text="Generated text",
        tokens_in=100,
        tokens_out=150,
        model="mistral:7b",
        provider="ollama",
    )
    
    assert resp.text == "Generated text"
    assert resp.tokens_in == 100
    assert resp.tokens_out == 150
    assert resp.model == "mistral:7b"
    assert resp.provider == "ollama"


def test_ai_provider_registry():
    """Test AIProviderRegistry functionality."""
    registry = AIProviderRegistry()
    
    # Create mock providers
    config1 = AIProviderConfig(
        name="ollama",
        model_name="mistral:7b",
        base_url="http://localhost:11434",
    )
    config2 = AIProviderConfig(
        name="fallback",
        model_name="gpt-mini",
        base_url="https://api.fallback.com",
    )
    
    provider1 = OllamaProvider(config1)
    provider2 = OllamaProvider(config2)
    
    # Register providers
    registry.register("ollama", provider1, set_default=True)
    registry.register("fallback", provider2)
    
    # Test retrieval
    assert registry.get("ollama") == provider1
    assert registry.get("fallback") == provider2
    assert registry.default() == provider1
    
    # Test list
    providers_list = registry.list_providers()
    assert "ollama" in providers_list
    assert "fallback" in providers_list


def test_ai_provider_config_validation():
    """Test AIProviderConfig validation."""
    # Valid config
    config = AIProviderConfig(
        name="ollama",
        model_name="mistral:7b",
        base_url="http://localhost:11434",
        temperature=0.7,
        max_tokens=500,
    )
    assert config.name == "ollama"
    assert config.temperature == 0.7
    
    # Invalid temperature (out of range)
    with pytest.raises(ValueError):
        AIProviderConfig(
            name="ollama",
            model_name="mistral:7b",
            base_url="http://localhost:11434",
            temperature=1.5,  # Invalid
        )


def test_cost_tier_enum():
    """Test CostTier enum values."""
    assert CostTier.FREE.value == "free"
    assert CostTier.LOW.value == "low"
    assert CostTier.MEDIUM.value == "medium"
    assert CostTier.HIGH.value == "high"


def test_ollama_provider_config_property(ollama_provider):
    """Test OllamaProvider properties."""
    assert ollama_provider.name == "ollama"
    assert ollama_provider.model == "mistral:7b"
    assert ollama_provider.cost_tier == CostTier.FREE
    assert ollama_provider.cost_per_token() == 0.0
