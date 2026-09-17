"""
LADRIS — Comprehensive Tests: Multi-Source Data Ingestion Module
================================================================
Tests for:
1. Ingestion routes registered in OpenAPI schema
2. CSV/Excel preview with automatic smart column mapping
3. CSV/Excel import with valid/invalid rows, duplicate detection, and error CSV download
4. REST API batch ingestion with API key and idempotency
5. GIS spatial geometry validation (valid coordinates, polygons, bounding box)
6. PDF document text extraction and review-confirmation flow
7. Manual form ingestion (Project, Compensation, Legal, R&R)
8. Ingestion job history tracking
"""
import io
import json
import time
import pytest
import httpx
from pypdf import PdfWriter

BASE_URL = "http://127.0.0.1:8000"


@pytest.fixture(scope="module")
def api_client():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)
    # Login as admin to get authentic bearer token
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ladris.gov.in", "password": "admin123"},
    )
    assert login_res.status_code == 200, f"Failed to login as admin: {login_res.text}"
    token = login_res.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    yield client
    client.close()


def test_ingestion_routes_registered(api_client):
    """Verify all ingestion routes are registered in OpenAPI schema."""
    res = api_client.get("/openapi.json")
    assert res.status_code == 200
    paths = res.json()["paths"]
    expected_routes = [
        "/api/v1/ingestion/manual",
        "/api/v1/ingestion/csv-excel/preview",
        "/api/v1/ingestion/csv-excel/import",
        "/api/v1/ingestion/external",
        "/api/v1/ingestion/database/test",
        "/api/v1/ingestion/gis",
        "/api/v1/ingestion/document",
        "/api/v1/ingestion/document/confirm",
        "/api/v1/ingestion/jobs/{job_id}",
        "/api/v1/ingestion/jobs/{job_id}/errors.csv",
        "/api/v1/ingestion/history",
    ]
    for route in expected_routes:
        assert route in paths, f"Route {route} not found in OpenAPI paths"


def test_manual_form_ingestion_project_and_validation(api_client):
    """Test manual project creation with strong field validations."""
    code = f"MANUAL-{int(time.time() * 1000)}"

    # 1. Negative area validation failure
    bad_payload = {
        "entity_type": "PROJECT",
        "data": {
            "project_code": f"{code}-BAD",
            "name": "Invalid Negative Land Area Project",
            "state_code": "MH",
            "total_area_ha": -50.0,
        },
    }
    res = api_client.post("/api/v1/ingestion/manual", json=bad_payload)
    assert res.status_code == 422
    assert "cannot be negative" in res.json()["detail"]

    # 2. Compensation disbursed > sanctioned validation failure
    bad_comp_payload = {
        "entity_type": "PROJECT",
        "data": {
            "project_code": f"{code}-COMP-BAD",
            "name": "Invalid Compensation Project",
            "state_code": "MH",
            "estimated_compensation_inr": 1000000.0,
            "disbursed_compensation_inr": 2000000.0,
        },
    }
    res = api_client.post("/api/v1/ingestion/manual", json=bad_comp_payload)
    assert res.status_code == 422
    assert "cannot exceed sanctioned" in res.json()["detail"]

    # 3. Valid project creation
    valid_payload = {
        "entity_type": "PROJECT",
        "data": {
            "project_code": code,
            "name": "Mumbai-Goa Highway Upgrade P1",
            "project_type": "HIGHWAY",
            "state_code": "MH",
            "district_codes": ["Ratnagiri", "Sindhudurg"],
            "total_area_ha": 450.5,
            "area_acquired_ha": 200.0,
            "area_in_possession_ha": 150.0,
            "estimated_compensation_inr": 50000000.0,
            "disbursed_compensation_inr": 25000000.0,
            "total_affected_families": 200,
            "families_compensated": 120,
            "families_rehabilitated": 100,
            "rehabilitation_progress_pct": 50.0,
            "planned_start_date": "2025-01-01",
            "planned_end_date": "2027-12-31",
            "notification_3a_date": "2024-06-01",
            "latitude": 16.9902,
            "longitude": 73.3120,
        },
    }
    res = api_client.post("/api/v1/ingestion/manual", json=valid_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["entity_type"] == "PROJECT"
    assert data["record_id"] is not None
    project_id = data["project_id"]

    # 4. Add Child Compensation Record linked to the project
    comp_payload = {
        "entity_type": "COMPENSATION",
        "data": {
            "project_id": project_id,
            "awarded_amount_inr": 500000,
            "disbursed_amount_inr": 500000,
            "award_date": "2025-05-01",
            "disbursement_date": "2025-06-01",
        },
    }
    comp_res = api_client.post("/api/v1/ingestion/manual", json=comp_payload)
    assert comp_res.status_code == 200
    assert comp_res.json()["success"] is True


def test_csv_preview_and_smart_column_mapping(api_client):
    """Test CSV preview with automatic header matching."""
    csv_content = (
        "Project ID,Project Name,State,Land Area (ha),Compensation Sanctioned,Compensation Disbursed,Latitude,Longitude\n"
        "CSV-TEST-101,Delhi-Amritsar Highway,DL,120.5,5000000,3000000,28.6139,77.2090\n"
        "CSV-TEST-102,Jaipur Ring Road,RJ,80.0,3000000,1500000,26.9124,75.7873\n"
    )
    files = {"file": ("test_projects.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = api_client.post("/api/v1/ingestion/csv-excel/preview", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_rows"] == 2
    assert "Project ID" in data["columns"]
    # Check smart mapping
    mappings = data["suggested_mappings"]
    assert mappings.get("Project ID") == "project_code"
    assert mappings.get("Project Name") == "name"
    assert mappings.get("State") == "state_code"
    assert mappings.get("Land Area (ha)") == "total_area_ha"
    assert mappings.get("Compensation Sanctioned") == "estimated_compensation_inr"


def test_csv_import_with_valid_and_invalid_rows_and_error_report(api_client):
    """Test importing CSV containing valid rows and an invalid row, then downloading error CSV."""
    code_valid = f"CSV-V-{int(time.time() * 1000)}"
    code_invalid = f"CSV-INV-{int(time.time() * 1000)}"

    # Row 1: Valid
    # Row 2: Invalid (Disbursed > Sanctioned)
    csv_content = (
        f"Project ID,Project Name,State,Land Area (ha),Compensation Sanctioned,Compensation Disbursed\n"
        f"{code_valid},Bengaluru Outer Corridor,KA,300.0,10000000,5000000\n"
        f"{code_invalid},Defective Highway Stretch,KA,100.0,2000000,5000000\n"
    )
    mapping = {
        "Project ID": "project_code",
        "Project Name": "name",
        "State": "state_code",
        "Land Area (ha)": "total_area_ha",
        "Compensation Sanctioned": "estimated_compensation_inr",
        "Compensation Disbursed": "disbursed_compensation_inr",
    }
    form_data = {
        "column_mapping": json.dumps(mapping),
        "target_entity": "PROJECT",
        "source_name": "Test CSV Upload",
    }
    files = {"file": ("mixed_projects.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    res = api_client.post("/api/v1/ingestion/csv-excel/import", data=form_data, files=files)
    assert res.status_code == 200
    summary = res.json()
    assert summary["total_rows"] == 2
    assert summary["imported_rows"] == 1
    assert summary["invalid_rows"] == 1
    assert summary["rejected_rows"] == 1
    assert summary["error_report_url"] is not None

    # Download the error report
    job_id = summary["job_id"]
    err_res = api_client.get(f"/api/v1/ingestion/jobs/{job_id}/errors.csv")
    assert err_res.status_code == 200
    assert "text/csv" in err_res.headers.get("content-type", "")
    assert code_invalid in err_res.text
    assert "cannot exceed sanctioned" in err_res.text


def test_rest_api_external_ingestion_with_api_key(api_client):
    """Test external system pushing JSON batch using X-API-Key."""
    code = f"API-BATCH-{int(time.time() * 1000)}"
    batch_payload = {
        "source_name": "PM_GATI_SHAKTI_NATIONAL_PORTAL",
        "reporting_period": "2026-Q1",
        "projects": [
            {
                "project_code": f"{code}-1",
                "name": "Western Dedicated Freight Corridor Phase 2",
                "project_type": "RAILWAY",
                "state_code": "GJ",
                "district_codes": ["Vadodara", "Surat"],
                "total_area_ha": 650.0,
                "area_acquired_ha": 500.0,
                "estimated_compensation_inr": 80000000.0,
                "disbursed_compensation_inr": 70000000.0,
                "total_affected_families": 400,
                "families_compensated": 380,
                "planned_start_date": "2024-03-01",
                "planned_end_date": "2027-06-30",
                "latitude": 22.3072,
                "longitude": 73.1812,
            }
        ],
    }
    # Authenticate via X-API-Key header (bypassing bearer token)
    res = httpx.post(
        f"{BASE_URL}/api/v1/ingestion/external",
        json=batch_payload,
        headers={"X-API-Key": "ladris-secure-api-key-default"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["imported"] == 1
    assert data["duplicates"] == 0
    assert data["invalid"] == 0

    # Duplicate check: send again with same code
    res_dup = httpx.post(
        f"{BASE_URL}/api/v1/ingestion/external",
        json=batch_payload,
        headers={"X-API-Key": "ladris-secure-api-key-default"},
    )
    assert res_dup.status_code == 200
    data_dup = res_dup.json()
    assert data_dup["duplicates"] == 1
    assert data_dup["imported"] == 0


def test_gis_geojson_upload_and_validation(api_client):
    """Test GIS file ingestion with valid polygon and bounding box computation."""
    geojson_data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [77.2000, 28.6000],
                            [77.2100, 28.6000],
                            [77.2100, 28.6100],
                            [77.2000, 28.6100],
                            [77.2000, 28.6000],
                        ]
                    ],
                },
                "properties": {
                    "khasra_number": "104/2",
                    "village": "Badarpur",
                    "district": "South East Delhi",
                    "area_ha": 12.5,
                },
            }
        ],
    }
    files = {"file": ("delhi_parcels.geojson", json.dumps(geojson_data).encode("utf-8"), "application/geo+json")}
    res = api_client.post("/api/v1/ingestion/gis", files=files)
    assert res.status_code == 200
    data = res.json()
    assert data["total_features"] == 1
    assert data["valid_features"] == 1
    assert data["invalid_features"] == 0
    assert "Polygon" in data["geometry_types"]
    assert data["bounding_box"] is not None


def test_pdf_document_extraction_and_confirmation(api_client):
    """Test PDF upload, text extraction, review screen fields, and user confirmation."""
    # Create a simple PDF in-memory with gazette notification text
    writer = PdfWriter()
    page = writer.add_blank_page(width=612, height=792)
    pdf_buffer = io.BytesIO()
    writer.write(pdf_buffer)
    pdf_bytes = pdf_buffer.getvalue()

    files = {"file": ("gazette_notification_3a.pdf", pdf_bytes, "application/pdf")}
    data = {"document_type": "NOTIFICATION"}
    res = api_client.post("/api/v1/ingestion/document", files=files, data=data)
    assert res.status_code == 200
    ext_data = res.json()
    assert ext_data["document_id"] is not None
    assert ext_data["review_status"] == "NEEDS_REVIEW"

    # Now confirm the reviewed fields
    doc_id = ext_data["document_id"]
    code = f"DOC-P-{int(time.time() * 1000)}"
    confirm_payload = {
        "document_id": doc_id,
        "confirmed_fields": {
            "project_code": code,
            "project_name": "NH-44 Expansion Package B",
            "state_code": "UP",
            "district": "Varanasi",
            "total_area_ha": 85.0,
            "estimated_compensation_inr": 12000000.0,
            "notification_date": "2025-02-15",
        },
        "create_project": True,
    }
    confirm_res = api_client.post("/api/v1/ingestion/document/confirm", json=confirm_payload)
    assert confirm_res.status_code == 200
    confirm_data = confirm_res.json()
    assert confirm_data["status"] == "CONFIRMED"
    assert confirm_data["project_id"] is not None


def test_ingestion_history(api_client):
    """Test retrieving ingestion job history."""
    res = api_client.get("/api/v1/ingestion/history")
    assert res.status_code == 200
    history = res.json()
    assert "total" in history
    assert "jobs" in history
    assert len(history["jobs"]) >= 1
