"""
Data completeness reporter — identifies what's missing for a final PRCE
and drafts a professional Portuguese email the auditor can send to the client.

Uses a cheaper/faster model (Sonnet) since this is summarisation, not extraction.
Runs concurrently with generate_prce() so it adds zero wall-clock latency.
"""

import requests
import json
import os
import re

OPENROUTER_KEY = os.environ["OPENROUTER_KEY"]
REPORT_MODEL   = "anthropic/claude-opus-4.8"   # same model as extractor — known to work


def _call_llm(prompt: str) -> str:
    resp = requests.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://wearefractional.ai",
            "X-Title": "AE-PRCE Automation",
        },
        json={
            "model": REPORT_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
            "max_tokens": 2500,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"].strip()


def generate_completeness_report(extracted: dict, validation: dict) -> dict:
    """
    Returns:
        {
            "gap_summary": "...",        # 2-3 sentence summary
            "missing_items": ["..."],    # specific document/data items needed
            "client_email_pt": "...",    # ready-to-send Portuguese email
        }
    """
    period     = extracted.get("data_period", "desconhecido")
    fleet_type = extracted.get("fleet_type", "desconhecido")
    notes      = extracted.get("data_quality_notes", "") or ""
    annual     = extracted.get("annual_summary", {})
    has_cargo  = annual.get("total_cargo_tonnes") is not None

    errors   = validation.get("errors",   [])
    warnings = validation.get("warnings", [])
    all_issues = errors + warnings

    prompt = f"""You are a Portuguese energy audit consultant (RGCEST / Portaria 228/90).

An automated system extracted data from a client's fleet Excel file. Here is what was found:

- Data period: {period}
- Fleet type: {fleet_type}
- Has cargo data: {has_cargo}
- Extraction notes: {notes[:400] if notes else "none"}
- Validation issues detected:
{chr(10).join(f"  - {i}" for i in all_issues) if all_issues else "  none"}

Your task: identify what data is MISSING to produce a final compliant PRCE under Portaria 228/90,
and draft a professional email in Portuguese that the auditor can send to the fleet manager.

The email should:
- Open formally (Exmo. Sr. / Exma. Sra.)
- Reference the PRCE obligation under RGCEST (Portaria 228/90)
- List SPECIFIC documents/exports needed (not generic "annual data")
  - For heavy cargo fleets: CMR/guias de transporte, relatório anual de tonelagem por viatura
  - For urban services: relatório anual de quilómetros por matrícula, consumos anuais por viatura
  - Always: ficheiro Excel completo não truncado, período 01/Jan a 31/Dez do ano de referência
- Give a deadline (suggest 10 working days)
- Close professionally

Return a JSON object with exactly these fields:
{{
  "gap_summary": "<2 sentences: what is missing and why it matters>",
  "missing_items": ["<specific item 1>", "<specific item 2>", ...],
  "client_email_pt": "<full email text in Portuguese>"
}}

Return ONLY the JSON, no explanation."""

    try:
        raw = _call_llm(prompt)
        raw = re.sub(r"```(?:json)?\s*", "", raw).replace("```", "").strip()
        start = raw.find("{")
        if start != -1:
            depth = 0
            for i, ch in enumerate(raw[start:], start):
                if ch == "{": depth += 1
                elif ch == "}":
                    depth -= 1
                    if depth == 0:
                        return json.loads(raw[start:i+1])
        # JSON not found — return raw text in gap_summary
        return {
            "gap_summary": raw[:300] if raw else "No response from model.",
            "missing_items": [],
            "client_email_pt": "",
        }
    except Exception as e:
        return {
            "gap_summary": f"Report generation failed: {e}",
            "missing_items": ["Could not generate report — check OpenRouter connection"],
            "client_email_pt": "",
        }
