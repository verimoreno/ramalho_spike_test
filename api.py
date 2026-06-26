"""
AE/PRCE Automation — FastAPI backend
=====================================
Wraps the existing pipeline as an HTTP API with Server-Sent Events for live progress.

Run:
    cd ae-prce-automation
    uvicorn api:app --reload --port 8000
"""

import asyncio
import json
import queue as _queue
import sys
import threading
import time
import traceback
import uuid
from contextlib import contextmanager
from io import StringIO
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

# ── App setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="AE/PRCE Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure pipeline modules are importable
sys.path.insert(0, str(Path(__file__).parent))

UPLOAD_DIR = Path("/tmp/ae-prce-uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# In-memory run registry (fine for a local demo)
runs: dict[str, dict] = {}


# ── Pipeline runner ───────────────────────────────────────────────────────────

@contextmanager
def _silence():
    """Suppress stdout from pipeline functions during API mode."""
    old = sys.stdout
    sys.stdout = StringIO()
    try:
        yield
    finally:
        sys.stdout = old


def _run_pipeline(run_id: str, file_path: str, company_name: str, q: _queue.Queue):
    """Execute the full pipeline synchronously in a background thread."""
    from calculator import calculate
    from extractor import extract_fleet_data
    from generator import generate_prce
    from reporter import generate_completeness_report
    from validator import validate, validate_metrics
    from concurrent.futures import ThreadPoolExecutor

    def emit(event: dict):
        q.put(event)

    try:
        # ── STEP 1: Extract ─────────────────────────────────────────────────
        emit({"event": "extract_start", "message": "A extrair dados do ficheiro Excel com IA (Claude Opus 4.8)..."})
        t0 = time.time()
        with _silence():
            extracted = extract_fleet_data(file_path)
        extract_time = round(time.time() - t0, 1)

        emit({
            "event": "extract_done",
            "message": f"Extração concluída",
            "duration": extract_time,
            "period": extracted.get("data_period", ""),
            "fleet_type": extracted.get("fleet_type", ""),
            "notes": (extracted.get("data_quality_notes") or "")[:300],
        })

        # ── STEP 2: Validate ─────────────────────────────────────────────────
        emit({"event": "validate_start", "message": "A validar dados extraídos..."})
        with _silence():
            validation = validate(extracted)
        emit({
            "event": "validate_done",
            "message": "Validação concluída",
            "warnings": validation.get("warnings", []),
            "errors": validation.get("errors", []),
            "ok": validation.get("ok", True),
        })

        # Pre-flight check
        annual = extracted.get("annual_summary", {})
        if not annual.get("total_km") or not annual.get("total_energy_tep"):
            emit({
                "event": "error",
                "message": "Ficheiro insuficiente para calcular PRCE — totais de km e energia em falta. Solicite o ficheiro completo ao cliente.",
                "errors": validation.get("errors", []),
            })
            runs[run_id]["status"] = "error"
            return

        # ── STEP 3: Calculate ────────────────────────────────────────────────
        emit({"event": "calculate_start", "message": "A calcular CEE e metas PRCE (Portaria 228/90)..."})
        with _silence():
            metrics = calculate(extracted)
            metrics_check = validate_metrics(metrics)
        emit({
            "event": "calculate_done",
            "message": f"Cálculo concluído — CEE: {metrics.cee_global} {metrics.cee_unit}",
            "cee": metrics.cee_global,
            "cee_unit": metrics.cee_unit,
            "K": metrics.K,
            "issues": metrics_check.get("issues", []),
        })

        # ── STEP 4: Generate (concurrent) ───────────────────────────────────
        emit({"event": "generate_start", "message": "A gerar documento PRCE e relatório de dados em paralelo..."})
        output_path = str(UPLOAD_DIR / f"{run_id}_PRCE.docx")

        with ThreadPoolExecutor(max_workers=2) as pool:
            report_future = pool.submit(generate_completeness_report, extracted, validation)
            with _silence():
                docx_path = generate_prce(metrics, company_name=company_name, output_path=output_path)
            report = report_future.result()

        emit({"event": "generate_done", "message": "Documento Word gerado com sucesso"})

        # ── Store result ─────────────────────────────────────────────────────
        runs[run_id]["result"] = {
            "metrics": {
                "data_period": metrics.data_period,
                "fleet_type": metrics.fleet_type,
                "total_km": metrics.total_km,
                "total_energy_tep": metrics.total_energy_tep,
                "total_cargo_t": metrics.total_cargo_t,
                "total_work_tkm": metrics.total_work_tkm,
                "cee_global": metrics.cee_global,
                "cee_unit": metrics.cee_unit,
                "K": metrics.K,
                "annual_reduction": metrics.annual_reduction,
                "targets": metrics.targets,
                "data_quality_notes": metrics.data_quality_notes,
                "total_co2_tco2": metrics.total_co2_tco2,
            },
            "validation": {
                "warnings": validation.get("warnings", []),
                "errors": validation.get("errors", []),
            },
            "metrics_issues": metrics_check.get("issues", []),
            "report": report,
            "company_name": company_name,
        }
        runs[run_id]["docx_path"] = docx_path
        runs[run_id]["status"] = "complete"

        emit({"event": "complete", "run_id": run_id})

    except Exception as e:
        emit({
            "event": "error",
            "message": f"Erro inesperado: {str(e)}",
            "detail": traceback.format_exc()[:600],
        })
        runs[run_id]["status"] = "error"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.post("/api/run")
async def start_run(
    file: UploadFile = File(...),
    company_name: str = Form(...),
):
    run_id = str(uuid.uuid4())
    suffix = Path(file.filename or "upload.xlsx").suffix or ".xlsx"
    file_path = UPLOAD_DIR / f"{run_id}{suffix}"
    content = await file.read()
    file_path.write_bytes(content)

    q: _queue.Queue = _queue.Queue()
    runs[run_id] = {
        "status": "running",
        "q": q,
        "result": None,
        "docx_path": None,
        "company_name": company_name,
    }

    threading.Thread(
        target=_run_pipeline,
        args=(run_id, str(file_path), company_name, q),
        daemon=True,
    ).start()

    return {"run_id": run_id}


@app.get("/api/stream/{run_id}")
async def stream_run(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        q = runs[run_id]["q"]
        loop = asyncio.get_event_loop()
        while True:
            try:
                event = await loop.run_in_executor(None, lambda: q.get(timeout=0.4))
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                if event.get("event") in ("complete", "error"):
                    break
            except _queue.Empty:
                yield "data: {\"event\":\"heartbeat\"}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/result/{run_id}")
async def get_result(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    run = runs[run_id]
    if run["status"] == "running":
        raise HTTPException(status_code=202, detail="Still processing")
    if run["status"] == "error" or not run["result"]:
        raise HTTPException(status_code=422, detail="Run ended with error")
    return run["result"]


@app.get("/api/download/{run_id}")
async def download_docx(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    docx_path = runs[run_id].get("docx_path")
    if not docx_path or not Path(docx_path).exists():
        raise HTTPException(status_code=404, detail="Document not generated yet")
    company = runs[run_id].get("company_name", "PRCE")
    filename = f"PRCE_{company.replace(' ', '_')}.docx"
    return FileResponse(docx_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@app.get("/api/health")
async def health():
    return {"status": "ok", "runs": len(runs)}
