import asyncio
import random
import uuid
from datetime import datetime, timedelta
from sqlalchemy import text
from app.database import AsyncSessionLocal
from app.models.project import Project
from app.etl.normalizer import derive_risk_level, generate_project_code

# Diverse Project Types and their corresponding templates, agencies, and nodal bodies
PROJECT_TYPES = {
    "HIGHWAY": {
        "templates": [
            "Six-laning of {src} to {dst} section of NH-{num}",
            "Four-laning of NH-{num} from km {start} to {end} near {district}",
            "Construction of bypass at {district} on NH-{num}",
            "Widening of {src}-{district} section of NH-{num} to 4 lanes",
        ],
        "agencies": ["NHAI", "NHIDCL", "MoRTH", "State PWD"],
        "nodal": "MoRTH",
        "act": "NH_ACT_1956"
    },
    "RAILWAY": {
        "templates": [
            "New Broad Gauge line between {src} and {dst}",
            "Doubling of {src}-{dst} railway section",
            "Dedicated Freight Corridor section in {district}"
        ],
        "agencies": ["Indian Railways", "Northern Railway", "DFCCIL"],
        "nodal": "Ministry of Railways",
        "act": "RAILWAYS_ACT_1989"
    },
    "METRO_RAIL": {
        "templates": [
            "{src} Metro Phase {num} construction",
            "Extension of Metro line to {district}"
        ],
        "agencies": ["DMRC", "BMRCL", "Maha-Metro", "CMRL", "State Metro Corp"],
        "nodal": "MoHUA",
        "act": "RFCTLARR_2013"
    },
    "INDUSTRIAL_CORRIDOR": {
        "templates": [
            "Setup of {district} Industrial Park",
            "Land acquisition for {src}-{dst} Industrial Corridor",
            "Multi-Modal Logistics Park at {district}"
        ],
        "agencies": ["State IDC", "NICDC"],
        "nodal": "DPIIT",
        "act": "STATE_SPECIFIC"
    },
    "POWER_TRANSMISSION": {
        "templates": [
            "400kV Double Circuit transmission line in {district}",
            "{src} Thermal Power Plant expansion",
            "{district} Solar Park land acquisition"
        ],
        "agencies": ["PGCIL", "NTPC", "State Transco", "SECI"],
        "nodal": "Ministry of Power",
        "act": "ELECTRICITY_ACT_2003"
    },
    "AIRPORT": {
        "templates": [
            "Greenfield Airport development at {district}",
            "Runway expansion for {src} Airport"
        ],
        "agencies": ["AAI", "State Aviation Dept"],
        "nodal": "Ministry of Civil Aviation",
        "act": "RFCTLARR_2013"
    },
    "PORT": {
        "templates": [
            "Expansion of {district} Port facilities",
            "New Deepwater Port at {src}"
        ],
        "agencies": ["Port Trust", "Ministry of Ports"],
        "nodal": "MoPSW",
        "act": "RFCTLARR_2013"
    },
    "IRRIGATION": {
        "templates": [
            "{district} Major Irrigation Canal network",
            "Reservoir construction near {src}",
            "{src} Lift Irrigation Scheme Phase {num}"
        ],
        "agencies": ["State Water Dept", "CWC", "Irrigation Corp"],
        "nodal": "Ministry of Jal Shakti",
        "act": "STATE_SPECIFIC"
    },
    "URBAN_DEVELOPMENT": {
        "templates": [
            "{src} Smart City road widening",
            "Sewage Treatment Plant land acquisition in {district}",
            "Urban Flyover construction in {src}"
        ],
        "agencies": ["Municipal Corporation", "Smart City SPV", "Urban Development Authority"],
        "nodal": "MoHUA",
        "act": "RFCTLARR_2013"
    },
    "DEFENCE": {
        "templates": [
            "Strategic infrastructure development in {district}",
            "Border road construction in {state}"
        ],
        "agencies": ["BRO", "Ministry of Defence"],
        "nodal": "Ministry of Defence",
        "act": "OTHER"
    }
}

CITIES = ["Delhi", "Mumbai", "Chennai", "Kolkata", "Bangalore", "Hyderabad", "Pune", "Ahmedabad", "Surat", "Jaipur", "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna", "Vadodara"]

async def seed_realistic_data():
    print("Seeding diverse national infrastructure projects into LADRIS database...")
    async with AsyncSessionLocal() as db:
        # Ensure extended schema columns exist on projects table
        await db.execute(text("""
            ALTER TABLE projects 
                ADD COLUMN IF NOT EXISTS notification_3a_date DATE,
                ADD COLUMN IF NOT EXISTS notification_3d_date DATE,
                ADD COLUMN IF NOT EXISTS delay_months INTEGER,
                ADD COLUMN IF NOT EXISTS delay_reason TEXT,
                ADD COLUMN IF NOT EXISTS legal_case_count INTEGER DEFAULT 0,
                ADD COLUMN IF NOT EXISTS legal_case_status VARCHAR(50) DEFAULT 'NONE',
                ADD COLUMN IF NOT EXISTS milestone_data_status VARCHAR(50) DEFAULT 'SYNTHETIC_DEMO',
                ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
                ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6),
                ADD COLUMN IF NOT EXISTS lacrris_integration_status VARCHAR(50) DEFAULT 'PLANNED'
        """))
        await db.execute(text("ALTER TABLE projects ALTER COLUMN district_codes TYPE TEXT[]"))
        await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS agency_name VARCHAR(255)"))
        await db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_project_ids VARCHAR(1024)"))
        await db.commit()

        # Get districts to map projects to via raw SQL
        try:
            result = await db.execute(text("SELECT district_name, state_code FROM districts"))
            districts = [{"district_name": row[0], "state_code": row[1]} for row in result.all()]
        except Exception:
            await db.rollback()
            districts = [
                {"district_name": "Sangareddy", "state_code": "TG"},
                {"district_name": "Medak", "state_code": "TG"},
                {"district_name": "Rangareddy", "state_code": "TG"},
                {"district_name": "Varanasi", "state_code": "UP"},
                {"district_name": "Prayagraj", "state_code": "UP"},
                {"district_name": "Pune", "state_code": "MH"},
                {"district_name": "Thane", "state_code": "MH"},
                {"district_name": "Ahmedabad", "state_code": "GJ"},
                {"district_name": "Surat", "state_code": "GJ"},
                {"district_name": "Bengaluru Rural", "state_code": "KA"},
            ]

        if not districts:
            districts = [{"district_name": "Sangareddy", "state_code": "TG"}]

        new_projects = []
        # Clear existing seeded projects
        await db.execute(text("DELETE FROM projects WHERE milestone_data_status = 'REALISTIC_SNAPSHOT'"))
        await db.commit()
        
        for i in range(250):
            district = random.choice(districts)
            proj_type_key = random.choice(list(PROJECT_TYPES.keys()))
            proj_config = PROJECT_TYPES[proj_type_key]
            
            num = random.randint(1, 99)
            src = random.choice(CITIES)
            dst = random.choice(CITIES)
            while dst == src:
                dst = random.choice(CITIES)
                
            template = random.choice(proj_config["templates"])
            name = template.format(
                src=src, dst=dst, num=num, 
                district=district["district_name"],
                start=random.randint(10, 50),
                end=random.randint(51, 150),
                state=district["state_code"]
            ) + f" (Phase {i})"
            
            # Generate realistic LA metrics
            total_area = round(random.uniform(5.0, 1500.0), 2)
            
            # Determine if this is a "good" project (low risk) vs "bad" project
            is_good_project = random.random() < 0.35  # 35% chance to be very healthy
            is_avg_project = random.random() < 0.50   # 50% chance of the remaining to be average
            
            if is_good_project:
                acquired_area = round(total_area * random.uniform(0.85, 1.0), 2)
                delay_months = random.randint(0, 2)
                legal_cases = 0
                comp_backlog = random.uniform(0, 10.0)
                raw_status = random.choice(["ACTIVE", "COMPLETED"])
            elif is_avg_project:
                acquired_area = round(total_area * random.uniform(0.50, 0.85), 2)
                delay_months = random.randint(2, 8)
                legal_cases = random.randint(0, 3)
                comp_backlog = random.uniform(10.0, 40.0)
                raw_status = random.choice(["ACTIVE", "UNDER_REVIEW"])
            else:
                acquired_area = round(total_area * random.uniform(0.05, 0.40), 2)
                delay_months = random.randint(10, 48)
                legal_cases = random.randint(5, 25)
                comp_backlog = random.uniform(50.0, 100.0)
                raw_status = random.choice(["DELAYED", "ON_HOLD"])
            
            # Dates
            now = datetime.now()
            days_since_3a = random.randint(50, 2000)
            date_3a = (now - timedelta(days=days_since_3a)).strftime("%Y-%m-%d")
            
            date_3d = None
            if days_since_3a > 180 and random.random() > 0.4:
                date_3d = (now - timedelta(days=days_since_3a - random.randint(30, 170))).strftime("%Y-%m-%d")
                
            est_cost = round(random.uniform(10.0, 10000.0), 2)
            
            risk_level = derive_risk_level(
                total_area=total_area,
                acquired_area=acquired_area,
                delay_months=delay_months,
                legal_cases=legal_cases,
                compensation_backlog_pct=comp_backlog
            )
            
            # Fallback code for non-highway
            code = generate_project_code(nh_number=f"PROJ-{num}", state_code=district["state_code"], name=name)
            
            proj = Project(
                id=str(uuid.uuid4()),
                project_code=code,
                name=name,
                description=f"Synthetic {proj_type_key.replace('_', ' ').title()} data for {name}",
                project_type=proj_type_key,
                acquisition_act=proj_config["act"],
                state_code=district["state_code"],
                district_codes=[district["district_name"]],
                nodal_agency=proj_config["nodal"],
                executing_agency=random.choice(proj_config["agencies"]),
                total_area_ha=total_area,
                area_acquired_ha=acquired_area,
                notification_3a_date=datetime.strptime(date_3a, "%Y-%m-%d").date() if date_3a else None,
                notification_3d_date=datetime.strptime(date_3d, "%Y-%m-%d").date() if date_3d else None,
                estimated_compensation_inr=est_cost * 10000000,
                status=raw_status,
                risk_level=risk_level,
                delay_months=delay_months,
                legal_case_count=legal_cases,
                milestone_data_status="REALISTIC_SNAPSHOT",
                created_at=now,
                updated_at=now
            )
            new_projects.append(proj)
            
        db.add_all(new_projects)
        await db.commit()
        print(f"Successfully seeded {len(new_projects)} diverse infrastructure projects!")

if __name__ == "__main__":
    asyncio.run(seed_realistic_data())
