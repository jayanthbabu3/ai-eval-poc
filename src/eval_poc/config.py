"""Application configuration: secrets from env, tunables from config.json."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
REPORTS_DIR = PROJECT_ROOT / "reports"
CONFIG_PATH = PROJECT_ROOT / "config.json"


class RetrievalConfig(BaseModel):
    top_k: int = Field(ge=1, le=10)
    min_score: float = Field(ge=0.0, le=1.0)


class GenerationConfig(BaseModel):
    model: str
    temperature: float = Field(ge=0.0, le=2.0)
    max_tokens: int = Field(ge=64, le=4096)


class JudgeConfig(BaseModel):
    model: str
    temperature: float = Field(ge=0.0, le=2.0)
    threshold: float = Field(ge=0.0, le=1.0)


class RulesConfig(BaseModel):
    min_length_chars: int = Field(ge=0)
    max_length_chars: int = Field(ge=1)
    max_latency_ms: int = Field(ge=1)
    forbidden_keywords: list[str]
    max_completion_tokens: int = Field(default=400, ge=1)


class ScoringConfig(BaseModel):
    pass_threshold: float = Field(ge=0.0, le=1.0)
    human_scale_max: int = Field(ge=2, le=10)


class AppConfig(BaseModel):
    retrieval: RetrievalConfig
    generation: GenerationConfig
    judge: JudgeConfig
    rules: RulesConfig
    scoring: ScoringConfig


class Secrets(BaseSettings):
    """Secrets come from the environment only — never from config.json."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env", env_file_encoding="utf-8", extra="ignore"
    )

    groq_api_key: str | None = None

    @property
    def has_groq(self) -> bool:
        return bool(self.groq_api_key and self.groq_api_key.strip())


@lru_cache(maxsize=1)
def load_config(path: Path = CONFIG_PATH) -> AppConfig:
    """Load and validate config.json. Raises on malformed config — fail fast."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RuntimeError(f"Config file missing at {path}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Config file at {path} is not valid JSON: {error}") from error
    return AppConfig.model_validate(raw)


@lru_cache(maxsize=1)
def load_secrets() -> Secrets:
    return Secrets()
