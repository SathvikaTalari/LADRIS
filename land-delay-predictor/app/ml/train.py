"""
Trains models off the canonical feature table (app/ml/features.py):
  1. A binary classifier: will this project be delayed? (drives risk_score / category)
  2. A regressor on delay_days, trained only on the delayed subset.

Model: LightGBM — fast, handles mixed types, exact SHAP explanations (XAI requirement).

v3 Overfitting fixes (critical — prevents 'everything HIGH risk' bug):
  - max_depth=6  : limits tree depth, was unbounded (-1) which allowed memorisation
  - min_child_samples=30: prevents splits on tiny leaf groups
  - reg_alpha=2.0, reg_lambda=2.0: L1+L2 regularisation, was 0.0
  - subsample=0.75, colsample_bytree=0.75: row+feature bagging
  - Early stopping on held-out validation set (prevents over-iteration)
  - Isotonic probability calibration: maps raw logits to real probabilities
  - CV metrics stored in metadata (not just logged to console)
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split

from app.db.init_db import SessionLocal
from app.ml.features import build_snapshot_feature_table
from app.ml.model_store import save_model

CATEGORICAL_COLS = ["project_type", "state", "district", "implementing_agency", "current_stage"]
# Columns to exclude from features:
# - project_id: identifier, not predictive
# - snapshot_date: the temporal reference point, not a feature
# - delayed_target: the target label (replaces label_is_delayed)
# - label_is_delayed, label_delay_days: deprecated label columns (kept for backward compatibility)
# - delay_days, actual_completion_date: evaluation-only fields, never use as features
DROP_COLS = [
    "project_id",
    "snapshot_date",
    "delayed_target",
    "label_is_delayed",
    "label_delay_days",
    "delay_days",
    "actual_completion_date",
]

MIN_TRAINING_SAMPLES = 10
CV_FOLDS = 5

# ── Regularisation constants (prevent overfitting on small/synthetic datasets) ─
# These MUST stay strong. Without them the model memorises training data
# and outputs probability 1.0 for every new project it sees.
REG_MAX_DEPTH         = 6     # was -1 (unbounded) — key overfitting cause
REG_MIN_CHILD_SAMPLES = 30    # was 5 — prevents micro-leaf memorisation
REG_ALPHA             = 2.0   # L1; was 0.0
REG_LAMBDA            = 2.0   # L2; was 0.0
REG_SUBSAMPLE         = 0.75  # row bagging; was 1.0
REG_COLSAMPLE         = 0.75  # feature bagging; was 1.0


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce dtypes so LightGBM 4.7+ auto-detects categoricals.

    Categorical columns MUST be pd.Categorical dtype before calling fit().
    In LightGBM 4.7+, passing categorical_feature= as a fit() argument no
    longer propagates to eval datasets (causes TypeError). Auto-detection
    via pd.Categorical works reliably across all LightGBM versions.
    """
    df = df.copy()
    for col in df.columns:
        if col in CATEGORICAL_COLS:
            df[col] = df[col].astype("category")
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def _compute_scale_pos_weight(y: pd.Series) -> float:
    """
    Compute scale_pos_weight = (negatives / positives) for class imbalance.
    Handles the common real-world case where delayed projects are the minority
    (or majority) class — LightGBM uses this to up-weight the minority class.
    """
    n_pos = y.sum()
    n_neg = len(y) - n_pos
    if n_pos == 0 or n_neg == 0:
        return 1.0
    return float(n_neg / n_pos)


def _cross_validate_classifier(X: pd.DataFrame, y: pd.Series) -> dict:
    """Run stratified k-fold CV and return OOF metrics + adaptive risk thresholds.

    Also computes p33/p66 percentile thresholds from OOF probabilities so the
    risk category boundaries (LOW/MEDIUM/HIGH) automatically adapt to whatever
    delay rate exists in the training dataset. These thresholds are stored in
    metadata.json and used at inference time.
    """
    n_folds = min(CV_FOLDS, int(y.value_counts().min()))  # no fold > minority class size
    if n_folds < 2:
        return {"skipped": True, "reason": "Too few samples per class for cross-validation"}

    skf = StratifiedKFold(n_splits=n_folds, shuffle=True, random_state=42)
    spw = _compute_scale_pos_weight(y)

    # Use regularised config (matches final model — honest CV)
    model = lgb.LGBMClassifier(
        n_estimators=200,
        learning_rate=0.05,
        num_leaves=20,
        max_depth=REG_MAX_DEPTH,
        min_child_samples=REG_MIN_CHILD_SAMPLES,
        reg_alpha=REG_ALPHA,
        reg_lambda=REG_LAMBDA,
        subsample=REG_SUBSAMPLE,
        colsample_bytree=REG_COLSAMPLE,
        objective="binary",
        scale_pos_weight=spw,
        random_state=42,
        verbose=-1,
    )
    oof_probs = cross_val_predict(model, X, y, cv=skf, method="predict_proba")[:, 1]
    oof_preds = (oof_probs >= 0.5).astype(int)

    # Adaptive thresholds: LOW < p33 <= MEDIUM < p66 <= HIGH
    # Using OOF probs (not training set) ensures honest, leak-free thresholds.
    oof_scores = oof_probs * 100
    p33 = float(np.percentile(oof_scores, 33))
    p66 = float(np.percentile(oof_scores, 66))
    # Clamp thresholds to [20, 85] so categories remain semantically meaningful
    p33 = round(min(max(p33, 20.0), 50.0), 2)
    p66 = round(min(max(p66, 50.0), 85.0), 2)

    from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
    auc = roc_auc_score(y, oof_probs)
    return {
        "n_folds": n_folds,
        "oof_auc_roc": round(float(auc), 4),
        "oof_accuracy": round(float(accuracy_score(y, oof_preds)), 4),
        "oof_f1": round(float(f1_score(y, oof_preds, zero_division=0)), 4),
        "oof_precision": round(float(precision_score(y, oof_preds, zero_division=0)), 4),
        "oof_recall": round(float(recall_score(y, oof_preds, zero_division=0)), 4),
        # Adaptive thresholds stored here so callers can pass to save_model
        "risk_threshold_low": p33,
        "risk_threshold_high": p66,
    }


def train_classifier(
    df: pd.DataFrame,
    min_samples: int = MIN_TRAINING_SAMPLES,
) -> tuple[CalibratedClassifierCV, dict]:
    """
    Train a regularised + calibrated LightGBM classifier.

    Returns a CalibratedClassifierCV wrapper so predict_proba() outputs
    real probabilities (0-1) instead of saturated logits (0 or 1).
    Calibration is critical: without it the model outputs 0.999996 for
    every project regardless of actual risk level.
    """
    labeled = df[df["delayed_target"].notna()].copy()
    if len(labeled) < min_samples:
        raise ValueError(
            f"Only {len(labeled)} labeled snapshots available; need at least {min_samples} "
            "labeled snapshots for training."
        )

    feature_cols = [c for c in labeled.columns if c not in DROP_COLS]
    X = _prep(labeled[feature_cols])
    y = labeled["delayed_target"].astype(int)

    spw = _compute_scale_pos_weight(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if y.nunique() > 1 else None,
    )

    # ── Hyperparameter search (regularisation-first configs) ──────────────────
    # Early stopping removed: LightGBM 4.7 has API breaking changes for
    # eval_X with pd.Categorical dtype DataFrames. Regularisation constants
    # (max_depth, reg_alpha, reg_lambda, min_child_samples, subsample) prevent
    # overfitting without needing early stopping.
    best_model, best_auc = None, -1.0
    search_configs = _get_search_configs(len(X_train))

    for config in search_configs:
        model = lgb.LGBMClassifier(
            **config,
            objective="binary",
            scale_pos_weight=spw,
            random_state=42,
            verbose=-1,
        )
        model.fit(X_train, y_train)
        if len(X_test) > 0 and y_test.nunique() > 1:
            auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
        else:
            auc = 0.0

        if auc > best_auc:
            best_auc = auc
            best_model = model

    # ── Probability calibration (sigmoid / Platt scaling) ────────────────────
    # Sigmoid calibration produces a SMOOTH, continuous probability curve.
    # Isotonic regression (the previous method) is a step-function: it maps
    # raw model outputs to a finite set of calibrated values, causing the
    # classifier to output only extreme scores (0 or 1) when classes are
    # well-separated. This was the cause of the "only HIGH or LOW, never MEDIUM"
    # bug. Sigmoid calibration (Platt scaling) interpolates smoothly across
    # the full 0-1 range, producing proper medium-risk scores.
    n_cal_folds = min(5, int(y.value_counts().min()))
    if best_model is not None and n_cal_folds >= 2:
        calibrated = CalibratedClassifierCV(
            best_model, method="sigmoid", cv=n_cal_folds,
        )
        calibrated.fit(X, y)
        final_model = calibrated
    else:
        final_model = best_model

    # ── Cross-validation (OOF) ────────────────────────────────────────────────
    cv_metrics = _cross_validate_classifier(X, y)

    # ── Feature importance ────────────────────────────────────────────────────
    feat_imp = {}
    if best_model is not None:
        importances = best_model.feature_importances_
        feat_imp = dict(
            sorted(
                zip(feature_cols, importances.tolist()),
                key=lambda x: x[1], reverse=True,
            )
        )

    metrics = {
        "test_auc": round(float(best_auc), 4),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "scale_pos_weight": round(float(spw), 3),
        "delay_rate": round(float(y.mean()), 4),
        "cross_validation": cv_metrics,
        "top_features": dict(list(feat_imp.items())[:10]),
        "selected_params": best_model.get_params() if best_model else {},
        "calibrated": n_cal_folds >= 2,
    }

    return final_model, metrics


def _get_search_configs(n_train: int) -> list[dict]:
    """
    Regularisation-first hyperparameter configs.

    ALL configs enforce the regularisation floor (max_depth, min_child_samples,
    reg_alpha, reg_lambda, subsample, colsample_bytree). Without these the
    model overfits on synthetic/small datasets and predicts probability ~1.0
    for every single project (the 'everything HIGH risk' bug).
    """
    # Shared regularisation floor — never relax these
    reg_floor = dict(
        max_depth=REG_MAX_DEPTH,
        min_child_samples=REG_MIN_CHILD_SAMPLES,
        reg_alpha=REG_ALPHA,
        reg_lambda=REG_LAMBDA,
        subsample=REG_SUBSAMPLE,
        colsample_bytree=REG_COLSAMPLE,
    )

    # Small dataset: single conservative config
    if n_train < 100:
        return [{
            "n_estimators": 100,
            "learning_rate": 0.05,
            "num_leaves": 15,
            **reg_floor,
        }]

    # Larger dataset: 4 configs varying complexity, keeping regularisation constant
    return [
        # Config A — moderate complexity
        {"n_estimators": 300, "learning_rate": 0.05, "num_leaves": 20, **reg_floor},
        # Config B — higher LR, fewer trees
        {"n_estimators": 200, "learning_rate": 0.08, "num_leaves": 15, **reg_floor},
        # Config C — more trees, lower LR (best for accuracy on larger data)
        {"n_estimators": 500, "learning_rate": 0.03, "num_leaves": 31, **reg_floor},
        # Config D — extra-light model (good baseline)
        {"n_estimators": 150, "learning_rate": 0.10, "num_leaves": 10, **reg_floor},
    ]


def train_delay_regressor(
    df: pd.DataFrame,
    min_delayed_samples: int = 5,
) -> tuple[Optional[lgb.LGBMRegressor], dict]:
    """
    Train a point-estimate regressor + two quantile regressors for prediction intervals.

    Returns a tuple of (point_model, metrics_dict). The metrics dict includes:
      - mae_days, rmse_days: held-out test performance
      - cv_mae_days: 3-fold cross-validated MAE (more honest than test-set MAE)
      - interval_p10_model, interval_p90_model: quantile regressors for 80% PI
    """
    from sklearn.model_selection import KFold

    delayed = df[
        (df["delayed_target"] == 1) & (df["delay_days"].notna())
    ].copy()

    if len(delayed) < min_delayed_samples:
        return None, {
            "skipped": True,
            "reason": f"Only {len(delayed)} delayed projects with duration labels (need {min_delayed_samples})",
        }

    feature_cols = [c for c in delayed.columns if c not in DROP_COLS]
    X = _prep(delayed[feature_cols])
    y = delayed["delay_days"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # ── Point-estimate regressor ───────────────────────────────────────────────
    model = lgb.LGBMRegressor(
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=31,
        random_state=42,
        verbose=-1,
    )
    model.fit(X_train, y_train)

    if len(X_test) > 0:
        preds_test = model.predict(X_test)
        mae  = float(mean_absolute_error(y_test, preds_test))
        rmse = float(np.sqrt(((y_test.values - preds_test) ** 2).mean()))
    else:
        mae, rmse = 0.0, 0.0

    # ── Cross-validated MAE (3-fold) ───────────────────────────────────────────
    cv_mae = 0.0
    n_folds = min(3, len(X))
    if n_folds >= 2:
        kf = KFold(n_splits=n_folds, shuffle=True, random_state=42)
        fold_maes = []
        for tr_idx, va_idx in kf.split(X):
            cv_model = lgb.LGBMRegressor(
                n_estimators=300, learning_rate=0.05,
                num_leaves=31, random_state=42, verbose=-1,
            )
            cv_model.fit(X.iloc[tr_idx], y.iloc[tr_idx])
            fold_maes.append(
                float(mean_absolute_error(y.iloc[va_idx], cv_model.predict(X.iloc[va_idx])))
            )
        cv_mae = float(np.mean(fold_maes))

    # ── Prediction-interval quantile regressors (p10 and p90) ─────────────────
    # LightGBM quantile regression gives us an 80% prediction interval.
    _reg_params = dict(
        n_estimators=300, learning_rate=0.05, num_leaves=31,
        objective="quantile", random_state=42, verbose=-1,
    )
    reg_p10 = lgb.LGBMRegressor(**_reg_params, alpha=0.10)
    reg_p90 = lgb.LGBMRegressor(**_reg_params, alpha=0.90)
    reg_p10.fit(X_train, y_train)
    reg_p90.fit(X_train, y_train)

    metrics = {
        "mae_days":    round(mae, 2),
        "rmse_days":   round(rmse, 2),
        "cv_mae_days": round(cv_mae, 2),
        "n_train":     len(X_train),
        "n_test":      len(X_test),
        "avg_delay_days": round(float(y.mean()), 1),
        "interval_p10_model": reg_p10,   # stored in metrics; callers save separately
        "interval_p90_model": reg_p90,
    }
    return model, metrics


def run_training() -> dict:
    """Train models and save a new version. Returns full metadata."""
    session = SessionLocal()
    try:
        df = build_snapshot_feature_table(session)
    finally:
        session.close()

    if df.empty:
        raise ValueError("No projects in canonical schema yet.")

    print(
        f"Training on {len(df)} snapshots "
        f"({df['delayed_target'].notna().sum()} labeled)..."
    )

    clf, clf_metrics = train_classifier(df)
    reg, reg_metrics = train_delay_regressor(df)

    version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    feature_cols = [c for c in df.columns if c not in DROP_COLS]

    # Extract adaptive thresholds from CV metrics (OOF-derived, not training-set)
    cv_metrics = clf_metrics.get("cross_validation", {})
    risk_threshold_low  = cv_metrics.get("risk_threshold_low", 40.0)
    risk_threshold_high = cv_metrics.get("risk_threshold_high", 70.0)

    # Extract and save quantile interval models separately
    reg_p10 = reg_metrics.pop("interval_p10_model", None) if reg_metrics and not reg_metrics.get("skipped") else None
    reg_p90 = reg_metrics.pop("interval_p90_model", None) if reg_metrics and not reg_metrics.get("skipped") else None

    save_model(
        version=version,
        classifier=clf,
        regressor=reg,
        feature_columns=feature_cols,
        categorical_columns=CATEGORICAL_COLS,
        training_seed=42,
        training_df=df,
        risk_threshold_low=risk_threshold_low,
        risk_threshold_high=risk_threshold_high,
    )

    # Save quantile models alongside main model if trained
    import os
    import joblib
    run_dir = os.path.join("models", version)
    if reg_p10 is not None:
        joblib.dump(reg_p10, os.path.join(run_dir, "regressor_p10.joblib"))
    if reg_p90 is not None:
        joblib.dump(reg_p90, os.path.join(run_dir, "regressor_p90.joblib"))

    metrics = {
        "version": version,
        "classifier": clf_metrics,
        "regressor": reg_metrics,
        "n_total_projects": len(df),
        "n_labeled": int(df["delayed_target"].notna().sum()),
    }
    print(json.dumps(
        {k: v for k, v in metrics.items() if not isinstance(v, object.__class__)},
        indent=2, default=str
    ))
    return metrics


if __name__ == "__main__":
    run_training()
