# Production ML integration

LADRIS now calls the existing `land-delay-predictor` production bundle through
`app/ml/inference.py`. Prediction requests never train, replace, or promote a
model. The bundle referenced by `models/latest.txt` is loaded once per FastAPI
process, and its metadata controls column order, categorical columns, and risk
thresholds.

## Data flow

`projects` + `project_stages` → point-in-time feature mapping → ML validator →
calibrated LightGBM classifier and delay regressors → SHAP → `ml_predictions` →
FastAPI → React.

Outcome fields (`actual_end_date`, `delay_months`, and future statuses) are not
included in the prediction feature snapshot. Actual completion is read only for
historical district/agency outcomes that were already known before the requested
snapshot date.

## Feature mapping

| ML field | Application source / calculation |
|---|---|
| `project_type` | `projects.project_type` through the explicit ML category map |
| `state` | `state_code` through the state-name map used by training data |
| `district` | first `district_codes` value |
| `implementing_agency` | `executing_agency`, falling back to `nodal_agency` |
| `land_area_hectares` | `total_area_ha` |
| `affected_families_count` | `total_affected_families` |
| `days_since_notification` | snapshot date − `notification_3a_date` (or planned start) |
| `days_to_expected_completion` | `planned_end_date` − snapshot date |
| compensation amounts | estimated/sanctioned and disbursed project amounts |
| `compensation_disbursement_pct` | disbursed ÷ sanctioned × 100 |
| legal counts | `legal_case_count` and `legal_case_status` |
| `rehabilitation_progress_pct` | rehabilitated ÷ affected families × 100 |
| stage fields | non-pending `project_stages`, mapped to the trained 8-stage vocabulary |
| historical rates | completed-before-snapshot outcomes grouped by district/agency |

When present, `compensation_records`, `legal_cases`, `rr_records`, and
`stakeholder_updates` are reduced at the requested snapshot date by the centralized
feature service. This supplies dated disbursement, dispute pendency, R&R readiness,
and stakeholder cadence features using the same definitions as training. If a
project has no such source rows, the trained pipeline's supported missing values are
used and the affected fields are returned in `unavailable_features`; they are never
fabricated.

## API

- `POST /api/ml/predict/{project_id}` creates a persisted snapshot. Optional query parameter: `snapshot_date`.
- `GET /api/ml/prediction/{project_id}` returns the latest snapshot.
- `GET /api/ml/explanation/{project_id}` returns actual SHAP drivers and recommendations.
- `GET /api/ml/stages/{project_id}` returns stage-wise predictions from the production classifier.
- `GET /api/ml/high-risk` returns projects whose latest model category is `HIGH`.
- `GET /api/ml/model-info` returns active metadata and approved evaluation metrics.
- `GET /api/ml/monitoring` reports live score/completeness monitoring and explicitly
  marks feature/performance drift unavailable until training distributions and outcomes exist.
- `GET /api/ml/retraining-status` reports leakage-safe retraining eligibility; prediction
  requests never retrain or promote a model.
- `/api/v1/intelligence/*` ranks, compares, and maps projects from persisted production
  predictions. It does not maintain a second risk formula.
- `/api/v1/interventions/{project_id}/simulate` runs a read-only production-model
  counterfactual and records a clearly labelled scenario audit row.

All endpoints require the existing bearer-token authentication.

## Run

```powershell
Copy-Item .env.example .env
docker compose up --build
```

For an existing database, apply the migration before startup if automatic
SQLAlchemy table creation is disabled:

```powershell
psql $env:SYNC_DATABASE_URL -f database/migrations/007_ml_predictions.sql
psql $env:SYNC_DATABASE_URL -f database/migrations/008_project_data_integrity.sql
psql $env:SYNC_DATABASE_URL -f database/migrations/009_ml_source_events.sql
psql $env:SYNC_DATABASE_URL -f database/migrations/010_remove_legacy_demo_alerts.sql
```

Run integration tests:

```powershell
$env:PYTHONPATH="$(Resolve-Path backend);$(Resolve-Path land-delay-predictor/app)"
Set-Location backend
venv/Scripts/python.exe -m pytest -q
Set-Location ..\frontend
npm run build
```

## Current evidence limitations

- The active bundle has no standalone per-stage artifact. Stage values therefore use
  the production overall model with only `current_stage` changed, and every response
  identifies the method as `overall_model_stage_counterfactual`.
- The raw CSV does not contain exact latitude/longitude, event-level source records,
  or completed outcome labels. Those values can be supplied by the database event
  tables, but remain unavailable for the imported CSV rows until real records arrive;
  the application does not substitute state centroids, offsets, or made-up values.
- Controlled retraining remains ineligible until at least 50 leakage-safe completed
  outcomes exist and the existing quality gate approves a candidate.
