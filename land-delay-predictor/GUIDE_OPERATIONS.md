# Ingestion, Training & Retraining Operations Guide

## 1. Onboarding a New Data Source

### Step 1: Create Config
```bash
cp config/sources/REST_API_TEMPLATE.yaml config/sources/your_source.yaml
```

### Step 2: Edit Config
Fill in:
- `source_name`
- `base_url` or `connection_string`
- `auth`
- `field_mapping`

### Step 3: Register Source
```bash
curl -X POST "http://localhost:8000/ingestion/pull/your_source"
```
Or manually create:
```sql
INSERT INTO ingestion_sources (id, name, connector_type, config_path, is_active)
VALUES ('your-source-id', 'your_source', 'rest_api', 'config/sources/your_source.yaml', true);
```

### Step 4: Run Ingestion
```bash
curl -X POST "http://localhost:8000/ingestion/pull/your_source"
```

### Step 5: Run ETL
```bash
curl -X POST "http://localhost:8000/etl/run"
```

### Step 6: Verify
```sql
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM risk_scores;
```

## 2. Scheduled Ingestion

The scheduler (`app/ingestion/scheduler.py`) reads `schedule_interval_minutes` from each YAML config.

### Start Scheduler
```bash
python -m app.ingestion.scheduler
```

### Example Config
```yaml
schedule_interval_minutes: 1440  # daily
```

### For File Sources
```yaml
watch_glob: "data/incoming/district_admin/*.xlsx"
```

## 3. Training Pipeline

### Manual Training
```bash
curl -X POST "http://localhost:8000/model/train"
```

### Full Evaluation
```bash
curl -X POST "http://localhost:8000/model/evaluate"
```

### Prediction
```bash
curl -X POST "http://localhost:8000/model/predict"
```

## 4. Continuous Learning

The system automatically decides when to retrain based on:

| Signal | Threshold |
|---|---|
| New projects since last training | >= 5 |
| Model age | >= 30 days |
| Prediction drift | > 5% change |

### Check Status
```bash
curl -s "http://localhost:8000/model/status"
```

### Trigger Retraining
```bash
curl -X POST "http://localhost:8000/model/retrain"
```

### View Training History
```bash
curl -s "http://localhost:8000/model/versions"
```

## 5. Model Versioning

Each training run creates:
```
models/<version>/
├── classifier.joblib
├── regressor.joblib   (optional)
└── metadata.json
```

### Metadata Includes
- Feature columns
- Categorical columns
- Training timestamp
- Evaluation metrics
- Regressor availability

## 6. Alerting Workflow

### Generate Alerts
```bash
curl -s "http://localhost:8000/alerts/summary"
curl -s "http://localhost:8000/alerts/all"
```

### Custom Threshold
```bash
curl -s "http://localhost:8000/alerts/threshold/60"
```

## 7. Recommended Production Workflow

### Daily
1. Ingest new data
2. Run ETL
3. Score all projects
4. Generate alerts

### Weekly
1. Review drift metrics
2. Check model performance
3. Monitor high-risk projects

### Monthly
1. Full evaluation
2. Compare against baselines
3. Retrain if needed

## 8. Commands Reference

```bash
# Initialize DB
python -m app.db.init_db

# Start API
uvicorn app.api.main:app --reload

# Start scheduler
python -m app.ingestion.scheduler

# Ingest file
curl -X POST "http://localhost:8000/ingest/file?source_name=your_source" -F "file=@data.csv"

# Pull REST/DB
curl -X POST "http://localhost:8000/ingestion/pull/your_source"

# Run ETL
curl -X POST "http://localhost:8000/etl/run"

# Train
curl -X POST "http://localhost:8000/model/train"

# Predict
curl -X POST "http://localhost:8000/model/predict"

# Evaluate
curl -X POST "http://localhost:8000/model/evaluate"

# Retrain
curl -X POST "http://localhost:8000/model/retrain"
```

## 9. Monitoring Checklist

- [ ] Ingestion logs successful
- [ ] ETL promoted records
- [ ] No rejected records
- [ ] Model trained with sufficient labeled data
- [ ] AUC/F1 metrics acceptable
- [ ] Predictions generated
- [ ] Alerts dispatched
- [ ] Drift within threshold
- [ ] Model version history maintained
