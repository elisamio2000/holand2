"""LLM Provider Service - Model discovery, health checks, report generation."""

import asyncio
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from jinja2 import Template
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_provider import AIProviderConfig, LLMPromptTemplate, SessionAIReport
from app.models.session import AssessmentSession, SessionResult


_DEFAULT_SYSTEM_PROMPT = (
    "شما یک مشاور خبره‌ی هدایت شغلی و تحصیلی هستید. تمام پاسخ را فقط به زبان فارسی "
    "و با قالب Markdown استاندارد بنویسید (از سرتیتر ##، فهرست‌های نشانه‌دار، و جدول در صورت لزوم استفاده کنید). "
    "تحلیل را دقیقاً بر اساس داده‌ها و امتیازهای واقعی که در ادامه ارائه می‌شود بنویسید و از آوردن متن جای‌گزین، "
    "قالب خالی، یا درخواست اطلاعات از کاربر خودداری کنید. لحن حرفه‌ای، دقیق و متناسب با گروه سنی کاربر باشد."
)


_HOLLAND_LABELS_FA = {
    "R": "واقع‌گرا (Realistic)",
    "I": "جستجوگر (Investigative)",
    "A": "هنری (Artistic)",
    "S": "اجتماعی (Social)",
    "E": "متهور (Enterprising)",
    "C": "قراردادی (Conventional)",
}


def _build_data_block(session: "AssessmentSession", code: str, normalized: Dict[str, Any], age_band: str) -> str:
    """Compose a Persian, data-grounded context block so the model writes an
    evidence-based analysis instead of a hallucinated empty template."""
    lines: list[str] = []
    lines.append("### داده‌های واقعی آزمون (مبنای تحلیل)")
    lines.append(f"- کد نتیجه: **{code}**")
    lines.append(f"- گروه سنی: **{age_band}**")

    # STRONG interest-level banding (precise per-theme bands from the docs).
    try:
        raw_scores = getattr(session.result, "raw_scores", None) or {}
        holland_raw = {k: raw_scores.get(k, 0.0) for k in ("R", "I", "A", "S", "E", "C")}
        if any(v for v in holland_raw.values()):
            from .strong_scoring import compute_interest_levels

            levels = compute_interest_levels(holland_raw, max_raw_per_dimension=50.0)
            lines.append("- سطح رغبت در شش تیپ شغلی (STRONG):")
            for letter in levels["ranking"]:
                t = levels["themes"][letter]
                lines.append(f"  - {t['label_fa']}: نمره {t['score']} — رغبت {t['band_fa']}")
    except Exception:
        pass

    if normalized:
        lines.append("- امتیاز نرمال‌شده‌ی ابعاد (۰ تا ۱۰۰):")
        try:
            ordered = sorted(
                ((k, v) for k, v in normalized.items() if isinstance(v, (int, float))),
                key=lambda kv: kv[1],
                reverse=True,
            )
        except Exception:
            ordered = list(normalized.items())
        for key, val in ordered:
            label = _HOLLAND_LABELS_FA.get(str(key).upper(), str(key))
            try:
                num = round(float(val), 1)
            except (TypeError, ValueError):
                num = val
            lines.append(f"  - {label}: **{num}**")
    lines.append("")
    lines.append("### خروجی مورد انتظار")
    lines.append(
        "بر اساس داده‌های بالا یک تحلیل کامل فارسی با ساختار زیر (Markdown) بنویس:"
    )
    lines.append("1. **توصیف شخصیت و رغبت‌ها** بر پایه‌ی ابعاد با بالاترین امتیاز")
    lines.append("2. **نقاط قوت** (فهرست)")
    lines.append("3. **چالش‌ها و نکات رشد** (فهرست)")
    lines.append("4. **مشاغل پیشنهادی** با ذکر میزان تناسب و دلیل")
    lines.append("5. **رشته‌ها/حوزه‌های تحصیلی پیشنهادی**")
    lines.append("6. **برنامه‌ی عملی گام‌به‌گام** متناسب با گروه سنی")
    return "\n".join(lines)


class LLMProviderService:
    """Service for managing LLM providers and generating AI reports."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ==========================================
    # Provider Management
    # ==========================================

    async def discover_models(self, provider_id: int) -> Dict[str, Any]:
        """
        Discover available models from a provider.
        Returns: {"models": [...], "provider_type": "vllm|ollama", "status": "success|error"}
        """
        stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
        result = await self.db.execute(stmt)
        provider = result.scalar_one_or_none()

        if not provider:
            return {"status": "error", "message": "Provider not found"}

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if provider.provider_type == "vllm":
                    # vLLM OpenAI-compatible endpoint: GET /v1/models
                    url = f"{provider.base_url.rstrip('/')}/v1/models"
                    headers = {}
                    if provider.api_key:
                        headers["Authorization"] = f"Bearer {provider.api_key}"

                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    data = response.json()

                    # OpenAI format: {"data": [{"id": "model_name", ...}], "object": "list"}
                    models = [{"id": m.get("id"), "created": m.get("created")} for m in data.get("data", [])]
                    return {"status": "success", "provider_type": "vllm", "models": models}

                elif provider.provider_type == "ollama":
                    # Ollama endpoint: GET /api/tags
                    url = f"{provider.base_url.rstrip('/')}/api/tags"
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.json()

                    # Ollama format: {"models": [{"name": "llama2", "size": 123, ...}]}
                    models = [
                        {"id": m.get("name"), "size": m.get("size"), "modified_at": m.get("modified_at")}
                        for m in data.get("models", [])
                    ]
                    return {"status": "success", "provider_type": "ollama", "models": models}

                else:
                    return {"status": "error", "message": f"Unsupported provider type: {provider.provider_type}"}

        except httpx.HTTPStatusError as e:
            return {"status": "error", "message": f"HTTP {e.response.status_code}: {e.response.text}"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def health_check(self, provider_id: int) -> Dict[str, Any]:
        """
        Check if provider is reachable and responsive.
        Updates provider.health_status and last_health_check.
        """
        stmt = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
        result = await self.db.execute(stmt)
        provider = result.scalar_one_or_none()

        if not provider:
            return {"status": "error", "message": "Provider not found"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                start_time = time.time()

                if provider.provider_type == "vllm":
                    url = f"{provider.base_url.rstrip('/')}/v1/models"
                    headers = {}
                    if provider.api_key:
                        headers["Authorization"] = f"Bearer {provider.api_key}"
                    response = await client.get(url, headers=headers)
                elif provider.provider_type == "ollama":
                    url = f"{provider.base_url.rstrip('/')}/api/tags"
                    response = await client.get(url)
                else:
                    return {"status": "error", "message": f"Unsupported provider type: {provider.provider_type}"}

                response.raise_for_status()
                latency_ms = int((time.time() - start_time) * 1000)

                # Update health status
                provider.health_status = "healthy"
                provider.last_health_check = datetime.utcnow()
                await self.db.commit()

                return {"status": "success", "health": "healthy", "latency_ms": latency_ms}

        except httpx.TimeoutException:
            provider.health_status = "timeout"
            provider.last_health_check = datetime.utcnow()
            await self.db.commit()
            return {"status": "error", "health": "timeout", "message": "Provider timeout"}
        except httpx.HTTPStatusError as e:
            provider.health_status = "degraded"
            provider.last_health_check = datetime.utcnow()
            await self.db.commit()
            return {"status": "error", "health": "degraded", "message": f"HTTP {e.response.status_code}"}
        except Exception as e:
            provider.health_status = "offline"
            provider.last_health_check = datetime.utcnow()
            await self.db.commit()
            return {"status": "error", "health": "offline", "message": str(e)}

    # ==========================================
    # AI Report Generation
    # ==========================================

    async def generate_ai_report(
        self,
        session_id: str,
        template_id: Optional[int] = None,
        provider_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Generate AI report for a completed assessment session.
        Falls back gracefully if LLM is unavailable.

        Returns: {"status": "success|error", "report_id": int, "message": "..."}
        """
        # 1. Fetch session with result eagerly loaded (required for async SQLAlchemy)
        from sqlalchemy.orm import selectinload
        stmt = (
            select(AssessmentSession)
            .options(selectinload(AssessmentSession.result))
            .where(AssessmentSession.id == session_id)
        )
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            return {"status": "error", "message": "Session not found"}

        if not session.result:
            return {"status": "error", "message": "Session not yet scored"}

        # 2. Determine provider and template
        if not provider_id:
            stmt_provider = select(AIProviderConfig).where(
                AIProviderConfig.is_active == True,
                AIProviderConfig.is_primary == True,
            ).order_by(AIProviderConfig.id).limit(1)
            provider_result = await self.db.execute(stmt_provider)
            provider = provider_result.scalars().first()
            if provider is None:
                # No primary set — fall back to any active provider.
                stmt_active = select(AIProviderConfig).where(
                    AIProviderConfig.is_active == True,
                ).order_by(AIProviderConfig.id).limit(1)
                active_result = await self.db.execute(stmt_active)
                provider = active_result.scalars().first()
        else:
            stmt_provider = select(AIProviderConfig).where(AIProviderConfig.id == provider_id)
            provider_result = await self.db.execute(stmt_provider)
            provider = provider_result.scalar_one_or_none()

        if not provider:
            # Graceful fallback: create report with status="failed" and message
            ai_report = SessionAIReport(
                session_id=session_id,
                status="failed",
                error_message="No active LLM provider configured. Using rule-based fallback.",
            )
            self.db.add(ai_report)
            await self.db.commit()
            await self.db.refresh(ai_report)
            return {
                "status": "fallback",
                "report_id": ai_report.id,
                "message": "LLM unavailable, using rule-based interpretation",
            }

        # 3. Select template
        if not template_id:
            # Auto-select template based on assessment type
            template_type_map = {
                "holland": "holland",
                "mbti": "mbti",
                "combined_holland_mbti": "combined",
            }
            template_type = template_type_map.get(session.assessment_type.value, "holland")
            stmt_template = select(LLMPromptTemplate).where(
                LLMPromptTemplate.template_type == template_type,
                LLMPromptTemplate.is_active == True,
            )
            template_result = await self.db.execute(stmt_template)
            template = template_result.first()
            if template:
                template = template[0]
        else:
            stmt_template = select(LLMPromptTemplate).where(LLMPromptTemplate.id == template_id)
            template_result = await self.db.execute(stmt_template)
            template = template_result.scalar_one_or_none()

        if not template:
            ai_report = SessionAIReport(
                session_id=session_id,
                provider_config_id=provider.id,
                status="failed",
                error_message="No suitable prompt template found",
            )
            self.db.add(ai_report)
            await self.db.commit()
            await self.db.refresh(ai_report)
            return {"status": "error", "report_id": ai_report.id, "message": "No prompt template found"}

        # 4. Render prompt with session data
        try:
            code = session.result.code
            normalized = session.result.normalized_scores or {}
            age_band = (session.result.certainty or {}).get("age_band", "18-24")
            data_block = _build_data_block(session, code, normalized, age_band)
            jinja_template = Template(template.prompt_template)
            context = {
                "HOLLAND_CODE": code,
                "MBTI_TYPE": code,
                "AGE_BAND": age_band,
                "SESSION_ID": session_id,
                "NORMALIZED_SCORES": normalized,
                "DATA_BLOCK": data_block,
            }
            rendered_prompt = jinja_template.render(**context)
            # Always append the structured data + output contract so even weak
            # models have the real scores instead of hallucinating a blank template.
            if "{{ DATA_BLOCK" not in template.prompt_template and "DATA_BLOCK" not in template.prompt_template:
                rendered_prompt = f"{rendered_prompt}\n\n{data_block}"
        except Exception as e:
            ai_report = SessionAIReport(
                session_id=session_id,
                provider_config_id=provider.id,
                template_id=template.id,
                status="failed",
                error_message=f"Template rendering failed: {str(e)}",
            )
            self.db.add(ai_report)
            await self.db.commit()
            await self.db.refresh(ai_report)
            return {"status": "error", "report_id": ai_report.id, "message": f"Template error: {str(e)}"}

        # 5. Call LLM API
        ai_report = SessionAIReport(
            session_id=session_id,
            provider_config_id=provider.id,
            template_id=template.id,
            prompt_sent=rendered_prompt,
            model_name=provider.default_model,
            status="pending",
        )
        self.db.add(ai_report)
        await self.db.commit()
        await self.db.refresh(ai_report)

        try:
            start_time = time.time()
            async with httpx.AsyncClient(timeout=60.0) as client:
                if provider.provider_type == "vllm":
                    # Prefer chat completions for instruction-tuned models (OpenAI-compat)
                    url = f"{provider.base_url.rstrip('/')}/v1/chat/completions"
                    headers = {"Content-Type": "application/json"}
                    if provider.api_key:
                        headers["Authorization"] = f"Bearer {provider.api_key}"

                    gen_params = template.generation_params or {}
                    payload = {
                        "model": provider.default_model or "default",
                        "messages": [
                            {"role": "system", "content": template.system_prompt or _DEFAULT_SYSTEM_PROMPT},
                            {"role": "user", "content": rendered_prompt},
                        ],
                        "max_tokens": gen_params.get("max_tokens", 2000),
                        "temperature": gen_params.get("temperature", 0.7),
                        "top_p": gen_params.get("top_p", 0.9),
                    }

                    response = await client.post(url, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()

                    # Chat completions format: {"choices": [{"message": {"content": "..."}}]}
                    raw_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                    tokens_used = data.get("usage", {}).get("total_tokens", 0)

                elif provider.provider_type == "ollama":
                    url = f"{provider.base_url.rstrip('/')}/api/generate"
                    payload = {
                        "model": provider.default_model or "llama2",
                        "prompt": rendered_prompt,
                        "stream": False,
                    }

                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    data = response.json()

                    raw_response = data.get("response", "")
                    tokens_used = 0  # Ollama doesn't always return token count

                else:
                    raise ValueError(f"Unsupported provider type: {provider.provider_type}")

                generation_time_ms = int((time.time() - start_time) * 1000)

                # 6. Parse response — extract JSON block even if LLM adds surrounding text
                import re as _re
                parsed = None
                try:
                    parsed = json.loads(raw_response)
                except json.JSONDecodeError:
                    pass
                if parsed is None:
                    match = _re.search(r'\{[\s\S]*\}', raw_response)
                    if match:
                        try:
                            parsed = json.loads(match.group(0))
                        except json.JSONDecodeError:
                            pass
                ai_report.parsed_sections = parsed if parsed is not None else {"raw_text": raw_response}

                ai_report.raw_response = raw_response
                ai_report.generation_time_ms = generation_time_ms
                ai_report.tokens_used = tokens_used
                ai_report.status = "completed"
                await self.db.commit()

                return {
                    "status": "success",
                    "report_id": ai_report.id,
                    "message": "AI report generated successfully",
                    "generation_time_ms": generation_time_ms,
                }

        except httpx.TimeoutException:
            ai_report.status = "timeout"
            ai_report.error_message = "LLM request timed out after 60 seconds"
            await self.db.commit()
            return {"status": "error", "report_id": ai_report.id, "message": "LLM timeout"}
        except Exception as e:
            ai_report.status = "failed"
            ai_report.error_message = str(e)
            await self.db.commit()
            return {"status": "error", "report_id": ai_report.id, "message": f"LLM error: {str(e)}"}
