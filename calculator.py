"""
Energy calculation engine for Portuguese transport energy audits (RGCEST / Portaria 228/90).
Converts raw fleet data → tep → CEE → PRCE reduction targets.
"""

from dataclasses import dataclass, field
from typing import Optional


# ── Conversion factors (official Portuguese DGEG values) ──────────────────────
DIESEL_KEP_PER_L    = 0.873   # kgep/L
GASOLINE_KEP_PER_L  = 0.773   # kgep/L
GNL_KEP_PER_KG      = 1.149   # kgep/kg (GNL/GNC)
ELECTRIC_KEP_PER_KWH = 0.290  # kgep/kWh

CO2_DIESEL_PER_TEP    = 3098.20  # kgCO2e/tep
CO2_GASOLINE_PER_TEP  = 2897.30  # kgCO2e/tep
CO2_GNL_PER_TEP       = 2349.00  # kgCO2e/tep
CO2_ELECTRIC_PER_KWH  = 0.47     # kgCO2e/kWh


@dataclass
class QuarterMetrics:
    label: str
    km: float
    energy_tep: float
    cargo_t: Optional[float]
    work_tkm: Optional[float]
    cee_gep_tk: Optional[float]    # gep/TK  (heavy cargo fleets)
    cee_gep_vk: Optional[float]    # gep/VK  (mixed / light fleets)


@dataclass
class PRCEMetrics:
    # Annual totals
    total_km: float
    total_energy_tep: float
    total_cargo_t: Optional[float]
    total_work_tkm: Optional[float]
    data_period: str
    fleet_type: str

    # CEE (specific energy consumption)
    cee_global: float              # gep/TK or gep/VK depending on fleet type
    cee_unit: str                  # "gep/TK" or "gep/VK"

    # PRCE mandatory targets (Portaria 228/90 formula)
    K: float
    annual_reduction: float
    targets: dict                  # {year: {cee, energy_tep}}

    # CO2
    total_co2_tco2: float

    # Data provenance
    data_quality_notes: str = ""

    # Quarterly breakdown
    quarters: list[QuarterMetrics] = field(default_factory=list)


def _fuel_to_kgep(diesel_l=0, gasoline_l=0, gnc_kg=0, kwh=0) -> float:
    return (
        diesel_l    * DIESEL_KEP_PER_L +
        gasoline_l  * GASOLINE_KEP_PER_L +
        gnc_kg      * GNL_KEP_PER_KG +
        kwh         * ELECTRIC_KEP_PER_KWH
    )


def _co2_from_tep(energy_tep: float, fleet_type: str) -> float:
    """Rough CO2 estimate — assumes diesel-dominant fleet."""
    return energy_tep * CO2_DIESEL_PER_TEP / 1000  # → tCO2


def calculate(extracted: dict) -> PRCEMetrics:
    """
    Turn the LLM-extracted dict into a full PRCEMetrics object.
    Handles both heavy cargo (gep/TK) and mixed/urban (gep/VK) fleets.
    """
    annual = extracted.get("annual_summary", {})
    fleet_type = extracted.get("fleet_type", "mixed_logistics")
    data_period = extracted.get("data_period", "2024")
    data_quality_notes = extracted.get("data_quality_notes", "") or ""

    total_km        = float(annual.get("total_km", 0))
    total_energy_tep = float(annual.get("total_energy_tep", 0))
    total_cargo_t   = annual.get("total_cargo_tonnes")
    total_work_tkm  = annual.get("total_work_tkm")

    if total_cargo_t is not None:
        total_cargo_t = float(total_cargo_t)
    if total_work_tkm is not None:
        total_work_tkm = float(total_work_tkm)

    # work_tkm for PRCE: official Portaria 228/90 methodology uses total_km × total_cargo_t
    # (fleet-level aggregate). Per-vehicle or per-trip columns in fleet management Excel files
    # do NOT represent the same quantity — they accumulate per-trip legs and diverge significantly.
    # So: always recompute from aggregates when total_cargo_t is available.
    if total_cargo_t is not None and total_km > 0:
        total_work_tkm = total_km * total_cargo_t
    elif total_work_tkm is None:
        total_work_tkm = None  # urban fleet — will use gep/VK path

    # ── Quarterly breakdown ──────────────────────────────────────────────────
    quarters_raw = extracted.get("quarterly", [])
    quarters: list[QuarterMetrics] = []

    for q in quarters_raw:
        q_km       = float(q.get("km", 0))
        q_energy   = float(q.get("energy_tep", 0))
        q_cargo    = q.get("cargo_t")
        q_work     = None
        cee_tk     = None
        cee_vk     = None

        if q_cargo is not None:
            q_cargo = float(q_cargo)
            q_work = q_km * q_cargo
            if q_work > 0:
                q_energy_gep = q_energy * 1_000_000
                cee_tk = q_energy_gep / q_work

        if q_km > 0:
            q_energy_kgep = q_energy * 1000
            cee_vk = (q_energy_kgep * 1000) / q_km  # gep/VK

        quarters.append(QuarterMetrics(
            label=q.get("label", "?"),
            km=q_km,
            energy_tep=q_energy,
            cargo_t=q_cargo,
            work_tkm=q_work,
            cee_gep_tk=round(cee_tk, 5) if cee_tk else None,
            cee_gep_vk=round(cee_vk, 2) if cee_vk else None,
        ))

    # ── Global CEE ──────────────────────────────────────────────────────────
    energy_gep = total_energy_tep * 1_000_000

    # Heavy cargo: gep/TK (tonne-km)
    if total_work_tkm and total_work_tkm > 0:
        cee_global = energy_gep / total_work_tkm
        cee_unit = "gep/TK"
    else:
        # Mixed/urban: gep/VK (vehicle-km)
        cee_global = (total_energy_tep * 1000 * 1000) / total_km if total_km > 0 else 0
        cee_unit = "gep/VK"

    # ── PRCE targets (Portaria 228/90 formula: M = (C-K)/2 × n/3) ───────────
    C = cee_global
    K = C * 0.90                   # minimum K = 90% of C
    # Annual reduction: M_year1 = (C-K)/2 × 1/3
    annual_reduction = (C - K) / 2 / 3

    def target_energy(target_cee):
        ratio = target_cee / C if C > 0 else 1
        return round(total_energy_tep * ratio, 2)

    # Extract 4-digit year from period string (e.g. "Q1 2025 (extrapolated)" → 2025)
    import re as _re
    year_match = _re.search(r"\b(20\d{2})\b", data_period)
    ref_year = year_match.group(1) if year_match else "2024"
    plan_start = int(ref_year) + 1

    targets = {
        f"{ref_year} (ref.)": {
            "cee": round(C, 5),
            "energy_tep": round(total_energy_tep, 1),
        },
        str(plan_start): {
            "cee": round(C - annual_reduction, 5),
            "energy_tep": target_energy(C - annual_reduction),
        },
        str(plan_start + 1): {
            "cee": round(C - 2 * annual_reduction, 5),
            "energy_tep": target_energy(C - 2 * annual_reduction),
        },
        str(plan_start + 2): {
            "cee": round(C - 3 * annual_reduction, 5),
            "energy_tep": target_energy(C - 3 * annual_reduction),
        },
    }

    total_co2 = _co2_from_tep(total_energy_tep, fleet_type)

    return PRCEMetrics(
        total_km=total_km,
        total_energy_tep=total_energy_tep,
        total_cargo_t=total_cargo_t,
        total_work_tkm=total_work_tkm,
        data_period=data_period,
        fleet_type=fleet_type,
        cee_global=round(C, 5),
        cee_unit=cee_unit,
        K=round(K, 5),
        annual_reduction=round(annual_reduction, 5),
        targets=targets,
        total_co2_tco2=round(total_co2, 1),
        data_quality_notes=data_quality_notes,
        quarters=quarters,
    )
