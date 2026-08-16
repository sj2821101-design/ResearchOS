"""LLM 抽象层：让上层分析/对比/问答不依赖具体厂商。

    LLM Provider
         │
    ┌────┼─────────┐
    ↓    ↓         ↓
  OpenAI Claude OpenAI兼容(DeepSeek/Ollama/vLLM…)   + heuristic 本地回退
"""
from .base import LLMProvider, LLMResponse, ProviderError
from .providers import get_provider

__all__ = ["LLMProvider", "LLMResponse", "ProviderError", "get_provider"]
