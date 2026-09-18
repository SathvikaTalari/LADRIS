# API Startup & Dashboard Access Guide

> **⚠️ IMPORTANT NOTE FOR LADRIS DEVELOPERS**:
> In the main LADRIS integrated repository, you **DO NOT need to follow this guide or start a separate API server on port 8000**.
> The ML model is embedded directly in-process within the main FastAPI backend (`backend/app/services/production_ml_service.py`).
> To run the application, simply follow the main root instructions (`.\setup_team.ps1` or `python doctor.py`).
> This guide is retained only as legacy documentation for standalone testing.

## Prerequisites

1. **PostgreSQL with PostGIS**
   ```bash
   # Docker (recommended)
   docker run -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=land_delay -p 5432:5432 -d postgis/postgis:15-3.3
   
   # Or install locally
   # Ubuntu: apt-get install postgresql postgis
   # Windows: Use PostgreSQL installer + StackBuilder for PostGIS
   ```

2. **Environment Variables**
   Create `.env` file in project root:
   ```bash
   DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5432/land_delay
   # Optional: notification configs
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=your_app_password
   SMTP_FROM=alerts@land-delay.in
   TWILIO_ACCOUNT_SID=your_sid
   TWILIO_AUTH_TOKEN=your_token
   TWILIO_FROM=+1234567890
   ADMIN_PHONE=+19876543210
   ADMIN_EMAIL=admin@your-agency.gov.in
   ENABLE_EMAIL=true
   ENABLE_SMS=true
   ENABLE_PUSH=false
   ```

## Startup Steps

### 1. Initialize Database
```bash
python -m app.db.init_db
```
Output: `Tables created against postgresql+psycopg2://...`

### 2. Add Your Real Data Source
1. Copy appropriate template:
   ```bash
   cp config/sources/REST_API_TEMPLATE.yaml config/sources/your_source.yaml
   # or DATABASE_TEMPLATE.yaml, CSV_TEMPLATE.yaml, WEBHOOK_TEMPLATE.yaml
   ```
2. Edit the YAML file with your credentials and field mapping
3. (Optional) Set as active:
   ```sql
   UPDATE ingestion_sources SET is_active = true WHERE name = 'your_source';
   ```

### 3. Ingest Real Data
```bash
# For CSV/XLSX:
curl -X POST "http://localhost:8000/ingest/file?source_name=your_source" \
     -F "file=@/path/to/your_data.csv"

# For REST/DB:
curl -X POST "http://localhost:8000/ingestion/pull/your_source"
```

### 4. Run ETL
```bash
curl -X POST "http://localhost:8000/etl/run"
```

### 5. Train Model
```bash
curl -X POST "http://localhost:8000/model/train"
```
Output: `{ "version": "20260912_XXXXX", ... }`

### 6. Generate Predictions
```bash
curl -X POST "http://localhost:8000/model/predict"
```
Output: `{ "scored_projects": 25 }`

### 7. Evaluate Model
```bash
curl -X POST "http://localhost:8000/model/evaluate"
```
Returns detailed metrics report.

## Access API

- **Interactive Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Dashboard Endpoints

Access these from Power BI, Superset, Grafana, or custom frontend:

1. **Summary Dashboard**: `GET /dashboard/summary`
   ```json
   {
     "total_projects": 150,
     "high_risk_count": 23,
     "medium_risk_count": 45,
     "low_risk_count": 82,
     "avg_risk_score": 42.3,
     "risk_distribution": {"high": 23, "medium": 45, "low": 82},
     "state_trends": {...},
     "district_trends": {...}
   }
   ```

2. **GIS Projects**: `GET /dashboard/gis-projects`
   Returns array of projects with geometry for mapping.

3. **Trends**: `GET /dashboard/trends`
   District-wise and state-wise delay rates.

4. **Alerts**: `GET /alerts/summary`
   Alert counts by severity.

5. **Stage Risks**: `GET /stage-risks`
   Per-project per-stage risk scores.

6. **Project Details**: `GET /projects/{project_id}/risk`

7. **Model Status**: `GET /model/status` (retrain needed?)

## Integration Examples

### Power BI
- Use Web connector → `http://localhost:8000/dashboard/summary`
- For GIS: Use `dashboard/gis-projects` with Power BI Maps visual

### Superset
- Add PostgreSQL database (same DB as app)
- Create charts using tables: projects, risk_scores
- Or use REST API connector plugin

### Grafana
- Add JSON datasource pointing to `/dashboard/*` endpoints
- Use SimpleJSON plugin or Grafana 9+ built-in JSON support

## Testing with Sample Data (Optional)
```bash
# Ingest sample data
curl -X POST "http://localhost:8000/ingest/file?source_name=district_admin_monthly_export" \
     -F "file=@data/sample_seed/sample_projects.csv"
curl -X POST "http://localhost:8000/etl/run"
curl -X POST "http://localhost:8000/model/train"
curl -X POST "http://localhost:8000/model/predict"
```