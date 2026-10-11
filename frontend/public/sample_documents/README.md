# 📁 LADRIS — Sample Test Files

This folder contains **ready-to-use sample files** for testing all 6 data input methods in the **"Create New Project"** modal.

---

## 🗂️ File Index — Which File to Use for Each Input Method

| # | Input Method (in the modal) | File to Use | Format |
|---|---|---|---|
| 1 | **Upload CSV / Excel → Upload Spreadsheet** | `04_Projects_Bulk_Upload.csv` | CSV |
| 2 | **Upload CSV / Excel → Upload Spreadsheet** *(parcel-level)* | `02_Airport_Expansion_Parcels.csv` | CSV |
| 3 | **Connect API → View API & Test** | `05_API_Batch_Payload.json` | JSON |
| 4 | **Upload GIS Data → Upload GIS Data** *(GeoJSON)* | `01_NH65_Highway_Parcels.geojson` | GeoJSON |
| 5 | **Upload GIS Data → Upload GIS Data** *(GeoJSON)* | `06_NH48_Bengaluru_Pune_Parcels.geojson` | GeoJSON |
| 6 | **Upload GIS Data → Upload GIS Data** *(KML)* | `03_Metro_Phase2_Alignment.kml` | KML |
| 7 | **Upload GIS Data → Upload GIS Data** *(KML)* | `07_NH366_Nagarjunasagar_Bypass_Alignment.kml` | KML |
| 8 | **Upload Documents (PDF) → Upload Document** | `08_Section3A_Notification_NH130D.txt` | TXT (simulates PDF gazette) |
| 9 | **Import Database Data → Connect Database** | `09_External_DB_Schema_And_Data.sql` | SQL |

---

## 📄 File Descriptions

### 1. `04_Projects_Bulk_Upload.csv`
> **Use for:** Upload CSV / Excel → "Upload Spreadsheet" button

Bulk upload of **8 complete infrastructure projects** across multiple states and project types:
- NH-44 Nagpur–Hyderabad Highway (Telangana) — DELAYED, HIGH risk
- NH-163 Zaheerabad–Bidar Highway (Telangana) — ACTIVE, MEDIUM risk
- NH-765 Nalgonda–Miryalaguda (Telangana) — CRITICAL
- Bengaluru Metro Phase 3 Corridor 7 (Karnataka) — ACTIVE, LOW risk
- Ahmedabad Airport Expansion Phase 2 (Gujarat)
- HVDC Power Line Hyderabad–Lucknow (Telangana)
- Kalyan–Kasara Railway Doubling (Maharashtra)
- Kirandul–Jagdalpur Irrigation Pipeline (Chhattisgarh)

**Contains all required columns:** project code, type, status, risk level, area, families, compensation, statutory dates, delay reason, legal cases, coordinates.

---

### 2. `02_Airport_Expansion_Parcels.csv`
> **Use for:** Upload CSV / Excel → "Upload Spreadsheet" button *(parcel/land-parcel level data)*

Individual land parcel records for **Hyderabad Aerotropolis Zone B** airport expansion:
- 4 parcel records with khasra numbers, village, tehsil, district, area (ha), and GPS coordinates.

---

### 3. `05_API_Batch_Payload.json`
> **Use for:** Connect API → "View API & Test" button

A JSON batch payload with **3 project records** for the REST API `/api/v1/projects/batch` endpoint:
- NH-16 Vijayawada–Rajam Expressway (Andhra Pradesh) — DELAYED, CRITICAL
- NH-27 Varanasi–Kolkata Expressway (Bihar) — ACTIVE, MEDIUM
- Delhi–Meerut RRTS Package-4 (Uttar Pradesh) — COMPLETED

Structure matches the API schema exactly (source_name → reporting_period → records[]).

---

### 4. `01_NH65_Highway_Parcels.geojson`
> **Use for:** Upload GIS Data → "Upload GIS Data" button

GeoJSON FeatureCollection with **4 land parcel polygons** for the NH-65 Vijayawada–Hyderabad Expressway Package-2 in Telangana (Rangareddy & Yadadri Bhuvanagiri districts).

Each feature has: parcel_id, khasra_number, village, tehsil, district, state_code, area_ha, project_code.

---

### 5. `06_NH48_Bengaluru_Pune_Parcels.geojson`
> **Use for:** Upload GIS Data → "Upload GIS Data" button

Larger GeoJSON file with parcel polygons for **NH-48 Bengaluru–Pune** corridor.

---

### 6. `03_Metro_Phase2_Alignment.kml`
> **Use for:** Upload GIS Data → "Upload GIS Data" button *(KML format)*

KML file containing the **Metro Phase 2 alignment corridor** (line geometry for the railway/metro track alignment).

---

### 7. `07_NH366_Nagarjunasagar_Bypass_Alignment.kml`
> **Use for:** Upload GIS Data → "Upload GIS Data" button *(KML format)*

KML alignment file for the **NH-366 Nagarjunasagar Bypass** showing the full highway corridor geometry.

---

### 8. `08_Section3A_Notification_NH130D.txt`
> **Use for:** Upload Documents (PDF) → "Upload Document (PDF)" button

A complete simulated **Gazette Notification** under **Section 3A of the National Highways Act, 1956** for the NH-130D Patna–Aurangabad Six-Lane Expressway (Bihar).

Contains all real-world gazette sections: project identification, statutory dates, affected villages, land schedule (parcel-wise), compensation estimates, CALA details, and objection filing instructions.

> 💡 In production, upload the actual scanned PDF gazette. This `.txt` file simulates the document structure for testing the PDF extraction engine.

---

### 9. `09_External_DB_Schema_And_Data.sql`
> **Use for:** Import Database Data → "Connect Database" button

A complete **PostgreSQL SQL file** that:
1. Creates a sample external database table (`external_la_projects`) simulating a State PWD / LACRRIS system
2. Inserts **5 sample project records** with column mapping comments showing how each external column maps to the LADRIS schema

**To test Database Import:**
1. Run this SQL on any local or test PostgreSQL instance
2. Use the connection URL format: `postgresql://ladris_reader:readonly_pass@localhost:5432/lacrris_ts`
3. Enter table name: `external_la_projects`

---

## ✅ Quick Test Guide

| What you want to test | Steps |
|---|---|
| Bulk project upload | Open modal → "Upload Spreadsheet" → upload `04_Projects_Bulk_Upload.csv` |
| GIS map parcel import | Open modal → "Upload GIS Data" → upload `01_NH65_Highway_Parcels.geojson` |
| KML alignment import | Open modal → "Upload GIS Data" → upload `03_Metro_Phase2_Alignment.kml` |
| API batch ingest | Open modal → "View API & Test" → use `05_API_Batch_Payload.json` as the request body |
| Gazette PDF extraction | Open modal → "Upload Document (PDF)" → upload `08_Section3A_Notification_NH130D.txt` |
| External DB connection | Open modal → "Connect Database" → run `09_External_DB_Schema_And_Data.sql` first, then connect |
