"""具体 Provider 实现：OpenAI / Anthropic(Claude) / OpenAI 兼容 / 启发式。

只用 httpx 直接调 REST 端点，不绑定官方 SDK，保证可移植、可替换。
"""
from __future__ import annotations

from typing import Optional

import httpx

from ..config import settings
from .base import LLMProvider, LLMResponse, ProviderError

_TIMEOUT = httpx.Timeout(180.0, connect=15.0)


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(self, model: str, api_key: str, base_url: str) -> None:
        self.model = model
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def available(self) -> bool:
        return bool(self.api_key)

    def complete(self, system: str, user: str, temperature: float = 0.2, max_tokens: int = 4096) -> LLMResponse:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                raise ProviderError(f"OpenAI HTTP {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            text = data["choices"][0]["message"]["content"]
            model_used = data.get("model", self.model)
            return LLMResponse(text=text, model=model_used)
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"OpenAI request failed: {exc}") from exc


class OpenAICompatibleProvider(OpenAIProvider):
    """DeepSeek / Ollama / vLLM / LM Studio 等 OpenAI 兼容端点。"""

    name = "openai_compatible"


class AnthropicProvider(LLMProvider):
    name = "anthropic"

    def __init__(self, model: str, api_key: str) -> None:
        self.model = model or "claude-sonnet-4-20250514"
        self.api_key = api_key

    def available(self) -> bool:
        return bool(self.api_key)

    def complete(self, system: str, user: str, temperature: float = 0.2, max_tokens: int = 4096) -> LLMResponse:
        url = "https://api.anthropic.com/v1/messages"
        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        }
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        try:
            with httpx.Client(timeout=_TIMEOUT) as client:
                resp = client.post(url, json=payload, headers=headers)
            if resp.status_code >= 400:
                raise ProviderError(f"Anthropic HTTP {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            text = "".join(block.get("text", "") for block in data.get("content", []))
            return LLMResponse(text=text, model=data.get("model", self.model))
        except ProviderError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise ProviderError(f"Anthropic request failed: {exc}") from exc


class HeuristicProvider(LLMProvider):
    """本地启发式 Provider：不调用任何 LLM，返回空文本。

    上层据此把 provider_used 标记为 heuristic，并用本地规则生成分析。
    """

    name = "heuristic"

    def available(self) -> bool:
        return True

    def complete(self, system: str, user: str, temperature: float = 0.2, max_tokens: int = 4096) -> LLMResponse:
        return LLMResponse(text="", model="heuristic")


def get_provider(name: Optional[str] = None, model: Optional[str] = None) -> LLMProvider:
    """根据名称构建 Provider；名称缺省时读配置。

    顺序：显式 name -> settings.llm_provider；若配置的 provider 不可用，
    统一回退到 heuristic（不抛错，保证离线可跑）。
    """
    name = (name or settings.llm_provider or "heuristic").strip().lower()
    model = (model or settings.llm_model or "").strip()

    provider: LLMProvider
    if name == "openai":
        provider = OpenAIProvider(model or "gpt-4o-mini", settings.openai_api_key, settings.openai_base_url)
    elif name == "anthropic":
        provider = AnthropicProvider(model, settings.anthropic_api_key)
    elif name == "openai_compatible":
        provider = OpenAICompatibleProvider(
            model, settings.openai_compatible_api_key, settings.openai_compatible_base_url
        )
    else:
        provider = HeuristicProvider()

    if not provider.available():
        provider = HeuristicProvider()
    return provider
