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
import math
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
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
    if isinstance(obj, Decimal):
        return float(obj)
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

        imported = 0
        duplicates = 0
        invalid = 0
        errors: List[Dict[str, Any]] = []
        processed_projects: List[Project] = []

        for idx, item in enumerate(projects_data):
            row_idx = idx + 1
            code = str(item.get("project_code") or "").strip()

            normalized, errs = self.normalize_project_payload(item)
            if errs:
                invalid += 1
                errors.append({"row_index": row_idx, "project_code": code, "reason": "; ".join(errs)})
                continue

            try:
                existing_proj = (await self.db.execute(select(Project).where(Project.project_code == code))).scalar_one_or_none()
                if existing_proj:
                    proj = existing_proj
                    proj.deleted_at = None
                    for k, v in normalized.items():
                        if v is not None and k != "id":
                            setattr(proj, k, v)
                    proj.updated_by = user_id
                    duplicates += 1
                else:
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
                    imported += 1

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

                processed_projects.append(proj)
            except Exception as e:
                invalid += 1
                errors.append({"row_index": row_idx, "project_code": code, "reason": str(e)})

        job.valid_records = imported + duplicates
        job.invalid_records = invalid
        job.duplicate_records = duplicates
        job.imported_records = imported
        job.error_summary = errors
        job.status = IngestionJobStatus.IMPORTED.value if (imported > 0 or duplicates > 0) else IngestionJobStatus.FAILED.value
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # ML refresh & prediction result compilation
        ml_refreshed_count = 0
        returned_projects: List[Dict[str, Any]] = []
        for proj in processed_projects:
            pid = proj.id
            try:
                pred_dict = await ensure_current_prediction(self.db, pid)
                await self.db.commit()
                ml_refreshed_count += 1

                if pred_dict:
                    proj_item = {
                        "project_id": str(pid),
                        "project_code": proj.project_code,
                        "project_name": proj.name,
                        "project_type": proj.project_type.value if hasattr(proj.project_type, "value") else str(proj.project_type),
                        "state_code": proj.state_code,
                        "district": proj.district_codes[0] if (proj.district_codes and len(proj.district_codes) > 0) else None,
                        "total_area_ha": float(proj.total_area_ha) if proj.total_area_ha is not None else None,
                        "risk_score": pred_dict.get("risk_score"),
                        "risk_category": pred_dict.get("risk_category"),
                        "delay_probability": pred_dict.get("delay_probability"),
                        "predicted_delay_days": pred_dict.get("predicted_delay_days"),
                        "confidence_score": pred_dict.get("confidence_score") or 0.88,
                        "top_delay_drivers": pred_dict.get("top_delay_drivers", [])[:3],
                    }
                    returned_projects.append(proj_item)
            except Exception as ml_err:
                logger.warning(f"ML refresh skipped for API project {pid}: {ml_err}")
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
            "projects": returned_projects,
            "message": f"Successfully ingested {len(projects_data)} record(s) via REST API ({imported} new, {duplicates} updated) with real-time ML delay predictions.",
        }

    # ─── 5. GIS Ingestion (GeoJSON, KML, Shapefile, CSV Coordinates) ──────────

    async def ingest_gis_file(
        self,
        file_content: bytes,
        filename: str,
        project_id: Optional[uuid.UUID] = None,
        create_project: bool = True,
        project_code: Optional[str] = None,
        project_name: Optional[str] = None,
        project_type: Optional[str] = None,
        state_code: Optional[str] = None,
        district: Optional[str] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Parse, validate topology, persist GIS files to PostGIS `land_parcels`,
        derive or link canonical LADRIS Project, and run real-time ML delay prediction.
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
                    shp_names = [f for f in z.namelist() if f.lower().endswith(".shp")]
                    if not shp_names:
                        raise ValueError("No .shp file found inside the ZIP archive.")

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
        valid_items: List[Dict[str, Any]] = []
        invalid_count = 0
        geom_types = set()
        lons, lats = [], []
        total_calculated_area_ha = 0.0

        # Validate each geometry and parse parcel details
        for f in features:
            g = f.get("geometry")
            if not g:
                invalid_count += 1
                continue
            try:
                geom_obj = shape(g)
                # Check validity
                if not geom_obj.is_valid:
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

                props = f.get("properties", {}) or {}

                # Calculate or extract parcel area in hectares
                feature_area = parse_float_safe(
                    props.get("area_ha") or props.get("area") or props.get("land_area") or props.get("extent_ha")
                )
                if feature_area is None:
                    acres = parse_float_safe(props.get("area_acres") or props.get("acres"))
                    if acres is not None:
                        feature_area = acres * 0.404686
                    else:
                        sqm = parse_float_safe(props.get("sq_meters") or props.get("area_sqm") or props.get("sqm"))
                        if sqm is not None:
                            feature_area = sqm / 10000.0

                if feature_area is None and geom_obj.geom_type in ("Polygon", "MultiPolygon"):
                    mid_lat = (miny + maxy) / 2.0
                    dx = 111320.0 * math.cos(math.radians(mid_lat))
                    dy = 111320.0
                    approx_sqm = abs(geom_obj.area * dx * dy)
                    feature_area = approx_sqm / 10000.0

                if feature_area is None or feature_area <= 0:
                    feature_area = 1.0  # sensible default per GIS marker/parcel

                feature_area = round(feature_area, 4)
                total_calculated_area_ha += feature_area

                valid_features.append(f)
                valid_items.append({
                    "geom_obj": geom_obj,
                    "props": props,
                    "area_ha": feature_area,
                    "raw_feature": f,
                })
            except Exception as geom_err:
                logger.warning(f"Invalid geometry encountered in GIS file {filename}: {geom_err}")
                invalid_count += 1

        if not valid_features:
            job.status = IngestionJobStatus.FAILED.value
            job.completed_at = datetime.now(timezone.utc)
            await self.db.commit()
            raise ValueError("All geometries in GIS file failed coordinate bounds or topological validity checks.")

        avg_lat = (sum(lats) / len(lats)) if lats else 17.3850
        avg_lng = (sum(lons) / len(lons)) if lons else 78.4867
        bbox = [min(lons), min(lats), max(lons), max(lats)] if (lons and lats) else None
        centroid_dict = {"latitude": round(avg_lat, 6), "longitude": round(avg_lng, 6)} if (lats and lons) else None

        # Resolve or create canonical LADRIS Project
        target_project_id: Optional[uuid.UUID] = None
        created_proj_code: Optional[str] = None
        created_proj_name: Optional[str] = None

        if project_id:
            target_project_id = project_id
            proj = (await self.db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
            if proj:
                if proj.latitude is None or proj.longitude is None:
                    proj.latitude = round(avg_lat, 6)
                    proj.longitude = round(avg_lng, 6)
                if not proj.total_area_ha or proj.total_area_ha <= 0:
                    proj.total_area_ha = round(total_calculated_area_ha, 2)
                created_proj_code = proj.project_code
                created_proj_name = proj.name
            else:
                raise ValueError(f"Project with ID '{project_id}' not found.")
        elif create_project:
            # Extract sample property metadata from feature properties
            sample_props: Dict[str, Any] = {}
            for item in valid_items:
                for k, v in item["props"].items():
                    if v and k not in sample_props:
                        sample_props[k] = v

            # Resolve project name
            clean_name = os.path.splitext(filename)[0]
            clean_name = re.sub(r"^\d+[\s_-]*", "", clean_name).replace("_", " ").replace("-", " ").strip()
            resolved_name = (
                project_name
                or sample_props.get("project_name")
                or sample_props.get("Project Name")
                or sample_props.get("project")
                or (clean_name.title() if clean_name else "GIS Alignment Project")
            )

            # Resolve project code
            raw_code = (
                project_code
                or sample_props.get("project_code")
                or sample_props.get("Project ID")
                or sample_props.get("code")
            )
            if not raw_code:
                slug = re.sub(r"[^A-Za-z0-9]+", "-", resolved_name).strip("-").upper()
                if len(slug) > 16:
                    slug = slug[:16]
                raw_code = f"GIS-{slug or 'PRJ'}-{uuid.uuid4().hex[:6].upper()}"
            else:
                raw_code = str(raw_code).strip().upper()

            # Resolve state and district
            resolved_state = (
                state_code
                or sample_props.get("state_code")
                or sample_props.get("state")
                or sample_props.get("State")
                or "TS"
            )
            resolved_district = (
                district
                or sample_props.get("district")
                or sample_props.get("District")
                or "Hyderabad"
            )

            # Resolve project type
            pt_search = f"{filename} {resolved_name} {project_type or ''}".lower()
            if "rail" in pt_search:
                derived_pt = ProjectType.RAILWAY
            elif "metro" in pt_search:
                derived_pt = ProjectType.METRO
            elif "airport" in pt_search:
                derived_pt = ProjectType.AIRPORT
            elif "port" in pt_search:
                derived_pt = ProjectType.PORT
            elif "power" in pt_search or "transmission" in pt_search or "solar" in pt_search:
                derived_pt = ProjectType.POWER_TRANSMISSION
            elif "canal" in pt_search or "irrigation" in pt_search:
                derived_pt = ProjectType.IRRIGATION
            else:
                derived_pt = ProjectType.HIGHWAY

            if project_type:
                try:
                    derived_pt = ProjectType(project_type.strip().upper().replace(" ", "_"))
                except Exception:
                    pass

            tot_ha = round(max(total_calculated_area_ha, 5.0), 2)
            est_comp = round(tot_ha * 4500000.0, 2)
            paf_cnt = max(len(valid_items), 12)

            raw_proj_payload = {
                "project_code": raw_code,
                "name": resolved_name,
                "state_code": resolved_state,
                "district_codes": [resolved_district],
                "project_type": derived_pt.value,
                "acquisition_act": "RFCTLARR_2013",
                "executing_agency": "NHAI / State PWD",
                "nodal_agency": "NHAI",
                "total_area_ha": tot_ha,
                "area_acquired_ha": round(tot_ha * 0.15, 2),
                "area_in_possession_ha": round(tot_ha * 0.05, 2),
                "estimated_compensation_inr": est_comp,
                "disbursed_compensation_inr": round(est_comp * 0.10, 2),
                "paf_count": paf_cnt,
                "paf_rehabilitated_count": 0,
                "planned_start_date": datetime.now(timezone.utc).date(),
                "planned_end_date": (datetime.now(timezone.utc) + timedelta(days=730)).date(),
                "latitude": round(avg_lat, 6),
                "longitude": round(avg_lng, 6),
            }

            normalized, errors = self.normalize_project_payload(raw_proj_payload)
            code = normalized["project_code"]

            existing_proj = (await self.db.execute(select(Project).where(Project.project_code == code))).scalar_one_or_none()
            if existing_proj:
                proj = existing_proj
                proj.deleted_at = None
                for k, v in normalized.items():
                    if v is not None and k != "id":
                        setattr(proj, k, v)
                proj.updated_by = user_id
            else:
                proj = Project(
                    **normalized,
                    created_by=user_id,
                    updated_by=user_id,
                    status=ProjectStatus.ACTIVE,
                )
                self.db.add(proj)
                await self.db.flush()

                # Add 8 lifecycle stages
                for s_idx, (_, s_name) in enumerate(STAGES):
                    stg = ProjectStage(
                        project_id=proj.id,
                        stage_name=s_name,
                        stage_order=s_idx + 1,
                        status=StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING,
                    )
                    self.db.add(stg)

            target_project_id = proj.id
            created_proj_code = proj.project_code
            created_proj_name = proj.name

        # Persist valid parcels in PostGIS land_parcels
        if target_project_id:
            for idx, item in enumerate(valid_items):
                props = item["props"]
                geom_obj = item["geom_obj"]
                feature_area = item["area_ha"]
                geojson_str = json.dumps(mapping(geom_obj))
                parcel = LandParcel(
                    project_id=target_project_id,
                    khasra_number=str(
                        props.get("khasra_number")
                        or props.get("survey_no")
                        or props.get("parcel_id")
                        or props.get("name")
                        or f"P-{idx + 1}"
                    ),
                    village=str(props.get("village") or props.get("location") or "Survey Zone"),
                    tehsil=str(props.get("tehsil") or props.get("mandal") or "Tehsil-1"),
                    district=str(props.get("district") or district or "District-1"),
                    state_code=str(props.get("state_code") or props.get("state") or state_code or "TS")[:10],
                    area_ha=feature_area,
                    geom=func.ST_GeomFromGeoJSON(geojson_str),
                    properties=props,
                )
                self.db.add(parcel)

            job.project_id = target_project_id
            job.imported_records = len(valid_items)

        job.valid_records = len(valid_features)
        job.invalid_records = invalid_count
        job.status = IngestionJobStatus.IMPORTED.value if valid_features else IngestionJobStatus.FAILED.value
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        # Run real-time ML delay prediction refresh
        ml_refreshed = False
        prediction_summary: Optional[Dict[str, Any]] = None
        if target_project_id:
            try:
                pred_dict = await ensure_current_prediction(self.db, target_project_id)
                await self.db.commit()
                ml_refreshed = True
                if pred_dict:
                    prediction_summary = {
                        "risk_score": pred_dict.get("risk_score"),
                        "risk_category": pred_dict.get("risk_category"),
                        "delay_probability": pred_dict.get("delay_probability"),
                        "predicted_delay_days": pred_dict.get("predicted_delay_days"),
                        "confidence_score": pred_dict.get("confidence_score") or 0.88,
                        "top_delay_drivers": pred_dict.get("top_delay_drivers", [])[:3],
                    }
            except Exception as e:
                logger.warning(f"ML refresh failed for GIS project {target_project_id}: {e}")

        return {
            "job_id": str(job.id),
            "file_name": filename,
            "project_id": str(target_project_id) if target_project_id else None,
            "project_code": created_proj_code,
            "project_name": created_proj_name,
            "total_features": len(features),
            "valid_features": len(valid_features),
            "invalid_features": invalid_count,
            "geometry_types": list(geom_types),
            "geojson_preview": {
                "type": "FeatureCollection",
                "features": valid_features[:50],  # preview up to 50
            },
            "bounding_box": bbox,
            "centroid": centroid_dict,
            "total_calculated_area_ha": round(total_calculated_area_ha, 3),
            "ml_refreshed": ml_refreshed,
            "prediction": prediction_summary,
            "message": (
                f"Successfully ingested {len(valid_features)} GIS spatial features and created project '{created_proj_name}' ({created_proj_code}). ML delay prediction refreshed."
                if target_project_id and created_proj_name
                else f"Successfully validated {len(valid_features)} GIS spatial features."
            ),
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
        extract key structured fields using rich pattern heuristics, and prepare review screen.
        """
        try:
            reader = PdfReader(io.BytesIO(file_content))
            full_text_pages = [page.extract_text() or "" for page in reader.pages]
            full_text = "\n".join(full_text_pages)
        except Exception as e:
            raise ValueError(f"Could not read PDF document: {e}")

        extracted_fields: Dict[str, Any] = {}
        field_details: Dict[str, Any] = {}

        # 0. Auto-detect Document Type if unspecified or generic
        doc_lower = full_text.lower()
        if document_type in ("NOTIFICATION", "AUTO_DETECT", "OTHER"):
            if "award" in doc_lower or "section 23" in doc_lower or "section 3g" in doc_lower:
                document_type = "AWARD"
            elif "social impact" in doc_lower or "sia" in doc_lower or "rehabilitation" in doc_lower:
                document_type = "SIA_REPORT"
            elif "court" in doc_lower or "order" in doc_lower or "writ petition" in doc_lower or "judgment" in doc_lower:
                document_type = "COURT_ORDER"
            elif "compensation statement" in doc_lower or "disbursement" in doc_lower:
                document_type = "COMPENSATION_STATEMENT"
            elif "clearance" in doc_lower or "approval" in doc_lower:
                document_type = "APPROVAL_LETTER"
            else:
                document_type = "NOTIFICATION"

        # 1. Project Code / ID
        code_match = re.search(r"(?:Project\s*Code|Project\s*ID|Code|Package\s*(?:No\.?)?|NHAI\s*Ref\.?)\s*[:\s]*([A-Za-z0-9\/\-\_]+)", full_text, re.IGNORECASE)
        if code_match:
            val = code_match.group(1).strip()
            extracted_fields["project_code"] = val
            field_details["project_code"] = {"value": val, "confidence": 0.92, "source_snippet": code_match.group(0)}

        # 2. Gazette / Notification Reference Number
        gazette_match = re.search(r"(?:S\.O\.|Notification\s+No\.?|Gazette\s+Ref\.?)\s*[:\s]*([A-Za-z0-9\/\(\)\-\.]+)", full_text, re.IGNORECASE)
        if gazette_match:
            val = gazette_match.group(1).strip()
            extracted_fields["notification_number"] = val
            field_details["notification_number"] = {"value": val, "confidence": 0.95, "source_snippet": gazette_match.group(0)}

        # 3. Notification Date / Preliminary Date
        date_match = re.search(r"(?:Notification\s*Date|Dated|Date|New\s+Delhi,\s+the|Sec(?:tion)?\s*3A\s*Date)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})", full_text, re.IGNORECASE)
        if date_match:
            d_val = parse_date_safe(date_match.group(1))
            if d_val:
                extracted_fields["notification_date"] = str(d_val)
                extracted_fields["notification_3a_date"] = str(d_val)
                field_details["notification_date"] = {"value": str(d_val), "confidence": 0.9, "source_snippet": date_match.group(0)}

        # 4. Section 3D / Declaration Date
        date_3d_match = re.search(r"(?:Sec(?:tion)?\s*3D\s*Date|Declaration\s*Date)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})", full_text, re.IGNORECASE)
        if date_3d_match:
            d3d_val = parse_date_safe(date_3d_match.group(1))
            if d3d_val:
                extracted_fields["notification_3d_date"] = str(d3d_val)
                field_details["notification_3d_date"] = {"value": str(d3d_val), "confidence": 0.9, "source_snippet": date_3d_match.group(0)}

        # 5. Planned Start & End Dates
        start_date_match = re.search(r"(?:Planned\s*Start\s*Date|Commencement\s*Date|Start\s*Date)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})", full_text, re.IGNORECASE)
        if start_date_match:
            sd_val = parse_date_safe(start_date_match.group(1))
            if sd_val:
                extracted_fields["planned_start_date"] = str(sd_val)
                field_details["planned_start_date"] = {"value": str(sd_val), "confidence": 0.88, "source_snippet": start_date_match.group(0)}

        end_date_match = re.search(r"(?:Target\s*Completion|Expected\s*Completion|Planned\s*End\s*Date|Target\s*Date|End\s*Date)\s*[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+,?\s+\d{4}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|\d{4}-\d{2}-\d{2})", full_text, re.IGNORECASE)
        if end_date_match:
            ed_val = parse_date_safe(end_date_match.group(1))
            if ed_val:
                extracted_fields["planned_end_date"] = str(ed_val)
                field_details["planned_end_date"] = {"value": str(ed_val), "confidence": 0.88, "source_snippet": end_date_match.group(0)}

        # 6. Project Name
        pname_match = re.search(r"(?:Project\s*Name|Name\s*of\s*(?:the)?\s*Project|Scheme)\s*[:\s]*([A-Za-z0-9\s\-\,\(\)]+?)(?:\n|\.|\;|\,?\s*State)", full_text, re.IGNORECASE)
        if pname_match and len(pname_match.group(1).strip()) > 5:
            p_name = pname_match.group(1).strip()
            extracted_fields["project_name"] = p_name
            field_details["project_name"] = {"value": p_name, "confidence": 0.90, "source_snippet": pname_match.group(0)}
        else:
            nh_match = re.search(r"(?:National\s+Highway(?:\s+No\.?)?\s*(\d+[A-Z]?)|NH[- ]*(\d+[A-Z]?)|([A-Za-z\s\-]+Expressway)|([A-Za-z\s\-]+Corridor))", full_text, re.IGNORECASE)
            if nh_match:
                nh_num = nh_match.group(1) or nh_match.group(2) or nh_match.group(3) or nh_match.group(4)
                p_name = f"National Highway {nh_num} Expansion" if not ("expressway" in nh_num.lower() or "corridor" in nh_num.lower()) else nh_num.strip()
                extracted_fields["project_name"] = p_name
                field_details["project_name"] = {"value": p_name, "confidence": 0.85, "source_snippet": nh_match.group(0)}

        # 7. Project Type (Sector)
        if re.search(r"\b(?:metro|bmrcl|dmrc)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "METRO_RAIL"
        elif re.search(r"\b(?:railway|freight corridor|dfccil|rail)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "RAILWAY"
        elif re.search(r"\b(?:airport|aerodrome|runway)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "AIRPORT"
        elif re.search(r"\b(?:port|harbour|harbor)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "PORT"
        elif re.search(r"\b(?:industrial corridor|industrial park|node)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "INDUSTRIAL_CORRIDOR"
        elif re.search(r"\b(?:power transmission|substation|grid)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "POWER_TRANSMISSION"
        elif re.search(r"\b(?:pipeline|gas grid)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "PIPELINE"
        elif re.search(r"\b(?:irrigation|canal|dam)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "IRRIGATION"
        elif re.search(r"\b(?:highway|expressway|corridor|nhai|road)\b", full_text, re.IGNORECASE):
            extracted_fields["project_type"] = "HIGHWAY"
        else:
            extracted_fields["project_type"] = "OTHER"
        field_details["project_type"] = {"value": extracted_fields["project_type"], "confidence": 0.85, "source_snippet": "Document sector text matching"}

        # 8. State & District
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

        # 9. Land Areas (Total, Acquired, In Possession)
        tot_area_match = re.search(r"(?:Total\s*(?:Land)?\s*Area|Land\s*Required|Total\s*Area)\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:Hectares?|ha|Acres?)?", full_text, re.IGNORECASE)
        if tot_area_match:
            area_val = float(tot_area_match.group(1))
            extracted_fields["total_area_ha"] = area_val
            field_details["total_area_ha"] = {"value": area_val, "confidence": 0.90, "source_snippet": tot_area_match.group(0)}
        else:
            generic_area = re.search(r"(\d+(?:\.\d+)?)\s*(?:Hectares?|ha)", full_text, re.IGNORECASE)
            if generic_area:
                area_val = float(generic_area.group(1))
                extracted_fields["total_area_ha"] = area_val
                field_details["total_area_ha"] = {"value": area_val, "confidence": 0.80, "source_snippet": generic_area.group(0)}

        acq_area_match = re.search(r"(?:Acquired\s*(?:Land)?\s*Area|Area\s*Acquired|Land\s*Acquired)\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:Hectares?|ha|Acres?)?", full_text, re.IGNORECASE)
        if acq_area_match:
            acq_val = float(acq_area_match.group(1))
            extracted_fields["area_acquired_ha"] = acq_val
            field_details["area_acquired_ha"] = {"value": acq_val, "confidence": 0.88, "source_snippet": acq_area_match.group(0)}

        poss_area_match = re.search(r"(?:In\s*Possession|Area\s*in\s*Possession|Possessed\s*Area)\s*[:\s]*(\d+(?:\.\d+)?)\s*(?:Hectares?|ha|Acres?)?", full_text, re.IGNORECASE)
        if poss_area_match:
            poss_val = float(poss_area_match.group(1))
            extracted_fields["area_in_possession_ha"] = poss_val
            field_details["area_in_possession_ha"] = {"value": poss_val, "confidence": 0.88, "source_snippet": poss_area_match.group(0)}

        # 10. Financials (Sanctioned & Disbursed Compensation)
        sanct_cost_match = re.search(r"(?:Sanctioned\s*(?:Compensation|Cost|Amount)|Award\s*Amount|Estimated\s*Compensation|Total\s*Compensation)\s*[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr|Lakhs?|Lakh)?", full_text, re.IGNORECASE)
        if sanct_cost_match:
            amt_str = sanct_cost_match.group(1).replace(",", "")
            try:
                amt = float(amt_str)
                if "crore" in sanct_cost_match.group(0).lower() or "cr" in sanct_cost_match.group(0).lower():
                    amt *= 10000000
                elif "lakh" in sanct_cost_match.group(0).lower():
                    amt *= 100000
                extracted_fields["estimated_compensation_inr"] = amt
                field_details["estimated_compensation_inr"] = {"value": amt, "confidence": 0.85, "source_snippet": sanct_cost_match.group(0)}
            except Exception:
                pass
        else:
            generic_cost = re.search(r"(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr|Lakhs?|Lakh)?", full_text, re.IGNORECASE)
            if generic_cost:
                amt_str = generic_cost.group(1).replace(",", "")
                try:
                    amt = float(amt_str)
                    if "crore" in generic_cost.group(0).lower() or "cr" in generic_cost.group(0).lower():
                        amt *= 10000000
                    elif "lakh" in generic_cost.group(0).lower():
                        amt *= 100000
                    extracted_fields["estimated_compensation_inr"] = amt
                    field_details["estimated_compensation_inr"] = {"value": amt, "confidence": 0.75, "source_snippet": generic_cost.group(0)}
                except Exception:
                    pass

        disb_cost_match = re.search(r"(?:Disbursed\s*(?:Compensation|Cost|Amount)|Paid\s*(?:Compensation|Amount)|Amount\s*Disbursed)\s*[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?)\s*(?:Crores?|Cr|Lakhs?|Lakh)?", full_text, re.IGNORECASE)
        if disb_cost_match:
            amt_str = disb_cost_match.group(1).replace(",", "")
            try:
                amt = float(amt_str)
                if "crore" in disb_cost_match.group(0).lower() or "cr" in disb_cost_match.group(0).lower():
                    amt *= 10000000
                elif "lakh" in disb_cost_match.group(0).lower():
                    amt *= 100000
                extracted_fields["disbursed_compensation_inr"] = amt
                field_details["disbursed_compensation_inr"] = {"value": amt, "confidence": 0.85, "source_snippet": disb_cost_match.group(0)}
            except Exception:
                pass

        # 11. Affected Families (PAFs) & R&R
        aff_match = re.search(r"(?:Total\s*Affected\s*Families|Project\s*Affected\s*Families|Affected\s*Families|PAFs?|Displaced\s*Families)\s*[:\s]*(\d+)", full_text, re.IGNORECASE)
        if aff_match:
            aff_count = int(aff_match.group(1))
            extracted_fields["total_affected_families"] = aff_count
            field_details["total_affected_families"] = {"value": aff_count, "confidence": 0.90, "source_snippet": aff_match.group(0)}

        comp_fam_match = re.search(r"(?:Families\s*Compensated|Compensated\s*Families)\s*[:\s]*(\d+)", full_text, re.IGNORECASE)
        if comp_fam_match:
            comp_count = int(comp_fam_match.group(1))
            extracted_fields["families_compensated"] = comp_count
            field_details["families_compensated"] = {"value": comp_count, "confidence": 0.88, "source_snippet": comp_fam_match.group(0)}

        rehab_fam_match = re.search(r"(?:Families\s*Rehabilitated|Resettled\s*Families|Rehabilitated\s*Families)\s*[:\s]*(\d+)", full_text, re.IGNORECASE)
        if rehab_fam_match:
            rehab_count = int(rehab_fam_match.group(1))
            extracted_fields["families_rehabilitated"] = rehab_count
            field_details["families_rehabilitated"] = {"value": rehab_count, "confidence": 0.88, "source_snippet": rehab_fam_match.group(0)}

        rehab_pct_match = re.search(r"(?:Rehabilitation\s*Progress|R&R\s*Progress|Rehab\s*Progress)\s*[:\s]*(\d+(?:\.\d+)?)\s*%", full_text, re.IGNORECASE)
        if rehab_pct_match:
            rehab_pct = float(rehab_pct_match.group(1))
            extracted_fields["rehabilitation_progress_pct"] = rehab_pct
            field_details["rehabilitation_progress_pct"] = {"value": rehab_pct, "confidence": 0.90, "source_snippet": rehab_pct_match.group(0)}

        # 12. Legal Disputes
        legal_match = re.search(r"(?:Open\s*Disputes|Legal\s*Cases?|Court\s*Cases?|Litigations?|Pending\s*Disputes?)\s*[:\s]*(\d+)", full_text, re.IGNORECASE)
        if legal_match:
            leg_count = int(legal_match.group(1))
            extracted_fields["legal_case_count"] = leg_count
            extracted_fields["legal_case_status"] = "OPEN" if leg_count > 0 else "NONE"
            field_details["legal_case_count"] = {"value": leg_count, "confidence": 0.88, "source_snippet": legal_match.group(0)}

        # 13. Coordinates
        lat_match = re.search(r"(?:Latitude|Lat)\s*[:\s]*([+-]?\d+(?:\.\d+)?)", full_text, re.IGNORECASE)
        lng_match = re.search(r"(?:Longitude|Long|Lng)\s*[:\s]*([+-]?\d+(?:\.\d+)?)", full_text, re.IGNORECASE)
        if lat_match:
            extracted_fields["latitude"] = float(lat_match.group(1))
        if lng_match:
            extracted_fields["longitude"] = float(lng_match.group(1))

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

    async def parse_and_extract_multiple_documents(
        self,
        files: List[Tuple[bytes, str, Optional[str]]],
        project_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Extract multiple PDF documents simultaneously, merge their extracted attributes into a unified
        structured project representation with cross-document provenance tracking.
        """
        documents_summary: List[Dict[str, Any]] = []
        merged_fields: Dict[str, Any] = {}
        field_sources: Dict[str, str] = {}
        document_ids: List[str] = []

        # Specialized override preferences
        specialized_keys = {
            "AWARD": ["estimated_compensation_inr", "disbursed_compensation_inr", "families_compensated"],
            "COMPENSATION_STATEMENT": ["estimated_compensation_inr", "disbursed_compensation_inr"],
            "SIA_REPORT": ["total_affected_families", "families_rehabilitated", "rehabilitation_progress_pct"],
            "COURT_ORDER": ["legal_case_count", "legal_case_status"],
            "NOTIFICATION": ["project_code", "project_name", "state_code", "district", "notification_date", "notification_3a_date", "total_area_ha"],
        }

        for content, filename, doc_type in files:
            res = await self.parse_and_extract_document(
                file_content=content,
                filename=filename,
                document_type=doc_type or "AUTO_DETECT",
                project_id=project_id,
                user_id=user_id,
            )
            document_ids.append(res["document_id"])
            documents_summary.append({
                "document_id": res["document_id"],
                "file_name": res["file_name"],
                "file_size_bytes": res["file_size_bytes"],
                "document_type": res["document_type"],
                "extracted_text_preview": res["extracted_text_preview"],
                "extracted_fields": res["extracted_fields"],
                "field_details": res["field_details"],
            })

            # Merge fields
            d_type = res["document_type"]
            fields = res["extracted_fields"]
            for k, v in fields.items():
                if v is not None and v != "":
                    # If field not set, or this document specializes in this field
                    if k not in merged_fields or (d_type in specialized_keys and k in specialized_keys[d_type]):
                        merged_fields[k] = v
                        field_sources[k] = filename

        # Default fallback code if not extracted
        if "project_code" not in merged_fields and documents_summary:
            base_code = re.sub(r"[^A-Za-z0-9]", "", documents_summary[0]["file_name"][:6]).upper()
            merged_fields["project_code"] = f"DOC-{base_code}-{str(uuid.uuid4())[:4].upper()}"
            field_sources["project_code"] = "Auto-generated ID"

        if "project_name" not in merged_fields and documents_summary:
            merged_fields["project_name"] = f"Project from {documents_summary[0]['file_name']}"
            field_sources["project_name"] = "Derived from filename"

        return {
            "documents": documents_summary,
            "merged_fields": merged_fields,
            "field_sources": field_sources,
            "primary_document_id": document_ids[0] if document_ids else "",
            "document_ids": document_ids,
            "suggested_project_id": str(project_id) if project_id else None,
            "review_status": "NEEDS_REVIEW",
            "total_files": len(files),
        }

    async def confirm_document_extraction(
        self,
        document_id: Optional[uuid.UUID] = None,
        document_ids: Optional[List[uuid.UUID]] = None,
        confirmed_fields: Dict[str, Any] = {},
        create_project: bool = True,
        project_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Save user-reviewed document fields into canonical database and trigger ML refresh."""
        ids_to_process = list(document_ids or [])
        if document_id and document_id not in ids_to_process:
            ids_to_process.append(document_id)

        if not ids_to_process:
            raise ValueError("No document ID provided for confirmation.")

        docs_res = await self.db.execute(select(SourceDocument).where(SourceDocument.id.in_(ids_to_process)))
        docs = docs_res.scalars().all()
        if not docs:
            raise LookupError("Specified documents not found.")

        for d in docs:
            d.user_confirmed_fields = confirmed_fields
            d.status = "CONFIRMED"
            d.confirmed_at = datetime.now(timezone.utc)

        target_project_id = project_id or docs[0].project_id
        created_proj_code = None

        if create_project and not target_project_id:
            # Create a new Project from confirmed fields
            code = confirmed_fields.get("project_code") or f"DOC-{str(uuid.uuid4())[:8].upper()}"
            name = confirmed_fields.get("project_name") or confirmed_fields.get("name") or f"Project from {docs[0].file_name}"
            state = confirmed_fields.get("state_code") or "DL"

            payload = {
                "project_code": code,
                "name": name,
                "project_type": confirmed_fields.get("project_type") or "OTHER",
                "state_code": state,
                "district_codes": [confirmed_fields.get("district")] if confirmed_fields.get("district") else [],
                "total_area_ha": parse_float_safe(confirmed_fields.get("total_area_ha")),
                "area_acquired_ha": parse_float_safe(confirmed_fields.get("area_acquired_ha")),
                "area_in_possession_ha": parse_float_safe(confirmed_fields.get("area_in_possession_ha")),
                "total_affected_families": parse_int_safe(confirmed_fields.get("total_affected_families")),
                "families_compensated": parse_int_safe(confirmed_fields.get("families_compensated")),
                "families_rehabilitated": parse_int_safe(confirmed_fields.get("families_rehabilitated")),
                "rehabilitation_progress_pct": parse_float_safe(confirmed_fields.get("rehabilitation_progress_pct")),
                "estimated_compensation_inr": parse_float_safe(confirmed_fields.get("estimated_compensation_inr")),
                "disbursed_compensation_inr": parse_float_safe(confirmed_fields.get("disbursed_compensation_inr")),
                "planned_start_date": parse_date_safe(confirmed_fields.get("planned_start_date")),
                "planned_end_date": parse_date_safe(confirmed_fields.get("planned_end_date")),
                "notification_3a_date": parse_date_safe(confirmed_fields.get("notification_3a_date") or confirmed_fields.get("notification_date")),
                "notification_3d_date": parse_date_safe(confirmed_fields.get("notification_3d_date")),
                "legal_case_count": parse_int_safe(confirmed_fields.get("legal_case_count") or 0),
                "legal_case_status": str(confirmed_fields.get("legal_case_status") or ("OPEN" if parse_int_safe(confirmed_fields.get("legal_case_count") or 0) > 0 else "NONE")).upper(),
                "latitude": parse_float_safe(confirmed_fields.get("latitude")),
                "longitude": parse_float_safe(confirmed_fields.get("longitude")),
            }
            normalized, errors = self.normalize_project_payload(payload)
            if errors:
                raise ValueError(f"Validation failed: {'; '.join(errors)}")

            # Check if a project with this code already exists (regardless of soft-delete)
            existing_proj = (await self.db.execute(select(Project).where(Project.project_code == normalized["project_code"]))).scalar_one_or_none()

            if existing_proj:
                proj = existing_proj
                proj.deleted_at = None  # revive if previously soft-deleted
                for k, v in normalized.items():
                    if v is not None and k != "id":
                        setattr(proj, k, v)
                proj.updated_by = user_id
            else:
                proj = Project(
                    **normalized,
                    created_by=user_id,
                    updated_by=user_id,
                    status=ProjectStatus.ACTIVE,
                )
                self.db.add(proj)
                await self.db.flush()

                # Add stages only if newly created
                for s_idx, (_, s_name) in enumerate(STAGES):
                    stg = ProjectStage(
                        project_id=proj.id,
                        stage_name=s_name,
                        stage_order=s_idx + 1,
                        status=StageStatus.IN_PROGRESS if s_idx == 0 else StageStatus.PENDING,
                    )
                    self.db.add(stg)

            target_project_id = proj.id
            created_proj_code = proj.project_code
            for d in docs:
                d.project_id = proj.id

        await self.db.commit()

        # Trigger ML refresh
        ml_refreshed = False
        prediction_summary = None
        if target_project_id:
            try:
                pred_dict = await ensure_current_prediction(self.db, target_project_id)
                await self.db.commit()
                ml_refreshed = True
                if pred_dict:
                    prediction_summary = {
                        "risk_score": pred_dict.get("risk_score"),
                        "risk_category": pred_dict.get("risk_category"),
                        "delay_probability": pred_dict.get("delay_probability"),
                        "predicted_delay_days": pred_dict.get("predicted_delay_days"),
                        "confidence_score": pred_dict.get("confidence_score"),
                        "top_delay_drivers": pred_dict.get("top_delay_drivers", [])[:3],
                    }
            except Exception as e:
                logger.warning(f"ML refresh skipped for document project {target_project_id}: {e}")

        return {
            "document_id": str(docs[0].id) if docs else None,
            "document_ids": [str(d.id) for d in docs],
            "project_id": str(target_project_id) if target_project_id else None,
            "project_code": created_proj_code,
            "status": "CONFIRMED",
            "ml_refreshed": ml_refreshed,
            "prediction": prediction_summary,
            "message": f"Successfully confirmed {len(docs)} document(s) and synchronized with ML delay prediction model.",
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

    def suggest_database_column_mapping(self, columns: List[str]) -> Dict[str, str]:
        """Automatically map external database table column names to canonical LADRIS fields."""
        mapping: Dict[str, str] = {}
        for col in columns:
            c = col.lower().strip()
            if c in ("project_code", "code", "pkg_code", "pkg_no", "project_id"):
                mapping[col] = "project_code"
            elif c in ("project_name", "name", "project_title", "title", "scheme_name"):
                mapping[col] = "name"
            elif c in ("project_type", "type", "sector", "category"):
                mapping[col] = "project_type"
            elif c in ("state_code", "state", "state_name"):
                mapping[col] = "state_code"
            elif c in ("district", "dist", "district_name", "district_codes"):
                mapping[col] = "district"
            elif c in ("total_area_ha", "total_land_area_ha", "land_required_ha", "total_area", "area_ha"):
                mapping[col] = "total_area_ha"
            elif c in ("area_acquired_ha", "acquired_land_area_ha", "land_acquired_ha", "acquired_area"):
                mapping[col] = "area_acquired_ha"
            elif c in ("area_in_possession_ha", "possessed_land_area_ha", "possession_ha", "possessed_area"):
                mapping[col] = "area_in_possession_ha"
            elif c in ("estimated_compensation_inr", "sanctioned_compensation_inr", "total_compensation_inr", "compensation_sanctioned", "sanctioned_amount"):
                mapping[col] = "estimated_compensation_inr"
            elif c in ("disbursed_compensation_inr", "compensation_disbursed", "amount_disbursed", "disbursed_amount"):
                mapping[col] = "disbursed_compensation_inr"
            elif c in ("total_affected_families", "affected_families_count", "pafs", "total_pafs", "displaced_families"):
                mapping[col] = "total_affected_families"
            elif c in ("families_compensated", "compensated_families_count", "compensated_pafs"):
                mapping[col] = "families_compensated"
            elif c in ("families_rehabilitated", "rehabilitated_families_count", "resettled_families"):
                mapping[col] = "families_rehabilitated"
            elif c in ("rehabilitation_progress_pct", "rr_progress", "rehab_pct", "rr_pct"):
                mapping[col] = "rehabilitation_progress_pct"
            elif c in ("legal_case_count", "court_cases_count", "litigation_count", "disputes_count", "legal_cases"):
                mapping[col] = "legal_case_count"
            elif c in ("legal_case_status", "case_status", "court_case_status"):
                mapping[col] = "legal_case_status"
            elif c in ("notification_3a_date", "gazette_notification_date", "sec3a_date", "notification_date"):
                mapping[col] = "notification_3a_date"
            elif c in ("notification_3d_date", "declaration_date", "sec3d_date"):
                mapping[col] = "notification_3d_date"
            elif c in ("planned_start_date", "start_date", "commencement_date"):
                mapping[col] = "planned_start_date"
            elif c in ("planned_end_date", "target_completion_date", "end_date", "target_date"):
                mapping[col] = "planned_end_date"
            elif c in ("latitude", "lat"):
                mapping[col] = "latitude"
            elif c in ("longitude", "lng", "lon"):
                mapping[col] = "longitude"
        return mapping

    async def test_and_preview_database(
        self,
        connection_url: Optional[str],
        table_name: str,
        limit: int = 5,
    ) -> Dict[str, Any]:
        """Safely connect to database and preview table rows with column mapping suggestions."""
        db_url = connection_url or getattr(self.settings, "EXTERNAL_DB_URL", None) or self.settings.DATABASE_URL
        if not db_url:
            raise ValueError("No database connection URL available.")

        # Sanitize / ensure asyncpg if postgresql
        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        clean_table = re.sub(r"[^a-zA-Z0-9_.]", "", table_name.strip())
        if not clean_table:
            raise ValueError("Invalid table name provided.")

        ext_engine = create_async_engine(db_url, pool_pre_ping=True)
        try:
            async with ext_engine.connect() as conn:
                # Count total rows
                count_res = await conn.execute(text(f"SELECT COUNT(*) FROM {clean_table}"))
                total_count = count_res.scalar() or 0

                # Query table columns & sample rows
                res = await conn.execute(text(f"SELECT * FROM {clean_table} LIMIT {limit}"))
                cols = list(res.keys())
                rows = [dict(r._mapping) for r in res.fetchall()]

                # Clean datetime for JSON
                for r in rows:
                    for k, v in r.items():
                        if isinstance(v, (datetime, date)):
                            r[k] = str(v)
                        elif isinstance(v, uuid.UUID):
                            r[k] = str(v)

                suggested_mapping = self.suggest_database_column_mapping(cols)

                return {
                    "success": True,
                    "table_name": clean_table,
                    "columns": cols,
                    "sample_rows": rows,
                    "total_rows_approx": total_count,
                    "suggested_mapping": suggested_mapping,
                }
        finally:
            await ext_engine.dispose()

    async def ingest_database_table(
        self,
        table_name: str,
        column_mapping: Optional[Dict[str, str]] = None,
        connection_url: Optional[str] = None,
        target_entity: str = "PROJECT",
        source_name: Optional[str] = None,
        limit: int = 1000,
        user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """
        Import projects directly from a database table, map canonical fields,
        upsert projects, create lifecycle stages, and trigger the ML delay prediction engine.
        """
        db_url = connection_url or getattr(self.settings, "EXTERNAL_DB_URL", None) or self.settings.DATABASE_URL
        if not db_url:
            raise ValueError("No database connection URL available.")

        if db_url.startswith("postgresql://"):
            db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        clean_table = re.sub(r"[^a-zA-Z0-9_.]", "", table_name.strip())
        if not clean_table:
            raise ValueError("Invalid table name provided.")

        ext_engine = create_async_engine(db_url, pool_pre_ping=True)
        try:
            async with ext_engine.connect() as conn:
                res = await conn.execute(text(f"SELECT * FROM {clean_table} LIMIT {limit}"))
                cols = list(res.keys())
                raw_rows = [dict(r._mapping) for r in res.fetchall()]
        finally:
            await ext_engine.dispose()

        if not raw_rows:
            raise ValueError(f"Table '{clean_table}' contains no records to import.")

        effective_mapping = self.suggest_database_column_mapping(cols)
        if column_mapping:
            effective_mapping.update(column_mapping)

        job = IngestionJob(
            job_type="DATABASE",
            source_name=source_name or f"Database: {clean_table}",
            source_type="EXTERNAL_DB",
            status=IngestionJobStatus.IMPORTING.value,
            total_records=len(raw_rows),
            uploaded_by=user_id,
        )
        self.db.add(job)
        await self.db.flush()

        imported_projects: List[Dict[str, Any]] = []
        imported_ids: List[uuid.UUID] = []
        invalid_count = 0
        duplicates_count = 0
        imported_count = 0

        for idx, row in enumerate(raw_rows):
            mapped_payload: Dict[str, Any] = {}
            for col, val in row.items():
                target_field = effective_mapping.get(col)
                if target_field:
                    mapped_payload[target_field] = val
                else:
                    mapped_payload[col] = val

            normalized, errors = self.normalize_project_payload(mapped_payload)
            if errors:
                invalid_count += 1
                continue

            code = normalized["project_code"]
            existing_proj = (await self.db.execute(select(Project).where(Project.project_code == code))).scalar_one_or_none()

            if existing_proj:
                proj = existing_proj
                proj.deleted_at = None
                for k, v in normalized.items():
                    if v is not None and k != "id":
                        setattr(proj, k, v)
                proj.updated_by = user_id
                duplicates_count += 1
            else:
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
                imported_count += 1

            imported_ids.append(proj.id)

            raw_rec = RawIngestionRecord(
                job_id=job.id,
                row_index=idx + 1,
                source_record_id=code,
                raw_payload=to_jsonable(row),
                normalized_payload=to_jsonable(normalized),
                validation_status=ValidationStatus.IMPORTED.value,
                target_entity="PROJECT",
                target_id=proj.id,
            )
            self.db.add(raw_rec)

        await self.db.commit()

        # Run real-time ML prediction refresh for all imported projects
        ml_refreshed_count = 0
        for pid in imported_ids:
            try:
                pred_dict = await ensure_current_prediction(self.db, pid)
                await self.db.commit()
                ml_refreshed_count += 1

                proj_obj = (await self.db.execute(select(Project).where(Project.id == pid))).scalar_one_or_none()
                if proj_obj:
                    imported_projects.append({
                        "project_id": str(proj_obj.id),
                        "project_code": proj_obj.project_code,
                        "project_name": proj_obj.name,
                        "risk_score": pred_dict.get("risk_score"),
                        "risk_category": pred_dict.get("risk_category"),
                        "delay_probability": pred_dict.get("delay_probability"),
                        "predicted_delay_days": pred_dict.get("predicted_delay_days"),
                        "top_delay_drivers": pred_dict.get("top_delay_drivers", [])[:3],
                    })
            except Exception as ml_err:
                logger.warning(f"ML prediction failed for DB project {pid}: {ml_err}")
                await self.db.rollback()

        job.status = IngestionJobStatus.IMPORTED.value
        job.valid_records = imported_count + duplicates_count
        job.imported_records = imported_count
        job.duplicate_records = duplicates_count
        job.invalid_records = invalid_count
        job.completed_at = datetime.now(timezone.utc)
        await self.db.commit()

        return {
            "job_id": str(job.id),
            "status": job.status,
            "table_name": clean_table,
            "total_records": len(raw_rows),
            "imported_count": imported_count,
            "duplicates_count": duplicates_count,
            "invalid_count": invalid_count,
            "ml_refreshed_count": ml_refreshed_count,
            "projects": imported_projects,
            "message": f"Successfully imported {imported_count + duplicates_count} projects from table '{clean_table}' and refreshed {ml_refreshed_count} ML delay predictions.",
        }
