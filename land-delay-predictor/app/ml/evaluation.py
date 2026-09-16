"""
Model evaluation, validation, and experiment tracking.

Provides:
1. Comprehensive metrics (precision, recall, F1, AUC-ROC, AUC-PR)
2. Confusion matrix analysis
3. Cross-validation
4. Baseline comparison
5. Experiment metadata logging saved with model version
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any

import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    auc,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import StratifiedKFold, cross_val_predict

from app.db.init_db import SessionLocal
from app.ml.features import build_feature_table  # one row per project (not snapshots)
from app.ml.model_store import load_model, save_model
from app.ml.train import train_classifier, train_delay_regressor, CATEGORICAL_COLS, DROP_COLS, MIN_TRAINING_SAMPLES


def _prep(df: pd.DataFrame) -> pd.DataFrame:
    """Coerce dtypes to what LightGBM requires."""
    df = df.copy()
    for col in df.columns:
        if col in CATEGORICAL_COLS:
            df[col] = df[col].astype("category")
        else:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def compute_metrics(y_true, y_pred, y_prob) -> dict[str, Any]:
    """Compute comprehensive classification metrics."""
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    fpr, tpr, _ = roc_curve(y_true, y_prob)
    roc_auc = roc_auc_score(y_true, y_prob)

    precision, recall, pr_thresholds = precision_recall_curve(y_true, y_prob)
    pr_auc = auc(recall, precision)

    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, zero_division=0)), 4),
        "auc_roc": round(float(roc_auc), 4),
        "auc_pr": round(float(pr_auc), 4),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        "threshold_analysis": {"threshold_05": round(float(((y_prob >= 0.5).astype(int) == y_true).mean()), 4)},
    }


def compare_baseline(labeled: pd.DataFrame) -> dict[str, Any]:
    """Compare model performance against baselines."""
    y = labeled["delayed_target"].astype(int).values
    majority = int(y.mean() >= 0.5)
    majority_acc = float((pd.Series([majority] * len(y)).values == y).mean())
    random_acc = float(y.mean())

    # current_stage may be a LifecycleStage enum or a plain string
    def _stage_str(v):
        return v.value if hasattr(v, "value") else str(v) if v is not None else ""
    heuristic_mask = (
        (labeled["delay_days"].fillna(0) > 0) |
        (labeled["current_stage"].apply(_stage_str) != "completed")
    )
    heuristic_acc = float((heuristic_mask.astype(int).values == y).mean())

    return {
        "majority_class": {"predicted": majority, "accuracy": round(majority_acc, 4)},
        "random": {"accuracy": round(random_acc, 4)},
        "heuristic": {"accuracy": round(heuristic_acc, 4)},
        "target_distribution": {
            "total": int(len(y)),
            "delayed": int(y.sum()),
            "not_delayed": int(len(y) - y.sum()),
            "delay_rate": round(float(y.mean()), 4),
        },
    }


def evaluate_with_cross_validation(X, y, random_state=42) -> dict[str, Any]:
    """Run stratified cross-validation and return OOF predictions + metrics."""
    skf = StratifiedKFold(n_splits=min(5, len(y)), shuffle=True, random_state=random_state)
    oof_preds = cross_val_predict(
        _build_lgbm_classifier(), X, y, cv=skf, method="predict_proba",
    )[:, 1]
    y_pred = (oof_preds >= 0.5).astype(int)
    return compute_metrics(y.values, y_pred, oof_preds)


def _build_lgbm_classifier():
    """Build a regularised LightGBM classifier matching production train.py config.

    Uses the same regularisation floor as train.py to avoid inflated CV scores
    that don't reflect real-world performance on new data.
    """
    import lightgbm as lgb
    from app.ml.train import (
        REG_MAX_DEPTH, REG_MIN_CHILD_SAMPLES,
        REG_ALPHA, REG_LAMBDA, REG_SUBSAMPLE, REG_COLSAMPLE,
    )
    return lgb.LGBMClassifier(
        n_estimators=200, learning_rate=0.05, num_leaves=20,
        max_depth=REG_MAX_DEPTH,
        min_child_samples=REG_MIN_CHILD_SAMPLES,
        reg_alpha=REG_ALPHA,
        reg_lambda=REG_LAMBDA,
        subsample=REG_SUBSAMPLE,
        colsample_bytree=REG_COLSAMPLE,
        objective="binary", random_state=42, verbose=-1,
    )


def run_full_evaluation() -> dict[str, Any]:
    """Run complete evaluation pipeline and save model with metadata.

    Uses build_feature_table (one row per canonical project) — NOT the snapshot
    table. Snapshot data has 2000+ rows (multiple snapshots per project) and
    causes Train AUC=1.0 because historical snapshot labels are trivially easy
    to predict from their own past features.
    """
    session = SessionLocal()
    try:
        df = build_feature_table(session)  # 1 row per project, current state
    finally:
        session.close()

    if df.empty:
        raise ValueError("No projects in canonical schema yet.")

    labeled = df[df["delayed_target"].notna()].copy()
    if len(labeled) < MIN_TRAINING_SAMPLES:
        raise ValueError(f"Only {len(labeled)} labeled projects; need at least {MIN_TRAINING_SAMPLES}.")

    feature_cols = [c for c in df.columns if c not in DROP_COLS]

    X = _prep(labeled[feature_cols].copy())
    y = labeled["delayed_target"].astype(int)

    baseline = compare_baseline(labeled)

    clf, clf_metrics = train_classifier(df)
    reg, reg_metrics = train_delay_regressor(df)

    try:
        cv_metrics = evaluate_with_cross_validation(X, y)
    except Exception as e:
        cv_metrics = {"error": str(e)}

    y_prob = clf.predict_proba(X)[:, 1]
    y_pred = (y_prob >= 0.5).astype(int)
    train_metrics = compute_metrics(y.values, y_pred, y_prob)

    version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Strip non-serializable LGBMRegressor objects before saving
    reg_p10 = reg_metrics.pop("interval_p10_model", None) if reg_metrics and not reg_metrics.get("skipped") else None
    reg_p90 = reg_metrics.pop("interval_p90_model", None) if reg_metrics and not reg_metrics.get("skipped") else None

    evaluation = {
        "baseline_comparison": baseline,
        "cross_validation": cv_metrics,
        "train_metrics": train_metrics,
        "n_labeled": len(labeled),
        "training_timestamp": datetime.utcnow().isoformat(),
        "regressor_metrics": reg_metrics,
    }

    # Extract adaptive thresholds from OOF CV output
    cv_info = clf_metrics.get("cross_validation", {})
    risk_threshold_low  = cv_info.get("risk_threshold_low", 40.0)
    risk_threshold_high = cv_info.get("risk_threshold_high", 70.0)

    save_model(
        version=version, classifier=clf, regressor=reg,
        feature_columns=feature_cols, categorical_columns=CATEGORICAL_COLS,
        evaluation=evaluation,
        risk_threshold_low=risk_threshold_low,
        risk_threshold_high=risk_threshold_high,
    )

    # Save interval regressors alongside main model
    import os, joblib
    run_dir = os.path.join("models", version)
    if reg_p10 is not None:
        joblib.dump(reg_p10, os.path.join(run_dir, "regressor_p10.joblib"))
    if reg_p90 is not None:
        joblib.dump(reg_p90, os.path.join(run_dir, "regressor_p90.joblib"))

    return {"version": version, "evaluation": evaluation}


def print_evaluation_report(metrics: dict[str, Any]) -> str:
    """Generate a human-readable evaluation report."""
    eval_data = metrics.get("evaluation", metrics)
    base = eval_data.get("baseline_comparison", {})
    lines = [
        "=" * 60,
        "MODEL EVALUATION REPORT",
        "=" * 60,
        f"Version: {metrics.get('version', 'N/A')}",
        f"Training timestamp: {eval_data.get('training_timestamp', 'N/A')}",
        f"Labeled projects: {eval_data.get('n_labeled', 'N/A')}",
        "",
        "--- BASELINE COMPARISON ---",
        f"Majority class accuracy: {base.get('majority_class', {}).get('accuracy', 'N/A')}",
        f"Random guess accuracy:    {base.get('random', {}).get('accuracy', 'N/A')}",
        f"Heuristic accuracy:       {base.get('heuristic', {}).get('accuracy', 'N/A')}",
        f"Target delay rate:        {base.get('target_distribution', {}).get('delay_rate', 'N/A')}",
        "",
    ]

    cv = eval_data.get("cross_validation", {})
    if "error" not in cv:
        lines += [
            "--- CROSS-VALIDATION ---",
            f"Accuracy:  {cv.get('accuracy', 'N/A'):.4f}",
            f"F1 Score:  {cv.get('f1_score', 'N/A'):.4f}",
            f"AUC-ROC:   {cv.get('auc_roc', 'N/A'):.4f}",
            f"AUC-PR:    {cv.get('auc_pr', 'N/A'):.4f}",
            "",
        ]
    else:
        lines.append(f"Cross-validation error: {cv['error']}")

    tm = eval_data.get("train_metrics", {})
    lines += [
        "--- TRAINING METRICS ---",
        f"Accuracy:  {tm.get('accuracy', 'N/A'):.4f}",
        f"Precision: {tm.get('precision', 'N/A'):.4f}",
        f"Recall:    {tm.get('recall', 'N/A'):.4f}",
        f"F1 Score:  {tm.get('f1_score', 'N/A'):.4f}",
        f"AUC-ROC:   {tm.get('auc_roc', 'N/A'):.4f}",
        f"AUC-PR:    {tm.get('auc_pr', 'N/A'):.4f}",
        f"Confusion Matrix: {tm.get('confusion_matrix', 'N/A')}",
        "=" * 60,
    ]
    return "\n".join(lines)
