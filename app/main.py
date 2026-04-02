from __future__ import annotations

from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from .services.analyzer import analyze_las_payloads, analyze_sample_directory
from .services.ai import generate_ai_interpretation, generate_data_chat_answer

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DIR = BASE_DIR / "LAS_Sample_API"
STATIC_DIR = Path(__file__).resolve().parent / "static"

load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="LAS Intel POC", version="0.1.0")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
_ANALYSIS_STORE: dict[str, dict[str, Any]] = {}


class AIInterpretationRequest(BaseModel):
    analysis_id: str
    with_ai: bool = True


class ChatMessage(BaseModel):
    role: str
    content: str


class DataChatRequest(BaseModel):
    analysis_id: str
    question: str = Field(min_length=1, max_length=5000)
    history: list[ChatMessage] = Field(default_factory=list)
    with_ai: bool = True


def _store_analysis(payload: dict[str, Any]) -> str:
    analysis_id = str(uuid4())
    _ANALYSIS_STORE[analysis_id] = {
        "portfolio_summary": payload.get("portfolio_summary", {}),
        "wells": payload.get("wells", []),
    }
    # Keep in-memory store bounded for localhost demo sessions.
    while len(_ANALYSIS_STORE) > 30:
        oldest_id = next(iter(_ANALYSIS_STORE))
        _ANALYSIS_STORE.pop(oldest_id, None)
    return analysis_id


def _get_analysis_or_404(analysis_id: str) -> dict[str, Any]:
    analysis = _ANALYSIS_STORE.get(analysis_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail=f"Unknown analysis_id: {analysis_id}")
    return analysis


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "sample_dir_exists": SAMPLE_DIR.exists(),
        "sample_files": sorted(p.name for p in SAMPLE_DIR.glob("*.las")) if SAMPLE_DIR.exists() else [],
    }


@app.post("/api/analyze-samples")
def analyze_samples(with_ai: bool = Query(default=True)) -> dict:
    if not SAMPLE_DIR.exists():
        payload = {
            "portfolio_summary": {
                "well_count": 0,
                "avg_qc_score": None,
                "total_depth_points": 0,
                "wells_with_pay": 0,
                "avg_anomaly_pct": None,
            },
            "portfolio_analytics": {
                "well_ranking": [],
                "pay_risk_matrix": [],
                "facies_similarity": {
                    "labels": [],
                    "matrix": [],
                    "top_pairs": [],
                },
                "sequence_correlation": {
                    "status": "insufficient_data",
                    "surface_names": [],
                    "well_names": [],
                    "depth_matrix": [],
                    "relative_matrix": [],
                },
                "geophysics_crossplot": [],
                "som_quality": [],
            },
            "wells": [],
            "errors": [{"error": f"Sample directory not found: {SAMPLE_DIR}"}],
            "ai_interpretation": "No analysis available.",
            "ai_meta": {"source": "none", "reason": "No sample files"},
        }
        payload["analysis_id"] = _store_analysis(payload)
        return payload

    payload = analyze_sample_directory(str(SAMPLE_DIR), with_ai=with_ai)
    payload["analysis_id"] = _store_analysis(payload)
    return payload


@app.post("/api/analyze-files")
async def analyze_files(
    files: list[UploadFile] = File(...),
    with_ai: bool = Query(default=True),
) -> dict:
    payloads: list[tuple[str, bytes]] = []
    for file in files:
        payloads.append((file.filename or "uploaded.las", await file.read()))
    payload = analyze_las_payloads(files=payloads, with_ai=with_ai)
    payload["analysis_id"] = _store_analysis(payload)
    return payload


@app.post("/api/ai-interpretation")
def ai_interpretation(request: AIInterpretationRequest) -> dict:
    analysis = _get_analysis_or_404(request.analysis_id)
    ai_text, ai_meta = generate_ai_interpretation(
        analysis.get("wells", []),
        analysis.get("portfolio_summary", {}),
        with_ai=request.with_ai,
    )
    return {
        "analysis_id": request.analysis_id,
        "ai_interpretation": ai_text,
        "ai_meta": ai_meta,
    }


@app.post("/api/chat-data")
def chat_data(request: DataChatRequest) -> dict:
    analysis = _get_analysis_or_404(request.analysis_id)
    history = [{"role": item.role, "content": item.content} for item in request.history]
    answer, meta = generate_data_chat_answer(
        analysis.get("wells", []),
        analysis.get("portfolio_summary", {}),
        question=request.question,
        history=history,
        with_ai=request.with_ai,
    )
    return {
        "analysis_id": request.analysis_id,
        "answer": answer,
        "meta": meta,
    }
