"""
LADRIS — One-time migration script to update generic alert titles to specific reasons.
Replaces generic titles like 'ML HIGH-RISK DELAY PREDICTION' with specific reasons:
- High Delay Risk
- Compensation Pending
- Legal Dispute
- R&R Delay
- Stage Overdue
- Risk Increased
"""
import asyncio
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import AsyncSessionLocal
from app.models.misc import Alert
from app.api.v1.alerts import classify_alert_reason

async def main():
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(Alert).options(joinedload(Alert.project)))
        alerts = res.scalars().all()
        updated_count = 0
        for alert in alerts:
            proj = alert.project
            pname = proj.name if proj else (alert.alert_metadata or {}).get("project_name")
            reason, explanation = classify_alert_reason(alert, proj)
            
            old_title = alert.title
            old_message = alert.message
            
            # Update title if it was generic
            if alert.title.startswith("ML") or "ML HIGH-RISK" in alert.title or alert.title == "ML high-risk project":
                alert.title = reason
                alert.message = explanation
                
            # Update metadata
            meta = dict(alert.alert_metadata or {})
            meta["alert_reason"] = reason
            if pname:
                meta["project_name"] = pname
            alert.alert_metadata = meta
            
            updated_count += 1
            print(f"Updated Alert {alert.id}:")
            print(f"  Project: {pname}")
            print(f"  Title: '{old_title}' -> '{alert.title}'")
            print(f"  Reason: {reason}")
            print(f"  Message: '{alert.message}'")
            print(f"  Status: {alert.status.value}")
        
        await db.commit()
        print(f"\nSuccessfully migrated {updated_count} alert records in database.")

if __name__ == "__main__":
    asyncio.run(main())
