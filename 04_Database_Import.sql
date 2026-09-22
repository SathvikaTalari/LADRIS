-- ============================================================================
-- LADRIS Video Demo – External PostgreSQL Sample for "Import Database Data"
-- Simulates a State PWD / LACRRIS system with 2 projects: LOW + HIGH risk
-- Connection URL: postgresql://ladris_reader:readonly_pass@demo-db.state.gov.in:5432/lacrris_demo
-- Use table: external_la_projects
-- ============================================================================

DROP TABLE IF EXISTS external_la_projects;

CREATE TABLE external_la_projects (
    ext_project_id          VARCHAR(50)     PRIMARY KEY,
    project_name            TEXT            NOT NULL,
    project_description     TEXT,
    project_category        VARCHAR(50),    -- Maps to: project_type
    la_act                  VARCHAR(50),    -- Maps to: acquisition_act
    current_status          VARCHAR(30),    -- Maps to: status
    priority_flag           VARCHAR(20),    -- Maps to: risk_level
    ministry_name           VARCHAR(255),   -- Maps to: nodal_agency
    impl_agency             VARCHAR(255),   -- Maps to: executing_agency
    state_abbrev            CHAR(3),        -- Maps to: state_code
    district_list           TEXT,           -- Maps to: district_codes
    tehsil_list             TEXT,           -- Maps to: tehsil_names
    total_land_ha           NUMERIC(14, 4),
    acquired_land_ha        NUMERIC(14, 4),
    possession_land_ha      NUMERIC(14, 4),
    total_families          INTEGER,
    compensated_families    INTEGER,
    rehabilitated_families  INTEGER,
    rr_pct_complete         NUMERIC(5, 2),
    plan_start              DATE,
    plan_end                DATE,
    actual_start            DATE,
    duration_days_baseline  INTEGER,
    estimated_comp          NUMERIC(20, 2),
    disbursed_comp          NUMERIC(20, 2),
    sec3a_date              DATE,
    sec3d_date              DATE,
    delay_months_count      INTEGER,
    delay_notes             TEXT,
    court_case_count        INTEGER,
    court_case_status       VARCHAR(30),
    lat                     NUMERIC(9, 6),
    lon                     NUMERIC(9, 6),
    data_entry_date         TIMESTAMP       DEFAULT NOW(),
    last_updated            TIMESTAMP       DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Record 1: LOW RISK – Pune Ring Road (near complete, no disputes)
-- ----------------------------------------------------------------------------
INSERT INTO external_la_projects VALUES (
    'MH-PWD-PRR-LOW01',
    'Pune Ring Road Eastern Segment – Package 4',
    'Eight-lane urban ring road eastern arc from Wagholi to Kharadi; acquisition 98% complete with smooth R&R',
    'HIGHWAY', 'RFCTLARR_2013', 'ACTIVE', 'LOW',
    'MoRTH', 'MSRDC', 'MH',
    'Pune',
    'Wagholi,Kharadi,Hadapsar',
    312.80, 306.00, 302.40,
    760, 758, 752, 98.95,
    '2023-01-01', '2026-06-30', '2023-02-20',
    1277,
    74000000.00, 73500000.00,
    '2023-02-20', '2024-01-15',
    0, 'Acquisition and R&R near complete. Zero legal cases. Civil work at 42%.', 0, 'NONE',
    18.5518, 73.9560,
    NOW(), NOW()
);

-- ----------------------------------------------------------------------------
-- Record 2: HIGH RISK – Nashik–Pune Expressway (HC stay, tribal land, lapsed 3D)
-- ----------------------------------------------------------------------------
INSERT INTO external_la_projects VALUES (
    'MH-PWD-NPE-HIGH01',
    'Nashik–Pune Expressway Greenfield Package-1',
    'Greenfield six-lane expressway through Sahyadri tribal belt; Section 3D lapsed; Bombay HC stay on 540 Ha',
    'HIGHWAY', 'NH_ACT_1956', 'DELAYED', 'HIGH',
    'MoRTH', 'NHAI', 'MH',
    'Nashik,Ahmednagar,Pune',
    'Sinnar,Sangamner,Junnar',
    1820.40, 620.00, 180.00,
    4680, 1240, 380, 8.12,
    '2020-10-01', '2023-09-30', '2021-03-15',
    1095,
    430000000.00, 82000000.00,
    '2021-03-15', '2022-02-28',
    36, 'Section 3D lapsed – fresh 3A required; Bombay HC stay (WP 14820/2022) on 540 Ha tribal land; PESA gram sabha consent pending 8 villages',
    21, 'ACTIVE',
    19.9975, 73.7898,
    NOW(), NOW()
);

-- Quick verification query
SELECT ext_project_id, project_name, priority_flag, current_status,
       total_land_ha, acquired_land_ha, delay_months_count, court_case_count
FROM external_la_projects ORDER BY priority_flag;
