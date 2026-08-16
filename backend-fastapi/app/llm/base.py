"""LLM Provider 抽象基类。"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


class ProviderError(RuntimeError):
    """LLM 调用失败（网络错误、鉴权失败、返回异常等）。"""


@dataclass
class LLMResponse:
    text: str
    model: str = ""


class LLMProvider(ABC):
    """统一的补全接口。

    complete() 抛出 ProviderError 表示调用失败；上层捕获后回退到本地启发式分析。
    """

    name: str = "base"

    @abstractmethod
    def complete(
        self,
        system: str,
        user: str,
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        ...

    def available(self) -> bool:
        """是否具备调用条件（例如是否已配置 API Key）。"""
        return True
