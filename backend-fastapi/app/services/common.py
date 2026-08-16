"""服务层通用工具：JSON 提取、句子切分、文本截断。"""
from __future__ import annotations

import json
import re
from typing import Any, List, Optional


def extract_json(text: str) -> Optional[Any]:
    """从 LLM 返回中稳健地提取 JSON 对象/数组。"""
    if not text:
        return None
    t = text.strip()
    # 去掉 ```json ... ``` 围栏
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except (ValueError, TypeError):
        pass
    # 退而求其次：截取首个 { 到最后一个 }
    start = t.find("{")
    end = t.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(t[start : end + 1])
        except (ValueError, TypeError):
            return None
    start = t.find("[")
    end = t.rfind("]")
    if start != -1 and end > start:
        try:
            return json.loads(t[start : end + 1])
        except (ValueError, TypeError):
            return None
    return None


_SENT_SPLIT = re.compile(r"(?<=[.!?。！？])\s+")


def split_sentences(text: str) -> List[str]:
    if not text:
        return []
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]


def truncate(text: str, n: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= n else text[:n] + "\n...[truncated]"


def first_sentences(text: str, k: int = 2) -> str:
    return " ".join(split_sentences(text)[:k])
