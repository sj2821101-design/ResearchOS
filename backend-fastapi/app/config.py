"""ResearchOS 全局配置。

从环境变量读取（可选加载项目根目录的 .env 文件）。
所有配置项都有安全默认值，保证在"无 API Key、无网络"的环境下也能运行。
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# 项目根目录：backend/app/config.py -> parents[2] = ResearchOS/
PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _load_dotenv(path: Path) -> None:
    """极简 .env 加载器（不依赖 python-dotenv）。"""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # 已存在的环境变量优先，.env 不覆盖
        os.environ.setdefault(key, value)


_load_dotenv(PROJECT_ROOT / ".env")


def _resolve_data_dir(raw: str) -> Path:
    path = Path(raw)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path.resolve()


@dataclass
class Settings:
    data_dir: Path
    host: str
    port: int
    llm_provider: str
    llm_model: str
    openai_api_key: str
    openai_base_url: str
    anthropic_api_key: str
    openai_compatible_base_url: str
    openai_compatible_api_key: str

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            data_dir=_resolve_data_dir(os.getenv("RESEARCHOS_DATA_DIR", "./data")),
            host=os.getenv("RESEARCHOS_HOST", "127.0.0.1"),
            port=int(os.getenv("RESEARCHOS_PORT", "8000")),
            llm_provider=os.getenv("LLM_PROVIDER", "heuristic").strip().lower(),
            llm_model=os.getenv("LLM_MODEL", "").strip(),
            openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
            openai_base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY", "").strip(),
            openai_compatible_base_url=os.getenv("OPENAI_COMPATIBLE_BASE_URL", "").strip().rstrip("/"),
            openai_compatible_api_key=os.getenv("OPENAI_COMPATIBLE_API_KEY", "").strip(),
        )

    def ensure_dirs(self) -> None:
        """确保数据目录存在。"""
        self.data_dir.mkdir(parents=True, exist_ok=True)
        (self.data_dir / "papers").mkdir(parents=True, exist_ok=True)


settings = Settings.from_env()
