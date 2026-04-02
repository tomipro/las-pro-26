from __future__ import annotations

import json
import os
from typing import Any


def _build_heuristic_summary(well_reports: list[dict], portfolio_summary: dict) -> str:
    lines: list[str] = []
    lines.append("Portfolio interpretation (rule-based fallback):")
    lines.append(
        f"Analyzed {portfolio_summary.get('well_count', 0)} wells over "
        f"{portfolio_summary.get('total_depth_points', 0)} depth samples."
    )

    best_well = None
    best_score = -1.0

    for report in well_reports:
        qc_score = report.get("qc", {}).get("data_score", 0)
        pay_points = report.get("petrophysics", {}).get("summary", {}).get("net_reservoir_points", 0)
        anomalies = report.get("ml", {}).get("anomalies", {}) or {}
        anomaly_pct = anomalies.get("pct", 0)
        score = float(qc_score) + float(pay_points) * 0.02 - float(anomaly_pct)
        if score > best_score:
            best_score = score
            best_well = report

        lines.append(
            f"- {report.get('well_name')}: QC {qc_score}/100, "
            f"potential reservoir points {pay_points}, anomaly rate {anomaly_pct}%."
        )

    if best_well:
        lines.append(
            f"Most promising candidate for follow-up screening: {best_well.get('well_name')} "
            f"(API: {best_well.get('api') or 'N/A'})."
        )

    lines.append(
        "Recommended next steps: calibrate petrophysical constants with core/PVT data, "
        "add lithology labels for supervised learning, validate SOM/electrofacies against expert picks, "
        "and incorporate seismic attributes when available."
    )
    return "\n".join(lines)


def _build_heuristic_chat_answer(question: str, portfolio_summary: dict) -> str:
    return (
        "AI model is currently unavailable, so this is a heuristic response. "
        f"Your question was: '{question}'. "
        f"Current context: {portfolio_summary.get('well_count', 0)} wells, "
        f"avg QC {portfolio_summary.get('avg_qc_score', 'N/A')}, "
        f"avg anomaly {portfolio_summary.get('avg_anomaly_pct', 'N/A')}%. "
        "Enable provider API access to get full model-based technical answers."
    )


def _compact_payload(well_reports: list[dict], portfolio_summary: dict) -> dict:
    compact_wells: list[dict] = []
    for w in well_reports:
        ml_block = w.get("ml", {}) or {}
        som_block = ml_block.get("som", {}) or {}
        som_training = som_block.get("training", {}) or {}

        compact_wells.append(
            {
                "well_name": w.get("well_name"),
                "api": w.get("api"),
                "qc": w.get("qc", {}).get("data_score"),
                "petrophysics": w.get("petrophysics", {}).get("summary", {}),
                "geophysics": w.get("geophysics", {}),
                "sequence": {
                    "summary": (w.get("sequence_stratigraphy", {}) or {}).get("summary", {}),
                    "boundaries_auto": (w.get("sequence_stratigraphy", {}) or {}).get("boundaries_auto", [])[:12],
                    "intervals_auto": (w.get("sequence_stratigraphy", {}) or {}).get("intervals_auto", [])[:20],
                },
                "ml": {
                    "anomaly_pct": (ml_block.get("anomalies", {}) or {}).get("pct"),
                    "cluster_counts": (ml_block.get("electrofacies", {}) or {}).get("cluster_counts"),
                    "som": {
                        "grid": som_block.get("grid"),
                        "quantization_error": som_training.get("quantization_error"),
                        "topological_error": som_training.get("topological_error"),
                    },
                },
            }
        )

    return {
        "portfolio": portfolio_summary,
        "wells": compact_wells,
    }


def _run_gemini(system_prompt: str, user_prompt: str) -> tuple[str | None, dict[str, Any]]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-pro").strip() or "gemini-2.5-pro"

    if not api_key:
        return None, {"source": "gemini", "reason": "GEMINI_API_KEY not set"}

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.2,
            ),
        )

        text = getattr(response, "text", "") or ""
        if not text.strip():
            return None, {"source": "gemini", "reason": "Empty Gemini output", "model": model}
        return text.strip(), {"source": "gemini", "model": model}
    except Exception as exc:
        return None, {"source": "gemini", "reason": f"Gemini error: {exc}", "model": model}


def _run_openai(system_prompt: str, user_prompt: str) -> tuple[str | None, dict[str, Any]]:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")

    if not api_key:
        return None, {"source": "openai", "reason": "OPENAI_API_KEY not set"}

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
        )

        text = getattr(response, "output_text", "") or ""
        if not text.strip():
            return None, {"source": "openai", "reason": "Empty OpenAI output", "model": model}
        return text.strip(), {"source": "openai", "model": model}
    except Exception as exc:
        return None, {"source": "openai", "reason": f"OpenAI error: {exc}", "model": model}


def _run_best_available_model(system_prompt: str, user_prompt: str) -> tuple[str | None, dict[str, Any], dict[str, Any]]:
    gemini_text, gemini_meta = _run_gemini(system_prompt, user_prompt)
    if gemini_text:
        return gemini_text, gemini_meta, {"source": "openai", "reason": "Not used"}

    openai_text, openai_meta = _run_openai(system_prompt, user_prompt)
    if openai_text:
        return openai_text, openai_meta, gemini_meta

    return None, openai_meta, gemini_meta


def generate_ai_interpretation(
    well_reports: list[dict],
    portfolio_summary: dict,
    with_ai: bool,
) -> tuple[str, dict[str, Any]]:
    if not with_ai:
        text = _build_heuristic_summary(well_reports, portfolio_summary)
        return text, {"source": "heuristic", "reason": "AI disabled"}

    payload = _compact_payload(well_reports, portfolio_summary)

    system_prompt = (
        "You are a senior petrophysicist + geophysicist + data scientist. "
        "Write a technically grounded interpretation for geologists/petroleum engineers. "
        "Do not invent missing data. Separate observations, risks, and recommendations."
    )

    user_prompt = (
        "Interpret this multi-well LAS analysis output.\n"
        "Include: (1) portfolio-level findings, (2) well-by-well findings, "
        "(3) geophysics + SOM insights, (4) data quality caveats, "
        "(5) prioritized next actions.\n"
        f"JSON:\n{json.dumps(payload, indent=2)}"
    )

    text, meta, other_meta = _run_best_available_model(system_prompt, user_prompt)
    if text:
        return text, meta

    fallback = _build_heuristic_summary(well_reports, portfolio_summary)
    return fallback, {
        "source": "heuristic",
        "reason": f"No model available. Gemini: {other_meta.get('reason')}; OpenAI: {meta.get('reason')}",
    }


def generate_data_chat_answer(
    well_reports: list[dict],
    portfolio_summary: dict,
    question: str,
    history: list[dict] | None = None,
    with_ai: bool = True,
) -> tuple[str, dict[str, Any]]:
    history = history or []

    if not with_ai:
        fallback = _build_heuristic_chat_answer(question, portfolio_summary)
        return fallback, {"source": "heuristic", "reason": "AI disabled"}

    payload = _compact_payload(well_reports, portfolio_summary)

    transcript_lines: list[str] = []
    for item in history[-12:]:
        role = str(item.get("role", "user")).upper()
        content = str(item.get("content", "")).strip()
        if content:
            transcript_lines.append(f"{role}: {content}")
    transcript = "\n".join(transcript_lines)

    system_prompt = (
        "You are a domain assistant for petrophysics/geophysics. "
        "Answer with technical clarity. Use only provided context; if unsure, say so. "
        "Prefer actionable next checks and keep units explicit."
    )

    user_prompt = (
        "You are chatting about this LAS analysis context.\n"
        f"CONTEXT JSON:\n{json.dumps(payload, indent=2)}\n\n"
        f"CHAT HISTORY:\n{transcript if transcript else '(none)'}\n\n"
        f"USER QUESTION:\n{question}\n\n"
        "Answer as a technical assistant to a geoscience team."
    )

    text, meta, other_meta = _run_best_available_model(system_prompt, user_prompt)
    if text:
        return text, meta

    fallback = _build_heuristic_chat_answer(question, portfolio_summary)
    return fallback, {
        "source": "heuristic",
        "reason": f"No model available. Gemini: {other_meta.get('reason')}; OpenAI: {meta.get('reason')}",
    }
