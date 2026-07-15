"""
AI Provider Abstraction Layer
Defines interface for pluggable LLM backends (Ollama, paid APIs, etc.)
Phase E: AI Governance & Narrative Generation
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from enum import Enum


class CostTier(str, Enum):
    """Cost categorization for usage tracking."""
    FREE = "free"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class AIProviderConfig:
    """Configuration for an AI provider instance."""
    name: str  # e.g., "ollama", "gpt-5", "claude"
    model_name: str  # e.g., "mistral:7b", "haiku"
    base_url: str  # e.g., "http://localhost:11434" for Ollama
    api_key: Optional[str] = None
    timeout_seconds: int = 30
    max_retries: int = 2
    cost_tier: CostTier = CostTier.FREE


@dataclass
class GenerationRequest:
    """Request parameters for narrative generation."""
    prompt: str
    system_prompt: Optional[str] = None
    max_tokens: int = 500
    temperature: float = 0.7
    top_p: float = 0.95


@dataclass
class GenerationResponse:
    """Response from LLM generation."""
    text: str
    tokens_in: int
    tokens_out: int
    model: str
    provider: str


class AIProvider(ABC):
    """Abstract base class for AI providers."""

    def __init__(self, config: AIProviderConfig):
        self.config = config
        self.name = config.name
        self.model = config.model_name
        self.cost_tier = config.cost_tier

    @abstractmethod
    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        """
        Generate narrative content from prompt.
        
        Args:
            request: GenerationRequest with prompt, system_prompt, max_tokens, temperature
            
        Returns:
            GenerationResponse with text, token counts, model, provider
            
        Raises:
            Exception: if generation fails after retries
        """
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if provider is reachable and healthy."""
        pass

    def cost_per_token(self) -> float:
        """Return cost per token for this provider (used in token tracking)."""
        tier_costs = {
            CostTier.FREE: 0.0,
            CostTier.LOW: 0.00001,
            CostTier.MEDIUM: 0.0001,
            CostTier.HIGH: 0.001,
        }
        return tier_costs.get(self.cost_tier, 0.0)


class AIProviderRegistry:
    """Registry for managing available AI providers."""

    def __init__(self):
        self._providers = {}
        self._default_provider = None

    def register(self, name: str, provider: AIProvider, set_default: bool = False):
        """Register an AI provider by name."""
        self._providers[name] = provider
        if set_default or self._default_provider is None:
            self._default_provider = name

    def get(self, name: Optional[str] = None) -> AIProvider:
        """Get a registered provider by name, or default if name is None."""
        name = name or self._default_provider
        if name not in self._providers:
            raise ValueError(f"Provider '{name}' not found in registry")
        return self._providers[name]

    def list_providers(self):
        """List all registered provider names."""
        return list(self._providers.keys())

    def default(self) -> AIProvider:
        """Get default provider."""
        if self._default_provider is None:
            raise ValueError("No default provider registered")
        return self._providers[self._default_provider]
