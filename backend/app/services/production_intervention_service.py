"""Decision-support views and counterfactuals backed by the production ML bundle."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from app.models.ml_models import InterventionScenario
from app.services.ml_feature_service import build_features, load_project_context
from app.services.production_ml_service import _runtime, latest_prediction

SIMULATABLE_FIELDS = {
    "compensation_disbursed": {"minimum": 0.0, "label": "Compensation disbursed"},
    "rehabilitation_progress_pct": {"minimum": 0.0, "maximum": 100.0, "label": "Rehabilitation progress (%)"},
    "legal_dispute_count": {"minimum": 0.0, "integer": True, "label": "Total legal disputes"},
    "open_legal_dispute_count": {"minimum": 0.0, "integer": True, "label": "Open legal disputes"},
    "stakeholder_update_count_90d": {"minimum": 0.0, "integer": True, "label": "Stakeholder updates (90 days)"},
}


def _completeness(features: dict[str, Any]) -> float:
    return round(sum(value is not None for value in features.values()) / len(features) * 100, 1)


async def _features(db, project) -> dict[str, Any]:
    loaded, population = await load_project_context(db, project.id)
    features, _ = build_features(loaded, population, datetime.now(timezone.utc))
    return features


def eligible_fields(features: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for field, rules in SIMULATABLE_FIELDS.items():
        maximum = rules.get("maximum")
        if field == "compensation_disbursed":
            maximum = features.get("compensation_sanctioned")
        if field == "open_legal_dispute_count":
            maximum = features.get("legal_dispute_count")
        result.append({
            "field": field,
            "label": rules["label"],
            "current_value": features.get(field),
            "minimum": rules["minimum"],
            "maximum": maximum,
            "integer": rules.get("integer", False),
            "available": maximum is not None or field != "compensation_disbursed",
            "source": "production_model_feature_snapshot",
        })
    return result


def _validate_and_apply(features: dict[str, Any], inputs: dict[str, float]) -> dict[str, Any]:
    unknown = sorted(set(inputs) - set(SIMULATABLE_FIELDS))
    if unknown:
        raise ValueError(f"Non-simulatable fields: {', '.join(unknown)}")
    scenario = dict(features)
    for field, raw_value in inputs.items():
        value = float(raw_value)
        rules = SIMULATABLE_FIELDS[field]
        maximum = rules.get("maximum")
        if field == "compensation_disbursed":
            maximum = scenario.get("compensation_sanctioned")
            if maximum is None:
                raise ValueError("compensation_sanctioned is unavailable")
        if field == "open_legal_dispute_count":
            maximum = scenario.get("legal_dispute_count")
        if value < rules["minimum"] or (maximum is not None and value > maximum):
            raise ValueError(f"{field} must be between {rules['minimum']} and {maximum}")
        scenario[field] = int(value) if rules.get("integer") else value
    if scenario.get("compensation_sanctioned") not in (None, 0):
        scenario["compensation_disbursement_pct"] = (
            scenario.get("compensation_disbursed", 0) / scenario["compensation_sanctioned"] * 100
        )
    return scenario


async def get_interventions_for_project(project, db) -> dict[str, Any]:
    row = await latest_prediction(db, project.id)
    if row is None:
        return {"project_id": str(project.id), "status": "UNAVAILABLE", "candidate_interventions": [], "message": "No stored production ML prediction"}
    positive = [driver for driver in (row.top_drivers or []) if driver.get("contribution", 0) > 0]
    candidates = []
    for index, recommendation in enumerate(row.recommendations or []):
        driver = positive[index] if index < len(positive) else None
        candidates.append({
            "intervention_id": f"MODEL-{index + 1}",
            "category": "MODEL_RECOMMENDATION",
            "stage": (row.feature_snapshot or {}).get("current_stage"),
            "display_name": recommendation,
            "action_description": recommendation,
            "priority_score": round(row.risk_score, 2),
            "priority_label": f"{row.risk_category} ML RISK",
            "confidence": "MODEL_OUTPUT",
            "evidence": "SHAP contribution from the active calibrated LightGBM classifier",
            "provenance": row.model_version,
            "non_causal_note": "Recommendation is mapped to a model driver and is not a causal guarantee.",
            "model_supported_contributors": [driver] if driver else [],
            "score_components": {},
        })
    return {
        "project_id": str(project.id), "status": "AVAILABLE",
        "candidate_interventions": candidates, "top_intervention": candidates[0] if candidates else None,
        "model_version": row.model_version, "risk_score": row.risk_score,
        "data_completeness_pct": _completeness(row.feature_snapshot or {}),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_intervention_priority(project, db) -> dict[str, Any]:
    result = await get_interventions_for_project(project, db)
    items = result.get("candidate_interventions", [])
    return {
        **result, "ranked_interventions": items, "top_priority": items[0] if items else None,
        "priority_score": result.get("risk_score"), "priority_label": items[0]["priority_label"] if items else "UNAVAILABLE",
        "top_intervention": items[0] if items else None,
        "priority_score_label": "Production ML Risk Score",
        "scoring_methodology": "Uses the persisted calibrated LightGBM risk score; no separate priority formula.",
        "weights": {"production_ml_risk_score": 1.0},
    }


async def simulate_scenario(project, scenario_name: str, inputs: dict[str, float], db, user_id: str | None = None) -> dict[str, Any]:
    base_features = await _features(db, project)
    scenario_features = _validate_and_apply(base_features, inputs)
    runtime = _runtime()
    baseline, scenario, stages = await asyncio.gather(
        asyncio.to_thread(runtime.predict_features, base_features),
        asyncio.to_thread(runtime.predict_features, scenario_features),
        asyncio.to_thread(runtime.predict_stages, scenario_features),
    )
    result = {
        "status": "AVAILABLE", "scenario_name": scenario_name,
        "scenario_method": "Production model counterfactual",
        "disclaimer": "Scenario estimate only; it is not a causal prediction and does not modify project data.",
        "validation_warnings": [],
        "changed_inputs": [{"field": key, "from": base_features.get(key), "to": value} for key, value in inputs.items()],
        "baseline_signals": baseline,
        "scenario_signals": {**scenario, "stage_predictions": stages},
        "delta": {
            "risk_score": round(scenario["risk_score"] - baseline["risk_score"], 4),
            "delay_probability": round(scenario["delay_probability"] - baseline["delay_probability"], 6),
            "predicted_delay_days": (
                round(scenario["predicted_delay_days"] - baseline["predicted_delay_days"], 4)
                if scenario["predicted_delay_days"] is not None and baseline["predicted_delay_days"] is not None else None
            ),
        },
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "model_version": scenario["model_version"],
    }
    audit = InterventionScenario(
        id=uuid4(), project_id=project.id, scenario_name=scenario_name,
        scenario_inputs=inputs, baseline_signals=baseline,
        scenario_signals=result["scenario_signals"], delta_signals=result["delta"],
        model_version=scenario["model_version"], data_version="point_in_time_project_snapshot",
        created_by=UUID(user_id) if user_id else None,
        record_type="SCENARIO — NOT ACTUAL GOVERNMENT ACTION",
    )
    db.add(audit)
    await db.flush()
    return {"project_id": str(project.id), "scenario_result": result, "eligible_fields": eligible_fields(base_features), "audit_id": str(audit.id), "scenario_estimate_notice": result["disclaimer"]}


async def compare_scenarios(project, scenario_list: list[dict[str, Any]], db, user_id: str | None = None) -> dict[str, Any]:
    results = []
    for item in scenario_list:
        results.append(await simulate_scenario(project, item["name"], item["inputs"], db, user_id))
    ranked = sorted(results, key=lambda item: item["scenario_result"]["delta"]["risk_score"])
    return {
        "project_id": str(project.id), "status": "AVAILABLE", "total_scenarios": len(results),
        "scenarios": [item["scenario_result"] for item in results],
        "best_scenario": ranked[0]["scenario_result"]["scenario_name"] if ranked else None,
        "best_scenario_note": "Lowest production-model counterfactual risk score; not a causal guarantee.",
        "computed_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_intervention_evidence(project, db) -> dict[str, Any]:
    result = await get_interventions_for_project(project, db)
    records = [{
        "intervention_id": item["intervention_id"], "category": item["category"],
        "stage": item["stage"], "evidence": item["evidence"], "provenance": item["provenance"],
        "confidence": item["confidence"], "applicable_risk_factors": item["model_supported_contributors"],
        "non_causal_note": item["non_causal_note"],
    } for item in result.get("candidate_interventions", [])]
    return {"project_id": str(project.id), "recommendations_count": len(records), "evidence_records": records, "model_version": result.get("model_version")}


def get_intervention_catalog() -> dict[str, Any]:
    return {
        "catalog_version": "production-model-policy",
        "framework": "Recommendations are generated dynamically from positive SHAP drivers.",
        "total_interventions": 0,
        "interventions": [],
        "non_causal_statement": "No static intervention is presented without a project model explanation.",
    }
