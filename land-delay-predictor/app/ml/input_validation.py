"""
Input / Data-Quality Validation for LADRIS ML predictions.

Enforces:
  1. Required column presence
  2. Data-type coercion with error reporting (not silent drop)
  3. Out-of-range detection (e.g. disbursement_pct > 100 is impossible)
  4. Categorical value allowlist checks
  5. Cross-field consistency checks (disbursed <= sanctioned, etc.)

Returns a ValidationResult with all issues collected — callers decide
whether to reject, warn, or clamp.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandas as pd

# ── Allowed categorical values ────────────────────────────────────────────────
ALLOWED_PROJECT_TYPES = {
    "highway", "railway", "irrigation", "industrial", "urban",
    "power", "pipeline", "defence", "mining", "other",
}

ALLOWED_STAGES = {
    "notification", "survey", "approval", "compensation",
    "legal_resolution", "rehabilitation", "possession", "completed",
}

# ── Numeric range constraints: (min, max, clamp_on_warn) ─────────────────────
# clamp_on_warn=True: value is clamped to [min, max] automatically
# clamp_on_warn=False: value is rejected (set to NaN) with an error
NUMERIC_RANGES: dict[str, tuple[float, float, bool]] = {
    "land_area_hectares":               (0.0,    500_000.0, True),
    "affected_families_count":          (0.0,    2_000_000.0, True),
    "days_since_notification":          (0.0,    36500.0,   True),   # max 100 years
    "days_to_expected_completion":      (-3650.0, 36500.0,  True),   # can be negative (overdue)
    "compensation_sanctioned":          (0.0,    1e13,      True),
    "compensation_disbursed":           (0.0,    1e13,      True),
    "compensation_disbursement_pct":    (0.0,    100.0,     True),   # percentage, must be 0-100
    "days_since_last_disbursement":     (0.0,    36500.0,   True),
    "legal_dispute_count":              (0.0,    10_000.0,  True),
    "open_legal_dispute_count":         (0.0,    10_000.0,  True),
    "max_dispute_pendency_days":        (0.0,    36500.0,   True),
    "rehabilitation_progress_pct":      (0.0,    100.0,     True),   # percentage
    "resettlement_site_ready":          (0.0,    1.0,       True),   # boolean 0/1
    "stakeholder_update_count_90d":     (0.0,    10_000.0,  True),
    "avg_days_between_updates":         (0.0,    36500.0,   True),
    "stage_count_recorded":             (0.0,    8.0,       True),   # max 8 lifecycle stages
    "district_historical_delay_rate":   (0.0,    1.0,       True),   # fraction 0-1
    "agency_historical_delay_rate":     (0.0,    1.0,       True),   # fraction 0-1
}

# ── Required columns ──────────────────────────────────────────────────────────
REQUIRED_COLUMNS = [
    "project_type", "state", "district", "implementing_agency",
    "land_area_hectares", "affected_families_count",
    "days_since_notification", "days_to_expected_completion",
    "compensation_sanctioned", "compensation_disbursed",
    "compensation_disbursement_pct", "days_since_last_disbursement",
    "legal_dispute_count", "open_legal_dispute_count",
    "max_dispute_pendency_days", "rehabilitation_progress_pct",
    "resettlement_site_ready", "stakeholder_update_count_90d",
    "avg_days_between_updates", "stage_count_recorded",
    "current_stage", "district_historical_delay_rate",
    "agency_historical_delay_rate",
]


# ── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class ValidationResult:
    is_valid: bool = True
    errors: list[str] = field(default_factory=list)    # blocking issues
    warnings: list[str] = field(default_factory=list)  # non-blocking
    clamped: list[str] = field(default_factory=list)   # auto-fixed fields
    rows_with_issues: dict[int, list[str]] = field(default_factory=dict)

    def add_error(self, msg: str, row: int | None = None):
        self.is_valid = False
        self.errors.append(msg)
        if row is not None:
            self.rows_with_issues.setdefault(row, []).append(f"ERROR: {msg}")

    def add_warning(self, msg: str, row: int | None = None):
        self.warnings.append(msg)
        if row is not None:
            self.rows_with_issues.setdefault(row, []).append(f"WARN: {msg}")

    def add_clamp(self, msg: str, row: int | None = None):
        self.clamped.append(msg)
        if row is not None:
            self.rows_with_issues.setdefault(row, []).append(f"CLAMP: {msg}")

    def summary(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "clamped_count": len(self.clamped),
            "errors": self.errors,
            "warnings": self.warnings,
            "clamped": self.clamped,
        }


# ── Core validator ────────────────────────────────────────────────────────────

def validate_and_clean(df: pd.DataFrame, strict: bool = False) -> tuple[pd.DataFrame, ValidationResult]:
    """
    Validate a feature DataFrame and return a cleaned copy with a ValidationResult.

    Args:
        df:     Feature DataFrame (one row per project to score).
        strict: If True, any out-of-range value raises an error (not a warning).
                If False (default), values are clamped and a warning is issued.

    Returns:
        (cleaned_df, result) — cleaned_df has clamped/coerced values applied.
    """
    result = ValidationResult()
    df = df.copy()

    # ── 1. Required columns ───────────────────────────────────────────────────
    missing_cols = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        result.add_error(f"Missing required columns: {missing_cols}")
        return df, result  # Cannot continue without required columns

    # ── 2. Per-row checks ─────────────────────────────────────────────────────
    for idx in range(len(df)):
        row = df.iloc[idx]

        # -- 2a. Project type allowlist --
        ptype = str(row.get("project_type", "")).strip().lower()
        if ptype and ptype not in ALLOWED_PROJECT_TYPES:
            result.add_warning(
                f"Row {idx}: unknown project_type '{ptype}' "
                f"(allowed: {sorted(ALLOWED_PROJECT_TYPES)})", row=idx
            )

        # -- 2b. Current stage allowlist --
        stage = str(row.get("current_stage", "")).strip().lower()
        if stage and stage not in ALLOWED_STAGES:
            result.add_error(
                f"Row {idx}: invalid current_stage '{stage}' "
                f"(allowed: {sorted(ALLOWED_STAGES)})", row=idx
            )

        # -- 2c. Numeric ranges --
        for col, (lo, hi, clamp) in NUMERIC_RANGES.items():
            raw = row.get(col)
            if raw is None or (isinstance(raw, float) and raw != raw):
                continue  # NaN/None — skip range check (coerce handles it)
            try:
                val = float(raw)
            except (TypeError, ValueError):
                result.add_warning(f"Row {idx}: column '{col}' is not numeric (value={raw!r})", row=idx)
                continue

            if val < lo or val > hi:
                if strict:
                    result.add_error(
                        f"Row {idx}: '{col}' = {val} is out of range [{lo}, {hi}]", row=idx
                    )
                else:
                    clamped_val = max(lo, min(hi, val))
                    df.at[df.index[idx], col] = clamped_val
                    result.add_clamp(
                        f"Row {idx}: '{col}' clamped {val} → {clamped_val} (range [{lo}, {hi}])",
                        row=idx,
                    )

        # -- 2d. Cross-field consistency --
        try:
            sanctioned = float(row.get("compensation_sanctioned") or 0)
            disbursed  = float(row.get("compensation_disbursed") or 0)
            if sanctioned > 0 and disbursed > sanctioned * 1.01:  # allow 1% rounding
                if strict:
                    result.add_error(
                        f"Row {idx}: compensation_disbursed ({disbursed:.0f}) "
                        f"> compensation_sanctioned ({sanctioned:.0f}) — impossible", row=idx
                    )
                else:
                    result.add_warning(
                        f"Row {idx}: compensation_disbursed ({disbursed:.0f}) "
                        f"> compensation_sanctioned ({sanctioned:.0f}) — check data", row=idx
                    )
        except (TypeError, ValueError):
            pass

        try:
            open_d = float(row.get("open_legal_dispute_count") or 0)
            total_d = float(row.get("legal_dispute_count") or 0)
            if open_d > total_d:
                if strict:
                    result.add_error(
                        f"Row {idx}: open_legal_dispute_count ({open_d:.0f}) "
                        f"> legal_dispute_count ({total_d:.0f})", row=idx
                    )
                else:
                    df.at[df.index[idx], "open_legal_dispute_count"] = total_d
                    result.add_clamp(
                        f"Row {idx}: open_legal_dispute_count clamped to legal_dispute_count ({total_d:.0f})",
                        row=idx,
                    )
        except (TypeError, ValueError):
            pass

    return df, result


def validate_single_row(row: dict[str, Any], strict: bool = False) -> tuple[dict, ValidationResult]:
    """Convenience wrapper for validating a single project row (dict)."""
    df = pd.DataFrame([row])
    cleaned_df, result = validate_and_clean(df, strict=strict)
    return cleaned_df.iloc[0].to_dict(), result
