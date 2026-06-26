#!/usr/bin/env python3
"""
AE/PRCE Automation Demo
========================
Usage:
    python main.py <excel_file> [company_name] [output.docx]

Example:
    python main.py "../Downloads/Elementos_OtimizacaoAE_Transportes/Cliente3/client3_Dados da Frota 1º e 2ºT_2025.xlsx" "Cliente 3 - Gestão de Resíduos"
"""

import sys
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, Future

from extractor  import extract_fleet_data
from calculator import calculate
from generator  import generate_prce
from validator  import validate, validate_metrics, print_validation
from reporter   import generate_completeness_report


def banner(text: str):
    print(f"\n{'─' * 60}")
    print(f"  {text}")
    print('─' * 60)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    excel_path   = sys.argv[1]
    company_name = sys.argv[2] if len(sys.argv) > 2 else "XXXX"
    output_path  = sys.argv[3] if len(sys.argv) > 3 else None

    if not Path(excel_path).exists():
        print(f"❌ File not found: {excel_path}")
        sys.exit(1)

    total_start = time.time()

    # ── STEP 1: Extract ──────────────────────────────────────────────────────
    banner("STEP 1 — AI Data Extraction (Claude Opus 4.8)")
    t0 = time.time()
    try:
        extracted = extract_fleet_data(excel_path)
    except Exception as e:
        print(f"\n  ❌ Extraction failed: {e}")
        sys.exit(1)
    print(f"\n  Raw extraction result:")
    print(json.dumps(extracted, indent=2, ensure_ascii=False)[:3000])
    print(f"\n  ✅ Extraction: {time.time()-t0:.1f}s")

    # ── STEP 2a: Validate (Python, instant) ──────────────────────────────────
    banner("STEP 2a — Data Validation (Python checks)")
    validation = validate(extracted)
    print_validation(validation, label="extraction")

    # ── STEP 2b: Calculate ────────────────────────────────────────────────────
    banner("STEP 2b — Energy Calculation Engine")
    t0 = time.time()
    annual = extracted.get("annual_summary", {})
    if not annual.get("total_km") or not annual.get("total_energy_tep"):
        print("  ❌ Cannot calculate: total_km and total_energy_tep are required.")
        print("  The input file is too incomplete or truncated to produce a PRCE.")
        print("  Request the complete untruncated annual data file from the client.")
        sys.exit(1)
    try:
        metrics = calculate(extracted)
    except Exception as e:
        print(f"\n  ❌ Calculation failed: {e}")
        sys.exit(1)

    metrics_check = validate_metrics(metrics)
    print_validation(metrics_check, label="metrics")

    print(f"\n  Period:           {metrics.data_period}")
    print(f"  Total km:         {metrics.total_km:,.0f} km")
    print(f"  Total energy:     {metrics.total_energy_tep:,.1f} tep")
    if metrics.total_cargo_t:
        print(f"  Total cargo:      {metrics.total_cargo_t:,.1f} t")
        print(f"  Total work:       {metrics.total_work_tkm:,.0f} t.km")
    print(f"  CEE global:       {metrics.cee_global} {metrics.cee_unit}")
    print(f"  K (90% of CEE):   {metrics.K} {metrics.cee_unit}")
    print(f"  Annual reduction: {metrics.annual_reduction} {metrics.cee_unit}/year")
    print()
    print("  PRCE Targets:")
    for year, t in metrics.targets.items():
        print(f"    {year}: CEE={t['cee']} {metrics.cee_unit}  →  {t['energy_tep']} tep")
    print(f"\n  ✅ Calculations: {time.time()-t0:.1f}s")

    # ── STEP 3 + 4 — Generate PRCE doc + Completeness report (concurrent) ────
    banner("STEP 3+4 — PRCE Document + Data Gap Report (concurrent)")
    t0 = time.time()

    report_future: Future
    with ThreadPoolExecutor(max_workers=2) as pool:
        report_future = pool.submit(
            generate_completeness_report, extracted, validation
        )
        try:
            out = generate_prce(metrics, company_name=company_name, output_path=output_path)
        except Exception as e:
            print(f"\n  ❌ Document generation failed: {e}")
            sys.exit(1)

        report = report_future.result()

    print(f"  ✅ PRCE document: {out}  ({time.time()-t0:.1f}s)")

    # ── Print completeness report ─────────────────────────────────────────────
    banner("STEP 4 — Data Gap Report")
    summary = report.get("gap_summary", "")
    # If gap_summary looks like raw JSON (parse failed), show a fallback message
    if summary.strip().startswith("{"):
        print("  ⚠️  Report response truncated — increase max_tokens or shorten prompt")
    else:
        print(f"  {summary}")
    print()
    missing = report.get("missing_items", [])
    if missing:
        print("  Documents/data needed from client:")
        for item in missing:
            print(f"    • {item}")
    email = report.get("client_email_pt", "")
    if email:
        print()
        print("  ── Draft email (PT) ──────────────────────────────────")
        for line in email.split("\n"):
            print(f"  {line}")

    banner(f"✅ DONE in {time.time()-total_start:.1f}s")
    print(f"  📄 PRCE document: {Path(out).absolute()}")
    print()


if __name__ == "__main__":
    main()
