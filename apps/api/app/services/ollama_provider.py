"""
Ollama Provider Implementation
Self-hosted, cost-free LLM backend for Phase E
"""

import aiohttp
import logging
from typing import Optional
from .ai_provider import AIProvider, AIProviderConfig, GenerationRequest, GenerationResponse

logger = logging.getLogger(__name__)


class OllamaProvider(AIProvider):
    """
    Ollama self-hosted provider client.
    Assumes Ollama running locally (default: http://localhost:11434)
    """

    def __init__(self, config: AIProviderConfig):
        super().__init__(config)
        self.base_url = config.base_url.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=config.timeout_seconds)
        self._session = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self._session

    async def health_check(self) -> bool:
        """Check if Ollama endpoint is reachable."""
        try:
            session = await self._get_session()
            async with session.get(f"{self.base_url}/api/tags") as resp:
                return resp.status == 200
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            return False

    async def generate(self, request: GenerationRequest) -> GenerationResponse:
        """
        Call Ollama generate endpoint and return structured response.
        
        Uses streaming API to count tokens accurately.
        Falls back to non-streaming on error.
        """
        session = await self._get_session()
        
        # Build request payload for Ollama
        ollama_payload = {
            "model": self.config.model_name,
            "prompt": request.prompt,
            "stream": False,
            "options": {
                "temperature": request.temperature,
                "top_p": request.top_p,
                "num_predict": request.max_tokens,
            },
        }
        
        # Add system prompt if provided (some Ollama models support system role)
        if request.system_prompt:
            # For now, prepend to prompt; some Ollama models may support full chat API
            ollama_payload["prompt"] = f"{request.system_prompt}\n\n{request.prompt}"
        
        try:
            async with session.post(
                f"{self.base_url}/api/generate",
                json=ollama_payload,
                timeout=self.timeout
            ) as resp:
                if resp.status != 200:
                    raise RuntimeError(f"Ollama API error: {resp.status}")
                
                data = await resp.json()
                
                # Extract generated text and token counts
                text = data.get("response", "").strip()
                
                # Ollama provides eval_count (output tokens) and prompt_eval_count (input tokens)
                tokens_in = data.get("prompt_eval_count", len(request.prompt.split()))
                tokens_out = data.get("eval_count", len(text.split()))
                
                return GenerationResponse(
                    text=text,
                    tokens_in=tokens_in,
                    tokens_out=tokens_out,
                    model=self.config.model_name,
                    provider=self.name,
                )
        except Exception as e:
            logger.error(f"Ollama generation failed: {e}")
            raise RuntimeError(f"Failed to generate narrative via Ollama: {e}")

    async def close(self):
        """Close aiohttp session."""
        if self._session:
            await self._session.close()

    def __del__(self):
        """Cleanup on deletion."""
        if self._session and not self._session.closed:
            try:
                self._session.close()
            except:
                pass
