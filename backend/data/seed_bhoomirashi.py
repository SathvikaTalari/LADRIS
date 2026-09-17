import asyncio
import sys
from datetime import date
sys.path.insert(0, "c:/Ladris/LADRIS/backend")

from sqlalchemy import text
from app.database import AsyncSessionLocal

SAMPLE_BHOOMIRASHI_PROJECTS = [
    (
        "BHOOMI-NH-16-01",
        "NH-16 Visakhapatnam to Rajahmundry 6-Laning",
        "HIGHWAY",
        "AP",
        "Visakhapatnam",
        510.50,
        360.00,
        280.00,
        4200000000.0,
        3150000000.0,
        1250,
        940,
        780,
        62.4,
        4,
        "OPEN",
        date(2023, 5, 10),
        date(2023, 11, 20),
        date(2024, 1, 15),
        date(2026, 6, 30),
        17.6868,
        83.2185
    ),
    (
        "BHOOMI-NH-48-02",
        "Pune-Bengaluru Expressway Corridor Package 2",
        "HIGHWAY",
        "MH",
        "Pune",
        640.00,
        410.00,
        290.00,
        5800000000.0,
        3800000000.0,
        1580,
        1050,
        690,
        43.7,
        7,
        "OPEN",
        date(2023, 2, 14),
        date(2023, 8, 18),
        date(2023, 10, 1),
        date(2026, 12, 31),
        18.5204,
        73.8567
    ),
    (
        "BHOOMI-RR-DEL-03",
        "Delhi-Meerut Regional Rapid Transit System Phase II",
        "RAILWAY",
        "UP",
        "Ghaziabad",
        230.75,
        195.00,
        160.00,
        3100000000.0,
        2650000000.0,
        680,
        580,
        510,
        75.0,
        2,
        "OPEN",
        date(2023, 6, 1),
        date(2023, 12, 10),
        date(2024, 2, 1),
        date(2025, 12, 31),
        28.6692,
        77.4538
    ),
    (
        "BHOOMI-METRO-04",
        "Bengaluru Metro Rail Phase 3 ORR-Airport Link",
        "METRO_RAIL",
        "KA",
        "Bengaluru Urban",
        185.20,
        145.00,
        110.00,
        4900000000.0,
        3900000000.0,
        890,
        710,
        580,
        65.2,
        5,
        "OPEN",
        date(2023, 3, 25),
        date(2023, 9, 30),
        date(2024, 1, 10),
        date(2026, 9, 30),
        12.9716,
        77.5946
    ),
    (
        "BHOOMI-PORT-05",
        "Vadhavan Mega Port Rail & Road Connectivity Link",
        "PORT",
        "MH",
        "Palghar",
        720.00,
        310.00,
        180.00,
        6500000000.0,
        2800000000.0,
        2100,
        920,
        420,
        20.0,
        9,
        "OPEN",
        date(2023, 1, 15),
        date(2023, 7, 20),
        date(2023, 9, 1),
        date(2027, 3, 31),
        19.9872,
        72.7125
    )
]

async def seed():
    async with AsyncSessionLocal() as session:
        # Create table if not exists
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS bhoomirashi_projects (
                id SERIAL PRIMARY KEY,
                project_code VARCHAR(100) UNIQUE NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                project_type VARCHAR(50) NOT NULL,
                state_code VARCHAR(10) NOT NULL,
                district VARCHAR(100) NOT NULL,
                total_area_ha NUMERIC(12, 2) NOT NULL,
                area_acquired_ha NUMERIC(12, 2),
                area_in_possession_ha NUMERIC(12, 2),
                estimated_compensation_inr NUMERIC(18, 2),
                disbursed_compensation_inr NUMERIC(18, 2),
                total_affected_families INTEGER,
                families_compensated INTEGER,
                families_rehabilitated INTEGER,
                rehabilitation_progress_pct NUMERIC(5, 2),
                legal_case_count INTEGER DEFAULT 0,
                legal_case_status VARCHAR(20) DEFAULT 'NONE',
                notification_3a_date DATE,
                notification_3d_date DATE,
                planned_start_date DATE,
                planned_end_date DATE,
                latitude NUMERIC(9, 6),
                longitude NUMERIC(9, 6),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        """))
        await session.commit()

        # Insert or update sample records
        for p in SAMPLE_BHOOMIRASHI_PROJECTS:
            await session.execute(
                text("""
                    INSERT INTO bhoomirashi_projects (
                        project_code, project_name, project_type, state_code, district,
                        total_area_ha, area_acquired_ha, area_in_possession_ha,
                        estimated_compensation_inr, disbursed_compensation_inr,
                        total_affected_families, families_compensated, families_rehabilitated,
                        rehabilitation_progress_pct, legal_case_count, legal_case_status,
                        notification_3a_date, notification_3d_date, planned_start_date, planned_end_date,
                        latitude, longitude
                    ) VALUES (
                        :code, :name, :ptype, :state, :dist,
                        :tot_area, :acq_area, :poss_area,
                        :est_comp, :disb_comp,
                        :pafs, :fams_comp, :fams_rehab,
                        :rehab_pct, :legal_cnt, :legal_stat,
                        :d3a, :d3d, :pstart, :pend,
                        :lat, :lng
                    ) ON CONFLICT (project_code) DO UPDATE SET
                        project_name = EXCLUDED.project_name,
                        total_area_ha = EXCLUDED.total_area_ha,
                        area_acquired_ha = EXCLUDED.area_acquired_ha,
                        area_in_possession_ha = EXCLUDED.area_in_possession_ha,
                        estimated_compensation_inr = EXCLUDED.estimated_compensation_inr,
                        disbursed_compensation_inr = EXCLUDED.disbursed_compensation_inr,
                        rehabilitation_progress_pct = EXCLUDED.rehabilitation_progress_pct,
                        legal_case_count = EXCLUDED.legal_case_count;
                """),
                {
                    "code": p[0], "name": p[1], "ptype": p[2], "state": p[3], "dist": p[4],
                    "tot_area": p[5], "acq_area": p[6], "poss_area": p[7],
                    "est_comp": p[8], "disb_comp": p[9],
                    "pafs": p[10], "fams_comp": p[11], "fams_rehab": p[12],
                    "rehab_pct": p[13], "legal_cnt": p[14], "legal_stat": p[15],
                    "d3a": p[16], "d3d": p[17], "pstart": p[18], "pend": p[19],
                    "lat": p[20], "lng": p[21]
                }
            )
        await session.commit()
        print("Successfully created and seeded bhoomirashi_projects table with 5 projects!")

if __name__ == "__main__":
    asyncio.run(seed())
