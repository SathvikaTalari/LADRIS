"""
Synthetic data generator for LADRIS ML training.

Generates realistic Indian land acquisition project records modelled on:
- Real project types: highway, railway, irrigation, industrial, urban
- Real implementing agencies: NHAI, Indian Railways, DFCCIL, APIIC, HMDA, State PWDs
- Real state/district pairs (Telangana, AP, Maharashtra, UP, Rajasthan, Karnataka)
- Realistic delay distributions learned from domain knowledge:
    * Highways: ~55% delayed, avg 180 days
    * Railways: ~50% delayed, avg 220 days
    * Irrigation: ~65% delayed, avg 300 days
    * Industrial: ~40% delayed, avg 120 days
    * Urban: ~45% delayed, avg 150 days
- Realistic feature correlations:
    * More affected families → higher delay probability
    * Open legal disputes → strong delay signal
    * Low compensation disbursement → high delay probability
    * District/agency historical rate embedded in data

Usage:
    from app.ml.synthetic_data import generate_synthetic_projects
    df = generate_synthetic_projects(n=500)
    df.to_csv("data/incoming/synthetic_projects.csv", index=False)
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

# ── Geography ──────────────────────────────────────────────────────────────────

STATE_DISTRICTS = {
    "Telangana": [
        "Hyderabad", "Warangal", "Nalgonda", "Khammam", "Medak",
        "Karimnagar", "Nizamabad", "Adilabad", "Sangareddy", "Suryapet",
    ],
    "Andhra Pradesh": [
        "Guntur", "Krishna", "Vishakhapatnam", "Kurnool", "Anantapur",
        "Chittoor", "West Godavari", "East Godavari", "Prakasam", "SPSR Nellore",
    ],
    "Maharashtra": [
        "Pune", "Nagpur", "Nashik", "Aurangabad", "Thane",
        "Solapur", "Kolhapur", "Amravati", "Nanded", "Raigad",
    ],
    "Uttar Pradesh": [
        "Lucknow", "Agra", "Varanasi", "Kanpur", "Meerut",
        "Allahabad", "Bareilly", "Ghaziabad", "Mathura", "Jhansi",
    ],
    "Rajasthan": [
        "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer",
        "Bikaner", "Alwar", "Sikar", "Bharatpur", "Pali",
    ],
    "Karnataka": [
        "Bangalore Urban", "Mysuru", "Hubballi", "Belagavi", "Mangaluru",
        "Davangere", "Ballari", "Tumkur", "Vijayapura", "Kalaburagi",
    ],
    "Gujarat": [
        "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar",
        "Anand", "Mehsana", "Bharuch", "Junagadh", "Botad",
    ],
    "Madhya Pradesh": [
        "Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain",
        "Sagar", "Rewa", "Satna", "Ratlam", "Morena",
    ],
}

# ── Project Type Configuration ─────────────────────────────────────────────────

PROJECT_TYPE_CONFIG = {
    "highway": {
        "agencies": ["NHAI", "State PWD", "MORTH"],
        "delay_rate": 0.55,
        "avg_delay_days": 180,
        "delay_std": 120,
        "land_area_range": (10, 120),
        "families_range": (30, 400),
        "duration_months_range": (12, 36),
        "compensation_range": (5e6, 150e6),
    },
    "railway": {
        "agencies": ["Indian Railways", "DFCCIL", "RVNL"],
        "delay_rate": 0.50,
        "avg_delay_days": 220,
        "delay_std": 150,
        "land_area_range": (20, 200),
        "families_range": (50, 600),
        "duration_months_range": (18, 48),
        "compensation_range": (10e6, 300e6),
    },
    "irrigation": {
        "agencies": ["State PWD", "State Irrigation Dept", "Central Water Commission"],
        "delay_rate": 0.65,
        "avg_delay_days": 300,
        "delay_std": 200,
        "land_area_range": (15, 300),
        "families_range": (40, 800),
        "duration_months_range": (18, 60),
        "compensation_range": (5e6, 200e6),
    },
    "industrial": {
        "agencies": ["APIIC", "MIDC", "RIICO", "GIDC", "KIADB"],
        "delay_rate": 0.40,
        "avg_delay_days": 120,
        "delay_std": 90,
        "land_area_range": (20, 200),
        "families_range": (50, 500),
        "duration_months_range": (12, 30),
        "compensation_range": (20e6, 400e6),
    },
    "urban": {
        "agencies": ["HMDA", "GHMC", "NMMC", "BBMP", "JNURM"],
        "delay_rate": 0.45,
        "avg_delay_days": 150,
        "delay_std": 100,
        "land_area_range": (2, 50),
        "families_range": (20, 200),
        "duration_months_range": (10, 24),
        "compensation_range": (5e6, 100e6),
    },
}

LIFECYCLE_STAGES = [
    "notification", "survey", "approval", "compensation",
    "legal_resolution", "rehabilitation", "possession", "completed",
]

# Typical max duration (days) per stage — used to assign realistic stage_entered_date
STAGE_EXPECTED_DAYS = {
    "notification": 30,
    "survey": 60,
    "approval": 90,
    "compensation": 120,
    "legal_resolution": 180,
    "rehabilitation": 120,
    "possession": 30,
    "completed": 0,
}

# District-level historical delay modifier (deviates from base delay_rate)
DISTRICT_DELAY_MODIFIERS: dict[str, float] = {}  # built dynamically per run


def _random_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    if delta.days <= 0:
        return start
    return start + timedelta(days=random.randint(0, delta.days))


def _build_district_modifiers() -> dict[str, float]:
    """Assign each district a slight bias (+/- 0.15) around the base rate."""
    mods = {}
    for districts in STATE_DISTRICTS.values():
        for d in districts:
            mods[d] = round(random.uniform(-0.15, 0.15), 3)
    return mods


def _current_stage_for_project(
    notification_date: datetime,
    expected_completion: datetime,
    is_delayed: bool,
    has_legal_disputes: bool,
) -> str:
    """Heuristically pick a realistic current stage."""
    today = datetime.utcnow()
    elapsed_pct = (today - notification_date).days / max(
        1, (expected_completion - notification_date).days
    )
    if elapsed_pct >= 1.0:
        return "completed"
    if elapsed_pct >= 0.85:
        return "possession" if not has_legal_disputes else "legal_resolution"
    if elapsed_pct >= 0.70:
        return "rehabilitation"
    if elapsed_pct >= 0.50:
        return "compensation" if not has_legal_disputes else "legal_resolution"
    if elapsed_pct >= 0.30:
        return "approval"
    if elapsed_pct >= 0.15:
        return "survey"
    return "notification"


def generate_synthetic_projects(
    n: int = 500,
    seed: int = 42,
    completed_fraction: float = 0.70,
) -> pd.DataFrame:
    """
    Generate n synthetic land acquisition project rows.

    Args:
        n: Number of projects to generate.
        seed: Random seed for reproducibility.
        completed_fraction: Fraction of projects that are completed (have labels).
                           The rest are ongoing (no is_delayed label).

    Returns:
        DataFrame with the same column schema as DATA_SCHEMA.md.
    """
    random.seed(seed)
    np.random.seed(seed)

    district_modifiers = _build_district_modifiers()
    rows = []

    project_types = list(PROJECT_TYPE_CONFIG.keys())
    type_weights = [0.30, 0.20, 0.20, 0.20, 0.10]  # highway, railway, irrigation, industrial, urban

    for i in range(1, n + 1):
        # ── Identity ──────────────────────────────────────────────────────────
        ptype = random.choices(project_types, weights=type_weights)[0]
        cfg = PROJECT_TYPE_CONFIG[ptype]

        state = random.choice(list(STATE_DISTRICTS.keys()))
        district = random.choice(STATE_DISTRICTS[state])
        agency = random.choice(cfg["agencies"])

        project_id = f"SYN{i:04d}"
        project_name = _make_project_name(ptype, i, district)

        # ── Timelines ─────────────────────────────────────────────────────────
        start_year = random.randint(2018, 2024)
        start_month = random.randint(1, 12)
        notification_date = datetime(start_year, start_month, random.randint(1, 28))

        duration_months = random.randint(*cfg["duration_months_range"])
        expected_completion = notification_date + timedelta(days=duration_months * 30)

        is_completed = random.random() < completed_fraction

        # ── Delay logic ───────────────────────────────────────────────────────
        base_delay_rate = cfg["delay_rate"]
        district_mod = district_modifiers.get(district, 0)
        effective_delay_rate = max(0.05, min(0.95, base_delay_rate + district_mod))

        # Legal disputes amplify delay probability — but with diminishing returns.
        # Using log scale instead of linear: 1 dispute -> +12%, 2 -> +19%, 3 -> +24%
        # (previously was linear: 1 -> +15%, 2 -> +30%, 3 -> +45% — too aggressive)
        legal_dispute_count = _sample_legal_disputes()
        if legal_dispute_count > 0:
            effective_delay_rate = min(0.85, effective_delay_rate + 0.12 * np.log1p(legal_dispute_count))

        # Land area and families add very slight delay risk
        land_area = round(random.uniform(*cfg["land_area_range"]), 1)
        affected_families = random.randint(*cfg["families_range"])
        if affected_families > 200:
            effective_delay_rate = min(0.85, effective_delay_rate + 0.03)

        # Add medium-risk noise: ~20% of projects get their delay probability
        # pulled toward 0.5 to create training examples with mixed signals.
        # This directly addresses the bimodal score distribution.
        if random.random() < 0.20:
            effective_delay_rate = effective_delay_rate * 0.7 + 0.5 * 0.3

        is_delayed: Optional[bool] = None
        delay_days: Optional[int] = None
        actual_completion: Optional[datetime] = None
        current_stage: str

        if is_completed:
            is_delayed = random.random() < effective_delay_rate
            if is_delayed:
                delay_days = max(
                    1,
                    int(np.random.normal(cfg["avg_delay_days"], cfg["delay_std"]))
                )
                actual_completion = expected_completion + timedelta(days=delay_days)
            else:
                delay_days = 0
                days_early = random.randint(0, 30)
                actual_completion = expected_completion - timedelta(days=days_early)
            current_stage = "completed"
        else:
            current_stage = _current_stage_for_project(
                notification_date, expected_completion,
                bool(is_delayed), legal_dispute_count > 0,
            )

        # ── Compensation ──────────────────────────────────────────────────────
        # NOTE: Ranges intentionally OVERLAP between delayed and on-time projects.
        # Real projects have good compensation disbursement AND still get delayed
        # (due to disputes, admin issues). Without overlap the model memorises a
        # hard boundary and fails on any real-world data.
        comp_sanctioned = round(random.uniform(*cfg["compensation_range"]), 0)
        if is_completed and not is_delayed:
            # On-time: mostly well-disbursed, but not always 100%
            comp_disbursed_pct = np.clip(random.gauss(0.88, 0.12), 0.55, 1.0)
        elif is_delayed:
            # Delayed: mostly low, but some projects have high disbursement
            # and still got delayed (e.g. due to disputes or R&R issues)
            comp_disbursed_pct = np.clip(random.gauss(0.48, 0.22), 0.05, 0.95)
        elif current_stage in ("rehabilitation", "possession"):
            comp_disbursed_pct = np.clip(random.gauss(0.80, 0.10), 0.50, 1.0)
        elif current_stage in ("compensation", "legal_resolution"):
            comp_disbursed_pct = np.clip(random.gauss(0.50, 0.20), 0.10, 0.90)
        else:
            comp_disbursed_pct = np.clip(random.gauss(0.25, 0.15), 0.02, 0.60)
        comp_disbursed_pct = round(comp_disbursed_pct, 4)

        comp_disbursed = round(comp_sanctioned * comp_disbursed_pct, 0)

        # ── Rehabilitation ────────────────────────────────────────────────────
        # Again: overlapping distributions — some on-time projects have low R&R
        # (rural projects) and some delayed projects still have high R&R.
        if current_stage in ("rehabilitation", "possession", "completed"):
            if not is_delayed:
                rehab_pct = np.clip(random.gauss(82, 15), 40, 100)
            else:
                rehab_pct = np.clip(random.gauss(55, 20), 10, 95)
        elif current_stage == "compensation":
            rehab_pct = np.clip(random.gauss(28, 15), 0, 70)
        else:
            rehab_pct = np.clip(random.gauss(10, 8), 0, 35)
        rehab_pct = round(float(rehab_pct), 1)

        # ── Legal ─────────────────────────────────────────────────────────────
        open_disputes = legal_dispute_count if not is_completed else (
            0 if not is_delayed else random.randint(0, legal_dispute_count)
        )

        # ── Stakeholder responsiveness ────────────────────────────────────────
        # Fewer updates = higher risk; on-time projects update more frequently
        if is_delayed or current_stage in ("legal_resolution", "approval"):
            stakeholder_updates_90d = random.randint(0, 2)
        else:
            stakeholder_updates_90d = random.randint(2, 8)

        row = {
            "Project ID": project_id,
            "Project Name": project_name,
            "Project Type": ptype,
            "Implementing Agency": agency,
            "State": state,
            "District": district,
            "Land Area (ha)": land_area,
            "Affected Families": affected_families,
            "Notification Date": notification_date.strftime("%Y-%m-%d"),
            "Expected Completion": expected_completion.strftime("%Y-%m-%d"),
            "Actual Completion": actual_completion.strftime("%Y-%m-%d") if actual_completion else "",
            "Current Stage": current_stage,
            "Delayed (Y/N)": ("Y" if is_delayed else "N") if is_delayed is not None else "",
            "Delay (days)": delay_days if delay_days is not None else "",
            "Compensation Sanctioned": int(comp_sanctioned),
            "Compensation Disbursed": int(comp_disbursed),
            "Open Disputes": open_disputes,
            "R&R Progress %": rehab_pct,
            # Extra columns for richer ML features
            "Stakeholder Updates (90d)": stakeholder_updates_90d,
            "Legal Dispute Count": legal_dispute_count,
        }
        rows.append(row)

    df = pd.DataFrame(rows)
    return df


def _sample_legal_disputes() -> int:
    """Sample number of legal disputes from a realistic distribution."""
    r = random.random()
    if r < 0.45:
        return 0
    if r < 0.70:
        return 1
    if r < 0.85:
        return 2
    if r < 0.93:
        return 3
    return random.randint(4, 8)


def _make_project_name(ptype: str, idx: int, district: str) -> str:
    templates = {
        "highway": [
            f"NH Extension Package {idx}",
            f"State Highway Widening {district} Sec {idx}",
            f"4-Lane Highway {district}-{idx}",
            f"Bypass Road Project {idx} ({district})",
        ],
        "railway": [
            f"Rail Corridor {district} Segment {idx}",
            f"Freight Corridor Extension {idx}",
            f"Metro Rail Phase {idx} {district}",
            f"Rail Electrification Project {district}-{idx}",
        ],
        "irrigation": [
            f"Irrigation Canal {district} {idx}",
            f"Dam & Reservoir Project {idx}",
            f"Lift Irrigation Scheme {district}-{idx}",
            f"Canal Network Expansion {idx}",
        ],
        "industrial": [
            f"Industrial Corridor Phase {idx}",
            f"Special Economic Zone {district}-{idx}",
            f"Industrial Park {district} {idx}",
            f"Manufacturing Hub {idx} {district}",
        ],
        "urban": [
            f"Urban Flyover {district} {idx}",
            f"Ring Road Project {idx}",
            f"BRTS Corridor {district}-{idx}",
            f"Metro Extension {idx} {district}",
        ],
    }
    return random.choice(templates.get(ptype, [f"Project {idx}"]))


if __name__ == "__main__":
    df = generate_synthetic_projects(n=600, seed=42)
    print(f"Generated {len(df)} projects")
    print(f"Delayed: {(df['Delayed (Y/N)'] == 'Y').sum()}")
    print(f"Not Delayed: {(df['Delayed (Y/N)'] == 'N').sum()}")
    print(f"Ongoing (no label): {(df['Delayed (Y/N)'] == '').sum()}")
    print(df.head(3).to_string())
    out = "data/incoming/synthetic_projects.csv"
    import os
    os.makedirs("data/incoming", exist_ok=True)
    df.to_csv(out, index=False)
    print(f"\nSaved to {out}")
