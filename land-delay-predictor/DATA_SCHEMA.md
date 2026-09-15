# Data Schema for Real Historical Land Acquisition Data

## Minimum Required Fields

Every source must provide these 5 fields:

| Canonical Field | Type | Description |
|---|---|---|
| `external_project_id` | string | Unique project ID from source system |
| `project_name` | string | Project name |
| `project_type` | string | e.g., highway, railway, irrigation, industrial |
| `state` | string | State name |
| `district` | string | District name |

## Recommended Fields for High-Quality Predictions

| Category | Fields |
|---|---|
| Identity | project_type, implementing_agency, state, district |
| Timelines | notification_date, expected_completion_date, actual_completion_date, current_stage |
| Labels | is_delayed, delay_days |
| Compensation | compensation_sanctioned, compensation_disbursed, sanction_date, last_disbursement_date |
| Legal | legal_dispute_count, dispute_type, dispute_filed_date, dispute_resolved_date, court_level |
| Rehabilitation | rehabilitation_progress_pct, resettlement_site_ready, families_to_resettle, families_resettled |
| Stakeholders | stakeholder_update_date, update_type, stakeholder_role |
| GIS | latitude, longitude, geom (WKT) |

## Label Requirements

For model training, you need historical projects with known outcomes:

- `is_delayed`: boolean (`true`/`false`, `Y`/`N`, `1`/`0`)
- `delay_days`: integer number of days delayed (0 for on-time projects)

If your source doesn't have labels, you can derive them:

```python
is_delayed = actual_completion_date > expected_completion_date
delay_days = (actual_completion_date - expected_completion_date).days
```

## Stage Values

Use one of these lifecycle stages:

- `notification`
- `survey`
- `approval`
- `compensation`
- `legal_resolution`
- `rehabilitation`
- `possession`
- `completed`

## Date Formats

Accepted formats:

- `YYYY-MM-DD`
- `DD-MM-YYYY`
- ISO 8601

## Example CSV Header

```csv
Project ID,Project Name,Project Type,Implementing Agency,State,District,Land Area (ha),Affected Families,Notification Date,Expected Completion,Actual Completion,Current Stage,Delayed (Y/N),Delay (days),Compensation Sanctioned,Compensation Disbursed,Open Disputes,R&R Progress %
```

## How to Map Your Data

1. Create a copy of the template YAML under `config/sources/`
2. Map your source column names to canonical field names
3. Upload or connect your data
4. Run ETL
5. Train the model

## GIS Fields

If you have coordinates, include:

- `latitude` (decimal degrees)
- `longitude` (decimal degrees)
- or `geom` (WKT/WKB)

If you only have district/state names, we can geocode them later.
