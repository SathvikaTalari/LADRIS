# Sample seed data

`sample_projects.csv` in this folder is a small, hand-constructed set of rows
matching the `district_admin_monthly_export` field mapping
(`config/sources/example_csv_export.yaml`). It exists **only** to smoke-test
the ingestion → ETL → feature engineering → training pipeline end-to-end
before any real source is connected.

**This is not real project data.** Do not use it to draw conclusions, and
replace it with actual ingested records (via any of the six connectors)
before training a model you intend to rely on. It's small (20 rows) and
intentionally will not train an accurate model — its only job is to prove
the pipeline runs without errors from file upload through to a saved model.

To use it:
```bash
curl -X POST "http://localhost:8000/ingest/file?source_name=district_admin_monthly_export" \
     -F "file=@data/sample_seed/sample_projects.csv"
curl -X POST "http://localhost:8000/etl/run"
curl -X POST "http://localhost:8000/model/train"
```
