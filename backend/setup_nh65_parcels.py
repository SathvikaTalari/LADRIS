import asyncio
import json
from pathlib import Path
from sqlalchemy import text
from app.database import AsyncSessionLocal

async def setup():
    async with AsyncSessionLocal() as session:
        # Get TG-NHAI-SRD-001 id
        res = await session.execute(text("SELECT id FROM projects WHERE project_code = 'TG-NHAI-SRD-001'"))
        nhai_id = res.scalar_one_or_none()
        if not nhai_id:
            print("Project TG-NHAI-SRD-001 not found.")
            return

        # Clean all land_parcels
        await session.execute(text("DELETE FROM land_parcels;"))

        # Load GeoJSON features from sample_documents
        geojson_path = Path(__file__).resolve().parent.parent / "sample_documents" / "01_NH65_Highway_Parcels.geojson"
        with open(geojson_path, "r", encoding="utf-8") as f:
            gj = json.load(f)

        prop_map = {
            "142/A": {
                "ownership_status": "Title Disputed (Inheritance Litigation)",
                "compensation_status": "Stayed by High Court Order",
                "legal_status": "High Court Injunction (WP-4182/2023)",
                "days_pending": 320,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
            },
            "148/2": {
                "ownership_status": "Joint Ownership (5 Co-sharers)",
                "compensation_status": "Section 23 Award Pending Inquiry",
                "legal_status": "No Litigation (Title Inquiry Ongoing)",
                "days_pending": 165,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "OWNERSHIP",
            },
            "205/B": {
                "ownership_status": "Single Title Holder (Verified)",
                "compensation_status": "Award Passed — Treasury Release Pending",
                "legal_status": "Clear / No Dispute",
                "days_pending": 85,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
            },
            "310/1": {
                "ownership_status": "Government / CALA Acquired",
                "compensation_status": "100% Disbursed (Direct Benefit Transfer)",
                "legal_status": "Clear Title Registered",
                "days_pending": 0,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
            },
        }

        for feat in gj["features"]:
            p = feat["properties"]
            kn = p["khasra_number"]
            custom = prop_map.get(kn, {})
            merged_props = {**p, **custom}
            geom_str = json.dumps(feat["geometry"])

            insert_sql = """
                INSERT INTO land_parcels (
                    id, project_id, khasra_number, village, tehsil, district,
                    area_ha, owner_count, is_notified, is_awarded, is_compensated,
                    is_in_possession, has_legal_dispute, properties, geom
                ) VALUES (
                    gen_random_uuid(), :pid, :kn, :vil, :teh, :dist,
                    :area, :owners, :notif, :award, :comp,
                    :poss, :legal, CAST(:props AS jsonb), ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)
                )
            """
            await session.execute(
                text(insert_sql),
                {
                    "pid": nhai_id,
                    "kn": kn,
                    "vil": p.get("village"),
                    "teh": p.get("tehsil"),
                    "dist": p.get("district"),
                    "area": p.get("area_ha"),
                    "owners": 5 if kn == "148/2" else 1,
                    "notif": True,
                    "award": kn in ("205/B", "310/1"),
                    "comp": kn == "310/1",
                    "poss": kn == "310/1",
                    "legal": kn == "142/A",
                    "props": json.dumps(merged_props),
                    "geom": geom_str,
                },
            )

        await session.commit()
        print(f"Successfully configured 4 real NH65 parcels with exact properties for TG-NHAI-SRD-001 ({nhai_id})")

if __name__ == "__main__":
    asyncio.run(setup())
