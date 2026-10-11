-- ════════════════════════════════════════════════════════════════════════════
-- LADRIS – Sample External PostgreSQL Database for Database Import Method
-- This schema simulates an external State PWD / LACRRIS system database
-- that LADRIS connects to via "Import Database Data" (PostgreSQL connection).
--
-- Connection URL format for LADRIS:
--   postgresql://ladris_reader:readonly_pass@external-db.state.gov.in:5432/lacrris_ts
--
-- Use table: external_la_projects
-- ════════════════════════════════════════════════════════════════════════════

-- Drop and recreate the sample table
DROP TABLE IF EXISTS external_la_projects;

CREATE TABLE external_la_projects (
    -- Primary identifiers
    ext_project_id          VARCHAR(50)     PRIMARY KEY,
    project_name            TEXT            NOT NULL,
    project_description     TEXT,
    project_category        VARCHAR(50),    -- Maps to: project_type
    la_act                  VARCHAR(50),    -- Maps to: acquisition_act
    current_status          VARCHAR(30),    -- Maps to: status
    priority_flag           VARCHAR(20),    -- Maps to: risk_level

    -- Agency details
    ministry_name           VARCHAR(255),   -- Maps to: nodal_agency
    impl_agency             VARCHAR(255),   -- Maps to: executing_agency
    state_abbrev            CHAR(3),        -- Maps to: state_code
    district_list           TEXT,           -- Maps to: district_codes (comma-separated)
    tehsil_list             TEXT,           -- Maps to: tehsil_names (comma-separated)

    -- Land area (in hectares)
    total_land_ha           NUMERIC(14, 4), -- Maps to: total_area_ha
    acquired_land_ha        NUMERIC(14, 4), -- Maps to: area_acquired_ha
    possession_land_ha      NUMERIC(14, 4), -- Maps to: area_in_possession_ha

    -- Family counts
    total_families          INTEGER,        -- Maps to: total_affected_families
    compensated_families    INTEGER,        -- Maps to: families_compensated
    rehabilitated_families  INTEGER,        -- Maps to: families_rehabilitated
    rr_pct_complete         NUMERIC(5, 2),  -- Maps to: rehabilitation_progress_pct

    -- Timeline
    plan_start              DATE,           -- Maps to: planned_start_date
    plan_end                DATE,           -- Maps to: planned_end_date
    actual_start            DATE,           -- Maps to: actual_start_date
    duration_days_baseline  INTEGER,        -- Maps to: baseline_duration_days

    -- Compensation (INR)
    estimated_comp          NUMERIC(20, 2), -- Maps to: estimated_compensation_inr
    disbursed_comp          NUMERIC(20, 2), -- Maps to: disbursed_compensation_inr

    -- Statutory notifications
    sec3a_date              DATE,           -- Maps to: notification_3a_date
    sec3d_date              DATE,           -- Maps to: notification_3d_date

    -- Delay
    delay_months_count      INTEGER,        -- Maps to: delay_months
    delay_notes             TEXT,           -- Maps to: delay_reason
    court_case_count        INTEGER,        -- Maps to: legal_case_count
    court_case_status       VARCHAR(30),    -- Maps to: legal_case_status

    -- GIS coordinates (centroid)
    lat                     NUMERIC(9, 6),  -- Maps to: latitude
    lon                     NUMERIC(9, 6),  -- Maps to: longitude

    -- Metadata
    data_entry_date         TIMESTAMP       DEFAULT NOW(),
    last_updated            TIMESTAMP       DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- INSERT SAMPLE RECORDS
-- These 6 records represent realistic Telangana/AP highway projects
-- with varied risk levels so the ML model generates differentiated scores
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO external_la_projects VALUES
(
    'TS-PWD-NH161-001',
    'NH-161 Hyderabad Ring Road Eastern Arc Package-1',
    'Outer Ring Road eastern section from Ghatkesar to Medchal four-laning',
    'HIGHWAY', 'NH_ACT_1956', 'ACTIVE', 'LOW',
    'MoRTH', 'NHAI', 'TS',
    'Medchal-Malkajgiri,Rangareddy',
    'Ghatkesar,Medchal,Kompally',
    420.80, 418.00, 415.20,
    1080, 1075, 1070, 99.07,
    '2021-01-15', '2023-12-31', '2021-03-01',
    1050,
    98000000.00, 97500000.00,
    '2021-03-01', '2022-01-10',
    0, 'No delays – acquired and in full possession', 0, 'NONE',
    17.4840, 78.6120,
    NOW(), NOW()
),
(
    'TS-PWD-NH365-002',
    'NH-365 Wanaparthy–Nagarkurnool Connectivity Package-2',
    'Two-laning with paved shoulders connecting tribal districts under SARDP',
    'HIGHWAY', 'RFCTLARR_2013', 'DELAYED', 'HIGH',
    'MoRTH', 'NHAI', 'TS',
    'Wanaparthy,Nagarkurnool',
    'Wanaparthy,Kollapur,Achampet',
    780.40, 420.00, 180.00,
    2640, 1380, 620, 23.48,
    '2020-07-01', '2023-06-30', '2020-10-15',
    1095,
    142000000.00, 58000000.00,
    '2020-10-15', '2021-09-18',
    22, 'Tribal scheduled area land under PESA – gram sabha consent pending for 6 villages. Forest boundary dispute.',
    12, 'ACTIVE',
    16.3640, 78.3380,
    NOW(), NOW()
),
(
    'TS-PWD-NH167-003',
    'NH-167 Suryapet–Nalgonda Urban Bypass Package-1',
    'Bypass alignment to decongest NH-167 through Suryapet urban core',
    'HIGHWAY', 'NH_ACT_1956', 'ACTIVE', 'MEDIUM',
    'MoRTH', 'NHAI', 'TS',
    'Suryapet,Nalgonda',
    'Suryapet,Huzurnagar',
    294.60, 240.00, 195.00,
    860, 780, 690, 80.23,
    '2022-04-01', '2024-09-30', '2022-06-20',
    912,
    68000000.00, 52000000.00,
    '2022-06-20', '2023-05-25',
    5, 'Urban commercial property valuation dispute for 24 plots. Arbitration ongoing.',
    5, 'PENDING',
    17.1416, 79.6188,
    NOW(), NOW()
),
(
    'TS-PWD-NH563-004',
    'NH-563 Siddipet–Karimnagar Expressway Section-2',
    'Greenfield expressway through Siddipet and Karimnagar districts – Phase II',
    'HIGHWAY', 'NH_ACT_1956', 'CRITICAL', 'CRITICAL',
    'MoRTH', 'NHAI', 'TS',
    'Siddipet,Karimnagar',
    'Siddipet,Husnabad,Jagtial',
    1840.00, 420.00, 80.00,
    5200, 480, 120, 2.31,
    '2019-10-01', '2022-09-30', '2020-04-01',
    1095,
    380000000.00, 28000000.00,
    '2020-04-01', '2021-03-28',
    48, 'Section 3D lapsed – fresh 3A filed. Court stay on 840Ha. SIA contested. Award under revision for 3rd time.',
    34, 'ACTIVE',
    18.1034, 78.8520,
    NOW(), NOW()
),
(
    'TS-PWD-NH765-005',
    'NH-765 Khammam–Kothagudem Industrial Spur Package-1',
    'Industrial access road linking Singareni coal belt to NH-65 junction',
    'HIGHWAY', 'RFCTLARR_2013', 'ACTIVE', 'LOW',
    'MoRTH', 'NHAI', 'TS',
    'Bhadradri Kothagudem,Khammam',
    'Kothagudem,Palvancha',
    182.40, 178.00, 172.00,
    420, 415, 410, 97.62,
    '2023-01-01', '2025-06-30', '2023-02-15',
    912,
    44000000.00, 43000000.00,
    '2023-02-15', '2023-12-01',
    0, 'Acquisition complete. Civil works ongoing.', 0, 'NONE',
    17.5490, 80.6490,
    NOW(), NOW()
),
(
    'TS-PWD-NH044-006',
    'NH-44 Jangaon–Warangal Urban Section Widening',
    'Six-laning of existing NH-44 through Warangal urban agglomeration',
    'HIGHWAY', 'NH_ACT_1956', 'ON_HOLD', 'HIGH',
    'MoRTH', 'NHAI', 'TS',
    'Warangal Urban,Warangal Rural',
    'Warangal,Hanamkonda,Jangaon',
    340.20, 120.00, 40.00,
    1840, 680, 220, 11.96,
    '2021-03-01', '2023-08-31', '2021-07-01',
    912,
    210000000.00, 68000000.00,
    '2021-07-01', '2022-05-12',
    32, 'Urban core demolition stay by NGT. Heritage structure near chainage 18+400 under ASI review. Alignment revision under consideration.',
    19, 'ACTIVE',
    17.9784, 79.5940,
    NOW(), NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- COLUMN MAPPING for LADRIS Database Import
-- When connecting in LADRIS, use this mapping JSON:
-- ────────────────────────────────────────────────────────────────────────────
/*
LADRIS Column Mapping (paste in "Database Import" field mapping panel):
{
  "ext_project_id":         "project_code",
  "project_name":           "name",
  "project_description":    "description",
  "project_category":       "project_type",
  "la_act":                 "acquisition_act",
  "current_status":         "status",
  "priority_flag":          "risk_level",
  "ministry_name":          "nodal_agency",
  "impl_agency":            "executing_agency",
  "state_abbrev":           "state_code",
  "district_list":          "district_codes",
  "tehsil_list":            "tehsil_names",
  "total_land_ha":          "total_area_ha",
  "acquired_land_ha":       "area_acquired_ha",
  "possession_land_ha":     "area_in_possession_ha",
  "total_families":         "total_affected_families",
  "compensated_families":   "families_compensated",
  "rehabilitated_families": "families_rehabilitated",
  "rr_pct_complete":        "rehabilitation_progress_pct",
  "plan_start":             "planned_start_date",
  "plan_end":               "planned_end_date",
  "actual_start":           "actual_start_date",
  "duration_days_baseline": "baseline_duration_days",
  "estimated_comp":         "estimated_compensation_inr",
  "disbursed_comp":         "disbursed_compensation_inr",
  "sec3a_date":             "notification_3a_date",
  "sec3d_date":             "notification_3d_date",
  "delay_months_count":     "delay_months",
  "delay_notes":            "delay_reason",
  "court_case_count":       "legal_case_count",
  "court_case_status":      "legal_case_status",
  "lat":                    "latitude",
  "lon":                    "longitude"
}
*/

SELECT
    ext_project_id,
    project_name,
    priority_flag,
    current_status,
    total_land_ha,
    acquired_land_ha,
    sec3a_date,
    sec3d_date,
    delay_months_count,
    court_case_count
FROM external_la_projects
ORDER BY delay_months_count DESC;
