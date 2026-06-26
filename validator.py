"""
Python validation layer — deterministic checks on extracted fleet data.
No LLM. Fast, cheap, catches arithmetic errors and data-quality issues.
"""

DIESEL_TEP_PER_L  = 0.000873
GASOLINE_TEP_PER_L = 0.000773
GNC_TEP_PER_KG    = 0.001149
ELECTRIC_TEP_PER_KWH = 0.000290

CEE_VK_MIN, CEE_VK_MAX = 50, 1500      # gep/VK plausible range
CEE_TK_MIN, CEE_TK_MAX = 0.00005, 0.05  # gep/TK plausible range


def validate(extracted: dict) -> dict:
    """
    Returns {"warnings": [...], "errors": [...], "ok": bool}.
    warnings = noteworthy but pipeline continues.
    errors   = likely bad data, human should review before filing PRCE.
    """
    warnings = []
    errors   = []

    annual   = extracted.get("annual_summary", {})
    quarters = extracted.get("quarterly", [])
    notes    = (extracted.get("data_quality_notes") or "").lower()
    period   = extracted.get("data_period", "")
    fleet_t  = extracted.get("fleet_type", "")

    # ── Truncation ────────────────────────────────────────────────────────────
    if "truncad" in notes or "truncated" in notes:
        errors.append(
            f"FILE TRUNCATED — extracted totals are underestimates. "
            f"Request the complete untruncated Excel from the client."
        )

    # ── Partial year ──────────────────────────────────────────────────────────
    partial_kws = ("q1", "q2", "q3", "q4", "trimestre", "parcial", "jan-mar",
                   "abr-jun", "jul-set", "out-dez")
    if any(kw in period.lower() for kw in partial_kws):
        warnings.append(
            f"PARTIAL YEAR: '{period}'. Annual PRCE requires 12-month data. "
            f"Values are indicative only."
        )

    # ── Fuel → tep cross-check (per quarter) ─────────────────────────────────
    for q in quarters:
        fb  = q.get("fuel_breakdown") or {}
        computed = (
            (fb.get("diesel_l")   or 0) * DIESEL_TEP_PER_L  +
            (fb.get("gasoline_l") or 0) * GASOLINE_TEP_PER_L +
            (fb.get("gnc_kg")     or 0) * GNC_TEP_PER_KG    +
            (fb.get("kwh")        or 0) * ELECTRIC_TEP_PER_KWH
        )
        extracted_tep = q.get("energy_tep") or 0
        if computed > 0 and extracted_tep > 0:
            pct = abs(computed - extracted_tep) / extracted_tep * 100
            if pct > 10:
                errors.append(
                    f"{q.get('label','?')}: fuel→tep mismatch {pct:.0f}% "
                    f"(from litres/kg: {computed:.1f} tep vs reported: {extracted_tep:.1f} tep). "
                    f"Check unit columns."
                )

    # ── Annual totals vs sum of quarters ─────────────────────────────────────
    if len(quarters) > 1:
        q_km  = sum(q.get("km")         or 0 for q in quarters)
        q_tep = sum(q.get("energy_tep") or 0 for q in quarters)
        a_km  = annual.get("total_km")         or 0
        a_tep = annual.get("total_energy_tep") or 0
        if a_km > 0 and q_km > 0 and abs(q_km - a_km) / a_km > 0.05:
            warnings.append(
                f"Sum of quarterly km ({q_km:,.0f}) differs {abs(q_km-a_km)/a_km*100:.0f}% "
                f"from annual total ({a_km:,.0f}). Possible subtotal row used as grand total."
            )
        if a_tep > 0 and q_tep > 0 and abs(q_tep - a_tep) / a_tep > 0.05:
            warnings.append(
                f"Sum of quarterly tep ({q_tep:.1f}) differs {abs(q_tep-a_tep)/a_tep*100:.0f}% "
                f"from annual total ({a_tep:.1f}). Check for double-counting."
            )

    # ── GNC magnitude check (litres vs kg confusion) ─────────────────────────
    for q in quarters:
        fb  = q.get("fuel_breakdown") or {}
        gnc = fb.get("gnc_kg") or 0
        km  = q.get("km") or 1
        if gnc > 0 and gnc / km > 0.5:
            warnings.append(
                f"{q.get('label','?')}: GNC {gnc:,.0f} vs {km:,.0f} km — "
                f"ratio {gnc/km:.2f} kg/km is implausibly high. "
                f"May be litres reported as kg (factor ×0.72 difference)."
            )

    # ── CEE plausibility (post-calculation — call after calculate()) ──────────
    # (called separately via validate_metrics)

    return {
        "warnings": warnings,
        "errors":   errors,
        "ok":       len(errors) == 0,
    }


def validate_metrics(metrics) -> dict:
    """Post-calculation plausibility checks on PRCEMetrics."""
    issues = []
    cee = metrics.cee_global
    unit = metrics.cee_unit

    if unit == "gep/VK" and not (CEE_VK_MIN <= cee <= CEE_VK_MAX):
        issues.append(
            f"CEE {cee:.2f} gep/VK outside plausible range "
            f"[{CEE_VK_MIN}–{CEE_VK_MAX}]. Check km and energy totals."
        )
    if unit == "gep/TK" and not (CEE_TK_MIN <= cee <= CEE_TK_MAX):
        issues.append(
            f"CEE {cee:.5f} gep/TK outside plausible range "
            f"[{CEE_TK_MIN}–{CEE_TK_MAX}]. Check work_tkm calculation."
        )
    if metrics.total_energy_tep <= 0:
        issues.append("total_energy_tep is zero or negative — extraction likely failed.")

    return {"issues": issues, "ok": len(issues) == 0}


def print_validation(result: dict, label: str = ""):
    prefix = f"  [{label}] " if label else "  "
    for e in result.get("errors", []):
        print(f"{prefix}🔴 {e}")
    for w in result.get("warnings", []):
        print(f"{prefix}🟡 {w}")
    for i in result.get("issues", []):
        print(f"{prefix}🔴 {i}")
    if result.get("ok") and not result.get("errors") and not result.get("warnings"):
        print(f"{prefix}✅ All checks passed")
