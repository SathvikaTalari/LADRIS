"""
LADRIS — Centralized Ingestion & ETL Service
===========================================
Unified processing engine for all 6 ingestion channels:
- Manual Forms
- CSV / Excel bulk uploads
- REST API external push
- PostgreSQL / External DB import
- GIS files (GeoJSON, KML, zipped Shapefile, CSV lat/lng)
- PDF Documents (3A/3D notifications, SIA reports, awards)

Ensures consistent normalization, strong validation, provenance tracking,
PostGIS persistence, and automatic ML pipeline prediction refresh.
"""
from __future__ import annotations

import csv
import io
import json
import logging
import os
import re
import tempfile
import uuid
import zipfile
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from pydantic import ValidationError
from shapely.geometry import Point, Polygon, LineString, MultiPolygon, MultiLineString, mapping, shape
from shapely.validation import explain_validity
import shapefile  # pyshp
import defusedxml.ElementTree as ET
from pypdf import PdfReader
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.config import get_settings
from app.models.project import AcquisitionAct, Project, ProjectStatus, ProjectType, RiskLevel
from app.models.stage import ProjectStage, StageName, StageStatus
from app.models.ml_source import CompensationRecord, LegalCaseRecord, RehabilitationRecord, StakeholderUpdate
from app.models.ingestion import (
    IngestionJob,
    RawIngestionRecord,
    SourceDocument,
    FieldMappingRule,
    LandParcel,
    IngestionJobStatus,
    ValidationStatus,
)
from app.services.ml_feature_service import STAGE_MAP, STATE_MAP, validate_project_consistency
from app.services.production_ml_service import ensure_current_prediction, generate_prediction
from app.services.project_csv_service import append_or_update_project_in_csv, STAGES

logger = logging.getLogger(__name__)

# Standard Indian States mapping (2-3 letter code to uppercase standard)
STANDARD_STATE_CODES = {
    "ANDHRA PRADESH": "AP", "AP": "AP",
    "ARUNACHAL PRADESH": "AR", "AR": "AR",
    "ASSAM": "AS", "AS": "AS",
    "BIHAR": "BR", "BR": "BR",
    "CHHATTISGARH": "CG", "CG": "CG", "CT": "CG",
    "DELHI": "DL", "DL": "DL",
    "GOA": "GA", "GA": "GA",
    "GUJARAT": "GJ", "GJ": "GJ",
    "HARYANA": "HR", "HR": "HR",
    "HIMACHAL PRADESH": "HP", "HP": "HP",
    "JHARKHAND": "JH", "JH": "JH",
    "KARNATAKA": "KA", "KA": "KA",
    "KERALA": "KL", "KL": "KL",
    "MADHYA PRADESH": "MP", "MP": "MP",
    "MAHARASHTRA": "MH", "MH": "MH",
    "MANIPUR": "MN", "MN": "MN",
    "MEGHALAYA": "ML", "ML": "ML",
    "MIZORAM": "MZ", "MZ": "MZ",
    "NAGALAND": "NL", "NL": "NL",
    "ODISHA": "OD", "OD": "OD", "ORISSA": "OD",
    "PUNJAB": "PB", "PB": "PB",
    "RAJASTHAN": "RJ", "RJ": "RJ",
    "SIKKIM": "SK", "SK": "SK",
    "TAMIL NADU": "TN", "TN": "TN",
    "TELANGANA": "TG", "TG": "TG", "TS": "TG",
    "TRIPURA": "TR", "TR": "TR",
    "UTTAR PRADESH": "UP", "UP": "UP",
    "UTTARAKHAND": "UK", "UK": "UK", "UT": "UK",
    "WEST BENGAL": "WB", "WB": "WB",
    "JAMMU AND KASHMIR": "JK", "JK": "JK",
    "LADAKH": "LA", "LA": "LA",
    "PUDUCHERRY": "PY", "PY": "PY",
}

# Synonym mapping for smart CSV/Excel auto-detection
HEADER_SYNONYMS = {
    "project_code": ["project code", "project_code", "project id", "project_id", "code", "pid", "id"],
    "name": ["project name", "name", "project_name", "title", "stretch name", "package name"],
    "project_type": ["project type", "project_type", "sector", "type", "category"],
    "acquisition_act": ["acquisition act", "act", "act_name", "law"],
    "state_code": ["state", "state_code", "state name", "st"],
    "district_codes": ["district", "district_codes", "districts", "dist"],
    "executing_agency": ["executing agency", "agency", "nodal agency", "implementing agency", "authority", "division"],
    "total_area_ha": ["total area (ha)", "total_area_ha", "land area (ha)", "area_ha", "total land area", "area", "land required"],
    "area_acquired_ha": ["area acquired (ha)", "area_acquired_ha", "acquired area", "land acquired"],
    "area_in_possession_ha": ["area in possession", "area_in_possession_ha", "possession area", "land possessed"],
    "total_affected_families": ["affected families", "total_affected_families", "paps", "displaced families", "families affected"],
    "families_compensated": ["families compensated", "families_compensated", "compensated families"],
    "families_rehabilitated": ["families rehabilitated", "families_rehabilitated", "resettled families"],
    "rehabilitation_progress_pct": ["r&r progress %", "rehabilitation_progress_pct", "r&r progress", "rehab %", "rr progress"],
    "estimated_compensation_inr": ["compensation sanctioned", "estimated_compensation_inr", "sanctioned amount", "sanctioned compensation", "cost (inr)", "sanctioned cost"],
    "disbursed_compensation_inr": ["compensation disbursed", "disbursed_compensation_inr", "disbursed amount", "amount paid", "disbursed compensation"],
    "planned_start_date": ["planned start date", "start date", "planned_start_date", "start_date", "commencement date"],
    "planned_end_date": ["expected completion", "planned end date", "target completion", "planned_end_date", "target_date", "end date"],
    "notification_3a_date": ["notification date", "notification_3a_date", "3a date", "sec 4 date", "preliminary notification"],
    "notification_3d_date": ["notification_3d_date", "3d date", "sec 19 date", "declaration date"],
    "legal_case_count": ["open disputes", "legal_case_count", "court cases", "litigations", "dispute count", "pending disputes"],
    "legal_case_status": ["legal case status", "case status", "legal_status", "court status"],
    "latitude": ["latitude", "lat", "y"],
    "longitude": ["longitude", "long", "lng", "lon", "x"],
}


def to_jsonable(obj: Any) -> Any:
    """Recursively convert dates, UUIDs, and complex objects to JSON-serializable primitives."""
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if hasattr(obj, "value"):  # Enums
        return obj.value
    if isinstance(obj, dict):
        return {str(k): to_jsonable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_jsonable(v) for v in obj]
    return obj


def parse_date_safe(val: Any) -> Optional[date]:
    """Parse multiple date string representations safely."""
    if val is None or val == "" or pd.isna(val):
        return None
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    s = str(val).strip()
    if not s or s.lower() in ("null", "none", "nan", "nat", "-"):
        return None
    # Try multiple standard formats
    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y",
        "%Y/%m/%d", "%d.%m.%Y", "%Y-%m-%dT%H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s.split("T")[0] if "T" in s else s, fmt).date()
        except ValueError:
            continue
    try:
        parsed = pd.to_datetime(s, dayfirst=True)
        return parsed.date()
    except Exception:
        return None


def parse_float_safe(val: Any) -> Optional[float]:
    if val is None or val == "" or pd.isna(val):
        return None
    try:
        if isinstance(val, (int, float)):
            return float(val)
        cleaned = re.sub(r"[^\d.-]", "", str(val))
        return float(cleaned) if cleaned else None
    except Exception:
        return None


def parse_int_safe(val: Any) -> Optional[int]:
    if val is None or val == "" or pd.isna(val):
        return None
    try:
        f = parse_float_safe(val)
        return int(f) if f is not None else None
    except Exception:
        return None


class IngestionService:
    """Core Ingestion & ETL Service implementing multi-source parsing and validation."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()

    # ─── 1. Canonical Field Normalizer & Strong Validation ────────────────────

    def normalize_project_payload(self, raw: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        """
        Maps raw input fields to canonical LADRIS Project model structure
        and enforces strict validation rules.
        """
        errors: List[str] = []
        normalized: Dict[str, Any] = {}

        # 1. Project Code
        code = str(raw.get("project_code") or raw.get("Project ID") or "").strip()
        if not code:
            errors.append("Project Code / ID is required.")
        normalized["project_code"] = code

        # 2. Name
        name = str(raw.get("name") or raw.get("Project Name") or "").strip()
        if not name:
            errors.append("Project Name is required.")
        normalized["name"] = name

        # 3. State Code
        raw_state = str(raw.get("state_code") or raw.get("State") or "").strip().upper()
        state = STANDARD_STATE_CODES.get(raw_state, raw_state)
        if not state or len(state) > 3:
            # Try to lookup by full state name
            state = STANDARD_STATE_CODES.get(raw_state, "")
        if not state:
            errors.append(f"Invalid or missing State Code: '{raw_state}'.")
        normalized["state_code"] = state

        # 4. District Codes
        raw_dist = raw.get("district_codes") or raw.get("District") or []
        if isinstance(raw_dist, str):
            districts = [d.strip() for d in re.split(r"[,;/]+", raw_dist) if d.strip()]
        elif isinstance(raw_dist, list):
            districts = [str(d).strip() for d in raw_dist if str(d).strip()]
        else:
            districts = []
        normalized["district_codes"] = districts

        # 5. Project Type
        pt_raw = str(raw.get("project_type") or raw.get("Project Type") or "HIGHWAY").strip().upper().replace(" ", "_")
        try:
            normalized["project_type"] = ProjectType(pt_raw)
        except ValueError:
            normalized["project_type"] = ProjectType.HIGHWAY

        # 6. Acquisition Act
        act_raw = str(raw.get("acquisition_act") or "RFCTLARR_2013").strip().upper().replace(" ", "_")
        try:
            normalized["acquisition_act"] = AcquisitionAct(act_raw)
        except ValueError:
            normalized["acquisition_act"] = AcquisitionAct.RFCTLARR_2013

        # 7. Agencies
        normalized["executing_agency"] = str(raw.get("executing_agency") or raw.get("Implementing Agency") or "").strip() or None
        normalized["nodal_agency"] = str(raw.get("nodal_agency") or "").strip() or normalized["executing_agency"]

        # 8. Numeric Land Areas
        total_area = parse_float_safe(raw.get("total_area_ha") or raw.get("Land Area (ha)"))
        acquired_area = parse_float_safe(raw.get("area_acquired_ha"))
        possession_area = parse_float_safe(raw.get("area_in_possession_ha"))

        if total_area is not None:
            if total_area < 0:
                errors.append("Land Area cannot be negative.")
            normalized["total_area_ha"] = total_area

        if acquired_area is not None:
            if acquired_area < 0:
                errors.append("Acquired area cannot be negative.")
            if total_area is not None and acquired_area > total_area:
                errors.append(f"Acquired area ({acquired_area} ha) cannot exceed total area ({total_area} ha).")
            normalized["area_acquired_ha"] = acquired_area

        if possession_area is not None:
            if possession_area < 0:
                errors.append("Possession area cannot be negative.")
            if acquired_area is not None and possession_area > acquired_area:
                errors.append(f"Possession area ({possession_area} ha) cannot exceed acquired area ({acquired_area} ha).")
            normalized["area_in_possession_ha"] = possession_area

        # 9. Affected Families & R&R
        aff_fam = parse_int_safe(raw.get("total_affected_families") or raw.get("Affected Families"))
        comp_fam = parse_int_safe(raw.get("families_compensated"))
        rehab_fam = parse_int_safe(raw.get("families_rehabilitated"))
        rehab_pct = parse_float_safe(raw.get("rehabilitation_progress_pct") or raw.get("R&R Progress %"))

        if aff_fam is not None:
            if aff_fam < 0:
                errors.append("Affected families cannot be negative.")
            normalized["total_affected_families"] = aff_fam

        if comp_fam is not None:
            if comp_fam < 0:
                errors.append("Compensated families cannot be negative.")
            if aff_fam is not None and comp_fam > aff_fam:
                errors.append("Compensated families cannot exceed total affected families.")
            normalized["families_compensated"] = comp_fam

        if rehab_fam is not None:
            if rehab_fam < 0:
                errors.append("Rehabilitated families cannot be negative.")
            if aff_fam is not None and rehab_fam > aff_fam:
                errors.append("Rehabilitated families cannot exceed total affected families.")
            normalized["families_rehabilitated"] = rehab_fam

        if rehab_pct is not None:
            if rehab_pct < 0 or rehab_pct > 100:
                errors.append(f"Rehabilitation progress percentage must be between 0 and 100 (got {rehab_pct}).")
            normalized["rehabilitation_progress_pct"] = rehab_pct

        # 10. Financials (Sanctioned vs Disbursed)
        est_comp = parse_float_safe(raw.get("estimated_compensation_inr") or raw.get("Compensation Sanctioned"))
        disb_comp = parse_float_safe(raw.get("disbursed_compensation_inr") or raw.get("Compensation Disbursed"))

        if est_comp is not None:
            if est_comp < 0:
                errors.append("Sanctioned compensation cannot be negative.")
            normalized["estimated_compensation_inr"] = est_comp

        if disb_comp is not None:
            if disb_comp < 0:
                errors.append("Disbursed compensation cannot be negative.")
            if est_comp is not None and disb_comp > est_comp:
                errors.append(f"Disbursed compensation (₹{disb_comp:,.2f}) cannot exceed sanctioned compensation (₹{est_comp:,.2f}).")
            normalized["disbursed_compensation_inr"] = disb_comp

        # 11. Dates Consistency
        start_date = parse_date_safe(raw.get("planned_start_date"))
        end_date = parse_date_safe(raw.get("planned_end_date") or raw.get("Expected Completion"))
        notif_3a = parse_date_safe(raw.get("notification_3a_date") or raw.get("Notification Date"))
        notif_3d = parse_date_safe(raw.get("notification_3d_date"))

        if start_date and end_date and end_date < start_date:
            errors.append(f"Planned completion date ({end_date}) cannot precede start date ({start_date}).")
        if notif_3a and end_date and end_date < notif_3a:
            errors.append(f"Expected completion date ({end_date}) cannot precede preliminary notification date ({notif_3a}).")
        if notif_3a and notif_3d and notif_3d < notif_3a:
            errors.append(f"Section 3D notification date ({notif_3d}) cannot precede Section 3A date ({notif_3a}).")

        normalized["planned_start_date"] = start_date
        normalized["planned_end_date"] = end_date
        normalized["notification_3a_date"] = notif_3a
        normalized["notification_3d_date"] = notif_3d

        # 12. Legal Cases & Disputes
        legal_count = parse_int_safe(raw.get("legal_case_count") or raw.get("Open Disputes") or 0)
        if legal_count is not None:
            if legal_count < 0:
                errors.append("Legal case count cannot be negative.")
            normalized["legal_case_count"] = legal_count
        normalized["legal_case_status"] = str(raw.get("legal_case_status") or ("OPEN" if legal_count and legal_count > 0 else "NONE")).upper()

        # 13. GIS Coordinates
        lat = parse_float_safe(raw.get("latitude") or raw.get("Latitude"))
        lng = parse_float_safe(raw.get("longitude") or raw.get("Longitude"))
        if lat is not None:
            if not (-90 <= lat <= 90):
                errors.append(f"Invalid latitude: {lat}. Must be between -90 and 90.")
            normalized["latitude"] = lat
        if lng is not None:
            if not (-180 <= lng <= 180):
                errors.append(f"Invalid longitude: {lng}. Must be between -180 and 180.")
            normalized["longitude"] = lng

        return normalized, errors

    # ─── 2. CSV / Excel Auto-Mapping & Preview ────────────────────────────────

    def auto_map_columns(self, columns: List[str]) -> Dict[str, str]:
        """Automatically match recognized columns to LADRIS fields using synonym search."""
        mapping_result: Dict[str, str] = {}
        for col in columns:
            col_clean = re.sub(r"[\s_-]+", " ", col.strip().lower())
            matched_field = None
            for target_field, synonyms in HEADER_SYNONYMS.items():
                if col_clean in [s.lower() for s in synonyms] or col.strip().lower() == target_field:
                    matched_field = target_field
                    break
            if matched_field:
                mapping_result[col] = matched_field
        return mapping_result

    def preview_csv_excel(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """Read .csv, .xls, or .xlsx file, return row counts, headers, sample rows, and auto-mapping."""
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".csv":
            try:
                df = pd.read_csv(io.BytesIO(file_content), nrows=50)
            except Exception:
                df = pd.read_csv(io.BytesIO(file_content), encoding="latin1", nrows=50)
        elif ext in (".xls", ".xlsx"):
            df = pd.read_excel(io.BytesIO(file_content), nrows=50)
        else:
            raise ValueError(f"Unsupported spreadsheet format: '{ext}'. Allowed: .csv, .xls, .xlsx")

        columns = [str(c).strip() for c in df.columns]
        auto_mappings = self.auto_map_columns(columns)

        # Replace NaN with None for JSON compliance
        df_clean = df.head(10).where(pd.notnull(df.head(10)), None)
        sample_rows = df_clean.to_dict(orient="records")

        # Guess total rows efficiently
        total_rows = len(df)
        if ext == ".csv":
            try:
                total_rows = sum(1 for _ in io.BytesIO(file_content)) - 1
            except Exception:
                pass

        available_target_fields = [
            {"field": "project_code", "label": "Project Code / ID (Required)", "required": "true"},
            {"field": "name", "label": "Project Name (Required)", "required": "true"},
            {"field": "state_code", "label": "State Code (Required)", "required": "true"},
            {"field": "district_codes", "label": "District(s)", "required": "false"},
            {"field": "project_type", "label": "Project Sector / Type", "required": "false"},
            {"field": "executing_agency", "label": "Implementing Agency", "required": "false"},
            {"field": "total_area_ha", "label": "Total Land Area (ha)", "required": "false"},
            {"field": "area_acquired_ha", "label": "Area Acquired (ha)", "required": "false"},
            {"field": "area_in_possession_ha", "label": "Area in Possession (ha)", "required": "false"},
            {"field": "total_affected_families", "label": "Affected Families", "required": "false"},
            {"field": "families_compensated", "label": "Families Compensated", "required": "false"},
            {"field": "families_rehabilitated", "label": "Families Rehabilitated", "required": "false"},
            {"field": "rehabilitation_progress_pct", "label": "R&R Progress (%)", "required": "false"},
            {"field": "estimated_compensation_inr", "label": "Sanctioned Compensation (₹)", "required": "false"},
            {"field": "disbursed_compensation_inr", "label": "Disbursed Compensation (₹)", "required": "false"},
            {"field": "planned_start_date", "label": "Planned Start Date", "required": "false"},
            {"field": "planned_end_date", "label": "Target Completion Date", "required": "false"},
            {"field": "notification_3a_date", "label": "Section 3A / 4 Notification Date", "required": "false"},
            {"field": "notification_3d_date", "label": "Section 3D / 19 Declaration Date", "required": "false"},
            {"field": "legal_case_count", "label": "Open Legal Disputes Count", "required": "false"},
            {"field": "latitude", "label": "Latitude", "required": "false"},
            {"field": "longitude", "label": "Longitude", "required": "false"},
        ]

        return {
            "columns": columns,
            "total_rows": max(total_rows, len(sample_rows)),
            "sample_rows": sample_rows,
            "suggested_mappings": auto_mappings,
            "suggested_entity": "PROJECT",
            "available_target_fields": available_target_fields,
        }

    # ─── 3. Bulk CSV / Excel Processing & Ingestion ───────────────────────────

    async def import_csv_excel(
        self,
        file_content: bytes,
        filename: str,
        column_mapping: Dict[str, str],
        target_entity: str = "PROJECT",
        source_name: Optional[str] = None,
        reporting_period: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Execute CSV/Excel bulk import with row validation, duplicate checks, and PostGIS/ML refresh."""
        ext = os.path.splitext(filename)[1].lower()
        if ext == ".csv":
            try:
                df = pd.read_csv(io.BytesIO(file_content))
            except Exception:
                df = pd.read_csv(io.BytesIO(file_content), encoding="latin1")
        elif ext in (".xls", ".xlsx"):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            raise ValueError(f"Unsupported format: {ext}")

        # Create IngestionJob record
        job = IngestionJob(
            job_type="CSV_EXCEL",
            source_name=source_name or f"Upload: {filename}",
            source_type="FILE_UPLOAD",
            source_file_name=filename,
            file_size_bytes=len(file_content),
            mime_type="text/csv" if ext == ".csv" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            status=IngestionJobStatus.VALIDATING.value,
            reporting_period=reporting_period,
            mapping_config=column_mapping,
            uploaded_by=user_id,
            total_records=len(df),
        )
        self.db.add(job)
        await self.db.flush()

        # Cache existing project codes for fast duplicate detection
        existing_codes_res = await self.db.execute(select(Project.project_code).where(Project.deleted_at.is_(None)))
        existing_codes = set(existing_codes_res.scalars().all())

        imported_count = 0
        duplicate_count = 0
        invalid_count = 0
        rejected_errors: List[Dict[str, Any]] = []
        imported_project_ids: List[uuid.UUID] = []
        seen_batch_codes = set()

        # Invert mapping: {source_col: target_field}
        for index, row in df.iterrows():
            row_dict = row.where(pd.notnull(row), None).to_dict()
            mapped_payload: Dict[str, Any] = {}
            for src_col, target_field in column_mapping.items():
                if src_col in row_dict and target_field:
                    mapped_payload[target_field] = row_dict[src_col]

            row_index = index + 1
            code = str(mapped_payload.get("project_code") or "").strip()

            # Duplicate Check
            if code in existing_codes or code in seen_batch_codes:
                duplicate_count += 1
                raw_rec = RawIngestionRecord(
                    job_id=job.id,
                    row_index=row_index,
                    source_record_id=code,
                    raw_payload=to_jsonable(row_dict),
                    normalized_payload=to_jsonable(mapped_payload),
                    validation_status=ValidationStatus.DUPLICATE.value,
                    validation_errors=["Duplicate project_code detected"],
                    target_entity=target_entity,
                )
                self.db.add(raw_rec)
                rejected_errors.append({
                    "row_index": row_index,
                    "project_code": code,
                    "reason": f"Duplicate project code '{code}' already exists in LADRIS or file.",
                })
                continue

            # Strong Validation
            normalized, errors = self.normalize_project_payload(mapped_payload)
            if errors:
                invalid_count += 1
                raw_rec = RawIngestionRecord(
                    job_id=job.id,
                    row_index=row_index,
                    source_record_id=code,
                    raw_payload=to_jsonable(row_dict),
                    normalized_payload=to_jsonable(normalized),
                    validation_status=ValidationStatus.INVALID.value,
                    validation_errors=errors,
                    target_entity=target_entity,
                )
                self.db.add(raw_rec)
                rejected_errors.append({
                    "row_index": row_index,
                    "project_code": code or f"Row-{row_index}",
                    "reason": "; ".join(errors),
                })
                continue

            # Save valid Project
            try:
                project = Project(
                    **normalized,
                    created_by=user_id,
                    updated_by=user_id,
                    status=ProjectStatus.ACTIVE,
                )
                self.db.add(project)
                await self.db.flush()

                # Add standard stages
                for s_idx, (_, stage_name) in enumerate(STAGES):
                    s_status = StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING
                    stage = ProjectStage(
                        project_id=project.id,
                        stage_name=stage_name,
                        stage_order=s_idx + 1,
                        status=s_status,
                    )
                    self.db.add(stage)

                # Record raw ingestion entry
                raw_rec = RawIngestionRecord(
                    job_id=job.id,
                    row_index=row_index,
                    source_record_id=project.project_code,
                    raw_payload=to_jsonable(row_dict),
                    normalized_payload=to_jsonable(normalized),
                    validation_status=ValidationStatus.IMPORTED.value,
                    validation_errors=[],
                    target_entity=target_entity,
                    target_id=project.id,
                )
                self.db.add(raw_rec)

                seen_batch_codes.add(code)
                existing_codes.add(code)
                imported_project_ids.append(project.id)
                imported_count += 1
            except Exception as e:
                logger.error(f"Error persisting row {row_index}: {e}")
                invalid_count += 1
                rejected_errors.append({
                    "row_index": row_index,
                    "project_code": code,
                    "reason": f"Database insertion error: {str(e)}",
                })

        # Update Job Metrics
        job.valid_records = imported_count
        job.invalid_records = invalid_count
        job.duplicate_records = duplicate_count
        job.imported_records = imported_count
        job.error_summary = rejected_errors
        job.status = IngestionJobStatus.IMPORTED.value if imported_count > 0 else IngestionJobStatus.FAILED.value
        job.completed_at = datetime.now(timezone.utc)

        await self.db.commit()

        # Trigger ML pipeline prediction refresh for newly imported projects
        ml_refreshed_count = 0
        for pid in imported_project_ids:
            try:
                await ensure_current_prediction(self.db, pid)
                await self.db.commit()
                ml_refreshed_count += 1
            except Exception as ml_exc:
                await self.db.rollback()
                logger.warning(f"ML prediction refresh skipped for project {pid}: {ml_exc}")

        return {
            "job_id": str(job.id),
            "total_rows": len(df),
            "imported_rows": imported_count,
            "duplicate_rows": duplicate_count,
            "invalid_rows": invalid_count,
            "rejected_rows": invalid_count + duplicate_count,
            "error_report_url": f"/api/v1/ingestion/jobs/{job.id}/errors.csv" if rejected_errors else None,
            "sample_errors": rejected_errors[:10],
            "ml_refreshed_count": ml_refreshed_count,
            "status": job.status,
        }

    # ─── 4. REST API External JSON Ingestion ──────────────────────────────────

    async def ingest_external_api(
        self,
        batch: Dict[str, Any],
        source_name: str,
        reporting_period: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Securely ingest JSON payload from external APIs with idempotency and schema validation."""
        projects_data = batch.get("projects") or batch.get("records") or []

        job = IngestionJob(
            job_type="REST_API",
            source_name=source_name,
            source_type="EXTERNAL_API",
            status=IngestionJobStatus.VALIDATING.value,
            reporting_period=reporting_period,
            total_records=len(projects_data),
            uploaded_by=user_id,
        )
        self.db.add(job)
        await self.db.flush()

        existing_codes_res = await self.db.execute(select(Project.project_code).where(Project.deleted_at.is_(None)))
        existing_codes = set(existing_codes_res.scalars().all())

        imported = 0
        duplicates = 0
        invalid = 0
        errors: List[Dict[str, Any]] = []
        imported_ids: List[uuid.UUID] = []

        for idx, item in enumerate(projects_data):
            row_idx = idx + 1
            code = str(item.get("project_code") or "").strip()

            if code in existing_codes:
                duplicates += 1
                errors.append({"row_index": row_idx, "project_code": code, "reason": "Duplicate project code"})
                continue

            normalized, errs = self.normalize_project_payload(item)
            if errs:
                invalid += 1
                errors.append({"row_index": row_idx, "project_code": code, "reason": "; ".join(errs)})
                continue

            try:
                proj = Project(
                    **normalized,
                    created_by=user_id,
                    updated_by=user_id,
                    status=ProjectStatus.ACTIVE,
                )
                self.db.add(proj)
                await self.db.flush()

                for s_idx, (_, s_name) in enumerate(STAGES):
                    stg = ProjectStage(
                        project_id=proj.id,
                        stage_name=s_name,
                        stage_order=s_idx + 1,
                        status=StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING,
                    )
                    self.db.add(stg)

                raw_entry = RawIngestionRecord(
                    job_id=job.id,
                    row_index=row_idx,
                    source_record_id=code,
                    raw_payload=to_jsonable(item),
                    normalized_payload=to_jsonable(normalized),
                    validation_status=ValidationStatus.IMPORTED.value,
                    target_entity="PROJECT",
                    target_id=proj.id,
                )
                self.db.add(raw_entry)

                existing_codes.add(code)
                imported_ids.append(proj.id)
                imported += 1
            except Exception as e:
                invalid += 1
                errors.append({"row_index": row_idx, "project_code": code, "reason": str(e)})

        job.valid_records = imported
        job.invalid_records = invalid
        job.duplicate_records = duplicates
        job.imported_records = imported
        job.error_summary = errors
        job.status = IngestionJobStatus.IMPORTED.value if imported > 0 else IngestionJobStatus.FAILED.value
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # ML refresh
        ml_refreshed_count = 0
        for pid in imported_ids:
            try:
                await ensure_current_prediction(self.db, pid)
                await self.db.commit()
                ml_refreshed_count += 1
            except Exception:
                await self.db.rollback()

        return {
            "job_id": str(job.id),
            "status": job.status,
            "total": len(projects_data),
            "imported": imported,
            "duplicates": duplicates,
            "invalid": invalid,
            "errors": errors,
            "ml_refreshed_count": ml_refreshed_count,
        }

    # ─── 5. GIS Ingestion (GeoJSON, KML, Shapefile, CSV Coordinates) ──────────

    async def ingest_gis_file(
        self,
        file_content: bytes,
        filename: str,
        project_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Parse, validate topology, and persist GIS files to PostGIS `land_parcels`.
        Supports GeoJSON, KML, zipped Shapefile, and CSV lat/lng.
        """
        ext = os.path.splitext(filename)[1].lower()
        features: List[Dict[str, Any]] = []

        if ext in (".geojson", ".json"):
            try:
                data = json.loads(file_content.decode("utf-8"))
                if data.get("type") == "FeatureCollection":
                    features = data.get("features", [])
                elif data.get("type") == "Feature":
                    features = [data]
                elif "coordinates" in data:
                    features = [{"type": "Feature", "geometry": data, "properties": {}}]
            except Exception as e:
                raise ValueError(f"Invalid GeoJSON content: {e}")

        elif ext == ".kml":
            try:
                root = ET.fromstring(file_content)
                # Parse Placemarks in KML
                namespaces = {"kml": "http://www.opengis.net/kml/2.2"}
                placemarks = root.findall(".//kml:Placemark", namespaces) or root.findall(".//Placemark")
                for pm in placemarks:
                    name_el = pm.find("kml:name", namespaces) or pm.find("name")
                    name_str = name_el.text if name_el is not None else "KML Feature"
                    props = {"name": name_str}

                    # Find Polygon
                    poly = pm.find(".//kml:Polygon", namespaces) or pm.find(".//Polygon")
                    coords_el = None
                    if poly is not None:
                        coords_el = poly.find(".//kml:coordinates", namespaces) or poly.find(".//coordinates")
                        if coords_el is not None and coords_el.text:
                            points = []
                            for token in coords_el.text.strip().split():
                                parts = token.split(",")
                                if len(parts) >= 2:
                                    points.append((float(parts[0]), float(parts[1])))
                            if points:
                                if points[0] != points[-1]:
                                    points.append(points[0])  # Close ring
                                features.append({
                                    "type": "Feature",
                                    "geometry": mapping(Polygon(points)),
                                    "properties": props,
                                })
                                continue

                    # Find LineString
                    line = pm.find(".//kml:LineString", namespaces) or pm.find(".//LineString")
                    if line is not None:
                        coords_el = line.find(".//kml:coordinates", namespaces) or line.find(".//coordinates")
                        if coords_el is not None and coords_el.text:
                            points = []
                            for token in coords_el.text.strip().split():
                                parts = token.split(",")
                                if len(parts) >= 2:
                                    points.append((float(parts[0]), float(parts[1])))
                            if points:
                                features.append({
                                    "type": "Feature",
                                    "geometry": mapping(LineString(points)),
                                    "properties": props,
                                })
                                continue

                    # Find Point
                    pt = pm.find(".//kml:Point", namespaces) or pm.find(".//Point")
                    if pt is not None:
                        coords_el = pt.find(".//kml:coordinates", namespaces) or pt.find(".//coordinates")
                        if coords_el is not None and coords_el.text:
                            parts = coords_el.text.strip().split(",")
                            if len(parts) >= 2:
                                features.append({
                                    "type": "Feature",
                                    "geometry": mapping(Point(float(parts[0]), float(parts[1]))),
                                    "properties": props,
                                })
            except Exception as e:
                raise ValueError(f"Error parsing KML: {e}")

        elif ext == ".zip":
            # Zipped Shapefile parsing via pyshp
            try:
                with zipfile.ZipFile(io.BytesIO(file_content)) as z:
                    # Find shp file inside zip
                    shp_names = [f for f in z.namelist() if f.lower().endswith(".shp")]
                    if not shp_names:
                        raise ValueError("No .shp file found inside the ZIP archive.")
                    shp_base = os.path.splitext(shp_names[0])[0]

                    with tempfile.TemporaryDirectory() as tmpdir:
                        z.extractall(tmpdir)
                        shp_path = os.path.join(tmpdir, shp_names[0])
                        sf = shapefile.Reader(shp_path)
                        fields = [field[0] for field in sf.fields[1:]]
                        for shape_rec in sf.shapeRecords():
                            props = dict(zip(fields, shape_rec.record))
                            geom_interface = shape_rec.shape.__geo_interface__
                            features.append({
                                "type": "Feature",
                                "geometry": geom_interface,
                                "properties": props,
                            })
            except Exception as e:
                raise ValueError(f"Error reading Shapefile ZIP: {e}")

        elif ext == ".csv":
            try:
                df = pd.read_csv(io.BytesIO(file_content))
                lat_col = next((c for c in df.columns if c.lower() in ("latitude", "lat", "y")), None)
                lng_col = next((c for c in df.columns if c.lower() in ("longitude", "long", "lng", "lon", "x")), None)
                if not lat_col or not lng_col:
                    raise ValueError("CSV must contain latitude and longitude columns.")
                for _, row in df.iterrows():
                    lat_v = parse_float_safe(row[lat_col])
                    lng_v = parse_float_safe(row[lng_col])
                    if lat_v is not None and lng_v is not None:
                        props = row.where(pd.notnull(row), None).to_dict()
                        features.append({
                            "type": "Feature",
                            "geometry": mapping(Point(lng_v, lat_v)),
                            "properties": props,
                        })
            except Exception as e:
                raise ValueError(f"Error parsing CSV coordinates: {e}")
        else:
            raise ValueError(f"Unsupported GIS file type: '{ext}'. Allowed: .geojson, .kml, .zip (shapefile), .csv")

        if not features:
            raise ValueError("No valid geospatial features could be extracted from the file.")

        # Create Ingestion Job
        job = IngestionJob(
            job_type="GIS",
            source_name=f"GIS: {filename}",
            source_type="FILE_UPLOAD",
            source_file_name=filename,
            file_size_bytes=len(file_content),
            status=IngestionJobStatus.VALIDATING.value,
            total_records=len(features),
            uploaded_by=user_id,
            project_id=project_id,
        )
        self.db.add(job)
        await self.db.flush()

        valid_features: List[Dict[str, Any]] = []
        invalid_count = 0
        geom_types = set()
        lons, lats = [], []

        # Validate each geometry and write to PostGIS land_parcels
        for f in features:
            g = f.get("geometry")
            if not g:
                invalid_count += 1
                continue
            try:
                geom_obj = shape(g)
                # Check validity
                if not geom_obj.is_valid:
                    # Attempt buffer(0) fix or reject
                    fixed = geom_obj.buffer(0)
                    if not fixed.is_valid:
                        invalid_count += 1
                        continue
                    geom_obj = fixed

                g_type = geom_obj.geom_type
                geom_types.add(g_type)

                # Bounds checking (WGS84 EPSG:4326)
                minx, miny, maxx, maxy = geom_obj.bounds
                if not (-180 <= minx <= 180 and -90 <= miny <= 90 and -180 <= maxx <= 180 and -90 <= maxy <= 90):
                    invalid_count += 1
                    continue

                lons.extend([minx, maxx])
                lats.extend([miny, maxy])

                valid_features.append(f)

                # If project_id provided, persist to PostGIS land_parcels
                if project_id:
                    props = f.get("properties", {})
                    geojson_str = json.dumps(mapping(geom_obj))
                    parcel = LandParcel(
                        project_id=project_id,
                        khasra_number=str(props.get("khasra_number") or props.get("survey_no") or props.get("name") or ""),
                        village=str(props.get("village") or ""),
                        tehsil=str(props.get("tehsil") or ""),
                        district=str(props.get("district") or ""),
                        state_code=str(props.get("state_code") or props.get("state") or "")[:10],
                        area_ha=parse_float_safe(props.get("area_ha") or props.get("area")),
                        geom=func.ST_GeomFromGeoJSON(geojson_str),
                        properties=props,
                    )
                    self.db.add(parcel)
            except Exception as geom_err:
                logger.warning(f"Invalid geometry encountered: {geom_err}")
                invalid_count += 1

        # If project_id provided and centroid is available, also update project coordinates
        if project_id and lats and lons:
            avg_lat = sum(lats) / len(lats)
            avg_lng = sum(lons) / len(lons)
            proj = (await self.db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
            if proj and (proj.latitude is None or proj.longitude is None):
                proj.latitude = round(avg_lat, 6)
                proj.longitude = round(avg_lng, 6)

        job.valid_records = len(valid_features)
        job.invalid_records = invalid_count
        job.imported_records = len(valid_features) if project_id else 0
        job.status = IngestionJobStatus.IMPORTED.value if valid_features else IngestionJobStatus.FAILED.value
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        bbox = [min(lons), min(lats), max(lons), max(lats)] if lons and lats else None

        return {
            "job_id": str(job.id),
            "file_name": filename,
            "project_id": str(project_id) if project_id else None,
            "total_features": len(features),
            "valid_features": len(valid_features),
            "invalid_features": invalid_count,
            "geometry_types": list(geom_types),
            "geojson_preview": {
                "type": "FeatureCollection",
                "features": valid_features[:50],  # preview up to 50
            },
            "bounding_box": bbox,
            "message": f"Successfully validated {len(valid_features)} GIS spatial features." + (f" Linked to project {project_id} in PostGIS." if project_id else " Ready for assignment."),
        }

    # ─── 6. PDF / Document Extraction & Review ────────────────────────────────

    async def parse_and_extract_document(
        self,
        file_content: bytes,
        filename: str,
        document_type: str = "NOTIFICATION",
        project_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Extract text from PDF notifications/awards/SIA reports using pypdf,
        extract key structured fields using pattern heuristics, and prepare review screen.
        """
        try:
            reader = PdfReader(io.BytesIO(file_content))
            full_text_pages = [page.extract_text() or "" for page in reader.pages]
            full_text = "\n".join(full_text_pages)
        except Exception as e:
            raise ValueError(f"Could not read PDF document: {e}")

        extracted_fields: Dict[str, Any] = {}
        field_details: Dict[str, Any] = {}

        # 1. Gazette / Notification Reference Number
        # e.g., "S.O. 1234(E)", "Notification No. NHAI/123/2026"
        gazette_match = re.search(r"(?:S\.O\.|Notification\s+No\.?|Gazette\s+Ref\.?)\s*[:\s]*([A-Za-z0-9\/\(\)\-\.]+)", full_text, re.IGNORECASE)
        if gazette_match:
            val = gazette_match.group(1).strip()
            extracted_fields["notification_number"] = val
            field_details["notification_number"] = {"value": val, "confidence": 0.95, "source_snippet": gazette_match.group(0)}

        # 2. Notification Date
        # e.g. "Dated the 15th January, 2026" or "Date: 15/01/2026"
        date_match = re.search(r"(?:Dated|Date|New\s+Delhi,\s+the)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4})", full_text, re.IGNORECASE)
        if date_match:
            d_val = parse_date_safe(date_match.group(1))
            if d_val:
                extracted_fields["notification_date"] = str(d_val)
                field_details["notification_date"] = {"value": str(d_val), "confidence": 0.9, "source_snippet": date_match.group(0)}

        # 3. Highway / Project Name
        # e.g., "National Highway No. 44" or "NH-44" or "Expressway"
        nh_match = re.search(r"(?:National\s+Highway(?:\s+No\.?)?\s*(\d+[A-Z]?)|NH[- ]*(\d+[A-Z]?)|([A-Za-z\s\-]+Expressway))", full_text, re.IGNORECASE)
        if nh_match:
            nh_num = nh_match.group(1) or nh_match.group(2) or nh_match.group(3)
            p_name = f"National Highway {nh_num} Expansion" if not "expressway" in nh_num.lower() else nh_num.strip()
            extracted_fields["project_name"] = p_name
            field_details["project_name"] = {"value": p_name, "confidence": 0.85, "source_snippet": nh_match.group(0)}

        # 4. State & District
        for st_name, code in STANDARD_STATE_CODES.items():
            if len(st_name) > 3 and re.search(r"\b" + re.escape(st_name) + r"\b", full_text, re.IGNORECASE):
                extracted_fields["state_code"] = code
                field_details["state_code"] = {"value": code, "confidence": 0.92, "source_snippet": st_name}
                break

        dist_match = re.search(r"(?:District|Dist\.?)\s*[:\s]*([A-Za-z\s]+?)(?:,|\.|\n|State)", full_text, re.IGNORECASE)
        if dist_match:
            dist_val = dist_match.group(1).strip()
            if len(dist_val) < 40:
                extracted_fields["district"] = dist_val
                field_details["district"] = {"value": dist_val, "confidence": 0.85, "source_snippet": dist_match.group(0)}

        # 5. Land Area
        # e.g., "145.5000 Hectares" or "50 ha"
        area_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:Hectares?|ha|Acres?)", full_text, re.IGNORECASE)
        if area_match:
            area_val = float(area_match.group(1))
            extracted_fields["total_area_ha"] = area_val
            field_details["total_area_ha"] = {"value": area_val, "confidence": 0.88, "source_snippet": area_match.group(0)}

        # 6. Sanctioned Compensation / Award Amount
        cost_match = re.search(r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr|Lakhs?|Lakh)?", full_text, re.IGNORECASE)
        if cost_match:
            amt_str = cost_match.group(1).replace(",", "")
            try:
                amt = float(amt_str)
                if "crore" in cost_match.group(0).lower() or "cr" in cost_match.group(0).lower():
                    amt *= 10000000
                elif "lakh" in cost_match.group(0).lower():
                    amt *= 100000
                extracted_fields["estimated_compensation_inr"] = amt
                field_details["estimated_compensation_inr"] = {"value": amt, "confidence": 0.82, "source_snippet": cost_match.group(0)}
            except Exception:
                pass

        # Save document record with review status NEEDS_REVIEW
        upload_dir = Path(self.settings.INGESTION_UPLOAD_DIR)
        upload_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{uuid.uuid4()}_{re.sub(r'[^a-zA-Z0-9_.-]', '_', filename)}"
        file_path = upload_dir / safe_name
        with open(file_path, "wb") as f:
            f.write(file_content)

        doc = SourceDocument(
            document_type=document_type,
            file_name=filename,
            file_path=str(file_path),
            file_size_bytes=len(file_content),
            mime_type="application/pdf",
            extracted_text=full_text[:5000],  # store first 5k characters preview
            extracted_fields=extracted_fields,
            status="NEEDS_REVIEW",
            uploaded_by=user_id,
            project_id=project_id,
        )
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)

        return {
            "document_id": str(doc.id),
            "file_name": filename,
            "file_size_bytes": len(file_content),
            "document_type": document_type,
            "extracted_text_preview": full_text[:1000] + ("..." if len(full_text) > 1000 else ""),
            "extracted_fields": extracted_fields,
            "field_details": field_details,
            "suggested_project_id": str(project_id) if project_id else None,
            "review_status": doc.status,
        }

    async def confirm_document_extraction(
        self,
        document_id: uuid.UUID,
        confirmed_fields: Dict[str, Any],
        create_project: bool = True,
        project_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Save user-reviewed document fields into canonical database and trigger ML refresh."""
        doc = (await self.db.execute(select(SourceDocument).where(SourceDocument.id == document_id))).scalar_one_or_none()
        if not doc:
            raise LookupError("Document not found")

        doc.user_confirmed_fields = confirmed_fields
        doc.status = "CONFIRMED"
        doc.confirmed_at = datetime.now(timezone.utc)

        target_project_id = project_id or doc.project_id

        if create_project and not target_project_id:
            # Create a new Project from confirmed fields
            code = confirmed_fields.get("project_code") or f"DOC-{str(uuid.uuid4())[:8].upper()}"
            name = confirmed_fields.get("project_name") or f"Project from {doc.file_name}"
            state = confirmed_fields.get("state_code") or "DL"

            payload = {
                "project_code": code,
                "name": name,
                "state_code": state,
                "district_codes": [confirmed_fields.get("district")] if confirmed_fields.get("district") else [],
                "total_area_ha": confirmed_fields.get("total_area_ha"),
                "estimated_compensation_inr": confirmed_fields.get("estimated_compensation_inr"),
                "notification_3a_date": parse_date_safe(confirmed_fields.get("notification_date")),
            }
            normalized, errors = self.normalize_project_payload(payload)
            if errors:
                raise ValueError(f"Validation failed: {'; '.join(errors)}")

            proj = Project(
                **normalized,
                created_by=user_id,
                updated_by=user_id,
                status=ProjectStatus.ACTIVE,
            )
            self.db.add(proj)
            await self.db.flush()

            # Add stages
            for s_idx, (_, s_name) in enumerate(STAGES):
                stg = ProjectStage(
                    project_id=proj.id,
                    stage_name=s_name,
                    stage_order=s_idx + 1,
                    status=StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING,
                )
                self.db.add(stg)

            target_project_id = proj.id
            doc.project_id = proj.id

        await self.db.commit()

        # Trigger ML refresh
        ml_refreshed = False
        if target_project_id:
            try:
                await ensure_current_prediction(self.db, target_project_id)
                await self.db.commit()
                ml_refreshed = True
            except Exception as e:
                logger.warning(f"ML refresh skipped for document project {target_project_id}: {e}")

        return {
            "document_id": str(doc.id),
            "project_id": str(target_project_id) if target_project_id else None,
            "status": "CONFIRMED",
            "ml_refreshed": ml_refreshed,
            "message": f"Document confirmed and data incorporated into LADRIS.",
        }

    # ─── 7. Manual Form Ingestion ─────────────────────────────────────────────

    async def ingest_manual_record(
        self,
        entity_type: str,
        data: Dict[str, Any],
        user_id: Optional[uuid.UUID] = None,
        source_name: str = "Manual Form Entry",
        reporting_period: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Manually create or update projects, compensation, legal, R&R, stage, stakeholder, and GIS."""
        entity = entity_type.upper().strip()

        job = IngestionJob(
            job_type="MANUAL",
            source_name=source_name,
            source_type="MANUAL_ENTRY",
            status=IngestionJobStatus.IMPORTING.value,
            reporting_period=reporting_period,
            total_records=1,
            uploaded_by=user_id,
        )
        self.db.add(job)
        await self.db.flush()

        record_id = None
        project_id = None
        ml_refreshed = False
        ml_status = None

        if entity == "PROJECT":
            normalized, errors = self.normalize_project_payload(data)
            if errors:
                raise ValueError(f"Validation failed: {'; '.join(errors)}")

            # Check duplicate
            existing = (await self.db.execute(select(Project).where(Project.project_code == normalized["project_code"]))).scalar_one_or_none()
            if existing:
                raise ValueError(f"Project Code '{normalized['project_code']}' already exists.")

            proj = Project(
                **normalized,
                created_by=user_id,
                updated_by=user_id,
                status=ProjectStatus.ACTIVE,
            )
            self.db.add(proj)
            await self.db.flush()

            # Add default stages
            for s_idx, (_, s_name) in enumerate(STAGES):
                stg = ProjectStage(
                    project_id=proj.id,
                    stage_name=s_name,
                    stage_order=s_idx + 1,
                    status=StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING,
                )
                self.db.add(stg)

            record_id = str(proj.id)
            project_id = str(proj.id)

            # Sync CSV
            try:
                append_or_update_project_in_csv(proj, None)
            except Exception:
                pass

        elif entity == "COMPENSATION":
            pid_str = data.get("project_id")
            if not pid_str:
                raise ValueError("project_id is required for Compensation records.")
            proj_uuid = uuid.UUID(str(pid_str))

            sanctioned = parse_float_safe(data.get("awarded_amount_inr", 0)) or 0
            disbursed = parse_float_safe(data.get("disbursed_amount_inr", 0)) or 0
            if disbursed > sanctioned:
                raise ValueError(f"Disbursed compensation (₹{disbursed:,.2f}) cannot exceed sanctioned compensation (₹{sanctioned:,.2f}).")

            comp = CompensationRecord(
                project_id=proj_uuid,
                awarded_amount_inr=sanctioned,
                disbursed_amount_inr=disbursed,
                award_date=parse_date_safe(data.get("award_date")),
                disbursement_date=parse_date_safe(data.get("disbursement_date")),
            )
            self.db.add(comp)
            await self.db.flush()
            record_id = str(comp.id)
            project_id = str(proj_uuid)

        elif entity == "LEGAL_CASE":
            pid_str = data.get("project_id")
            if not pid_str:
                raise ValueError("project_id is required for Legal Case records.")
            proj_uuid = uuid.UUID(str(pid_str))

            legal = LegalCaseRecord(
                project_id=proj_uuid,
                case_status=str(data.get("case_status", "FILED")).upper(),
                filing_date=parse_date_safe(data.get("filing_date")),
                resolution_date=parse_date_safe(data.get("resolution_date")),
            )
            self.db.add(legal)
            await self.db.flush()
            record_id = str(legal.id)
            project_id = str(proj_uuid)

        elif entity == "RR_RECORD":
            pid_str = data.get("project_id")
            if not pid_str:
                raise ValueError("project_id is required for R&R records.")
            proj_uuid = uuid.UUID(str(pid_str))

            total_fam = parse_int_safe(data.get("total_families_to_rehabilitate"))
            relocated_fam = parse_int_safe(data.get("families_relocated"))
            if total_fam is not None and relocated_fam is not None and relocated_fam > total_fam:
                raise ValueError("Relocated families cannot exceed total families to rehabilitate.")

            rr = RehabilitationRecord(
                project_id=proj_uuid,
                total_families_to_rehabilitate=total_fam,
                families_relocated=relocated_fam,
                resettlement_site_ready=bool(data.get("resettlement_site_ready", False)),
            )
            self.db.add(rr)
            await self.db.flush()
            record_id = str(rr.id)
            project_id = str(proj_uuid)

        elif entity == "STAKEHOLDER":
            pid_str = data.get("project_id")
            if not pid_str:
                raise ValueError("project_id is required for Stakeholder records.")
            proj_uuid = uuid.UUID(str(pid_str))

            su = StakeholderUpdate(
                project_id=proj_uuid,
                stakeholder_role=str(data.get("stakeholder_role", "LANDOWNER")),
                update_date=parse_date_safe(data.get("update_date")) or datetime.now(timezone.utc),
                update_type=str(data.get("update_type", "MEETING")),
            )
            self.db.add(su)
            await self.db.flush()
            record_id = str(su.id)
            project_id = str(proj_uuid)

        elif entity == "GIS":
            pid_str = data.get("project_id")
            if not pid_str:
                raise ValueError("project_id is required for GIS records.")
            proj_uuid = uuid.UUID(str(pid_str))

            lat = parse_float_safe(data.get("latitude"))
            lng = parse_float_safe(data.get("longitude"))
            geom_expr = None
            if lat is not None and lng is not None:
                if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                    raise ValueError(f"Coordinates out of bounds: lat={lat}, lng={lng}")
                geom_expr = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326)

            parcel = LandParcel(
                project_id=proj_uuid,
                khasra_number=data.get("khasra_number"),
                village=data.get("village"),
                tehsil=data.get("tehsil"),
                district=data.get("district"),
                state_code=data.get("state_code"),
                area_ha=parse_float_safe(data.get("area_ha")),
                geom=geom_expr,
                properties=data,
            )
            self.db.add(parcel)
            await self.db.flush()
            record_id = str(parcel.id)
            project_id = str(proj_uuid)
        else:
            raise ValueError(f"Unknown entity type: '{entity}'")

        # Save Raw Record
        raw_rec = RawIngestionRecord(
            job_id=job.id,
            row_index=1,
            source_record_id=record_id,
            raw_payload=to_jsonable(data),
            validation_status=ValidationStatus.IMPORTED.value,
            target_entity=entity,
            target_id=uuid.UUID(record_id) if record_id else None,
        )
        self.db.add(raw_rec)

        job.status = IngestionJobStatus.IMPORTED.value
        job.valid_records = 1
        job.imported_records = 1
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # Trigger ML Refresh
        if project_id:
            try:
                res = await ensure_current_prediction(self.db, uuid.UUID(project_id))
                await self.db.commit()
                ml_refreshed = True
                ml_status = f"Prediction updated: Risk {res.get('risk_category')} ({res.get('risk_score')}/100)"
            except Exception as e:
                ml_status = "More data required for prediction."
                logger.info(f"ML prediction note for {project_id}: {e}")

        return {
            "success": True,
            "entity_type": entity,
            "record_id": record_id,
            "project_id": project_id,
            "message": f"Successfully ingested manual {entity.replace('_', ' ').title()} record.",
            "ml_refreshed": ml_refreshed,
            "ml_status": ml_status,
        }

    # ─── 8. External Database Import ──────────────────────────────────────────

    async def test_and_preview_database(
        self,
        connection_url: Optional[str],
        table_name: str,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """Safely connect to external database and preview table rows."""
        db_url = connection_url or self.settings.EXTERNAL_DB_URL
        if not db_url:
            raise ValueError("No database connection URL provided and EXTERNAL_DB_URL is empty in settings.")

        # Sanitize / ensure asyncpg if postgresql
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        ext_engine = create_async_engine(db_url, pool_pre_ping=True)
        try:
            async with ext_engine.connect() as conn:
                # Query table columns
                res = await conn.execute(text(f"SELECT * FROM {table_name} LIMIT {limit}"))
                cols = list(res.keys())
                rows = [dict(r._mapping) for r in res.fetchall()]

                # Clean datetime for JSON
                for r in rows:
                    for k, v in r.items():
                        if isinstance(v, (datetime, date)):
                            r[k] = str(v)
                        elif isinstance(v, uuid.UUID):
                            r[k] = str(v)

                return {
                    "success": True,
                    "columns": cols,
                    "sample_rows": rows,
                    "total_rows_approx": len(rows),
                }
        finally:
            await ext_engine.dispose()
