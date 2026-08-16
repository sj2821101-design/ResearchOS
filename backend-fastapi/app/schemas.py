"""API 层 Pydantic 模型（v2）。"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PaperListItem(BaseModel):
    id: str
    filename: str = ""
    title: Optional[str] = None
    authors: List[str] = Field(default_factory=list)
    year: Optional[int] = None
    venue: Optional[str] = None
    keywords: List[str] = Field(default_factory=list)
    analysis_status: str = "none"  # none | parsed | analyzed
    analysis_provider: Optional[str] = None
    analysis_model: Optional[str] = None
    created_at: str = ""


class PaperDetail(BaseModel):
    id: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    sections: Dict[str, str] = Field(default_factory=dict)
    analysis: Optional[Dict[str, Any]] = None
    notes: str = ""
    has_pdf: bool = False
    figures: List[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    include_satellite: bool = True


class CompareRequest(BaseModel):
    paper_ids: List[str] = Field(min_length=2)
    provider: Optional[str] = None
    model: Optional[str] = None


class QARequest(BaseModel):
    paper_ids: List[str] = Field(min_length=1)
    question: str = Field(min_length=1)
    provider: Optional[str] = None
    model: Optional[str] = None


class NotesRequest(BaseModel):
    notes: str = ""


class GapRequest(BaseModel):
    paper_ids: List[str] = Field(min_length=1)
    provider: Optional[str] = None
    model: Optional[str] = None
