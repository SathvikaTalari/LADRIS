"""
LADRIS — Saarthi AI Knowledge & Live Decision Support Engine
"""
from datetime import datetime, timezone
import re
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, ProjectStatus, RiskLevel, AcquisitionAct
from app.models.misc import Alert, AlertSeverity, AlertStatus


# ─────────────────────────────────────────────────────────────────────────────
# Domain & Statutory Knowledge Base
# ─────────────────────────────────────────────────────────────────────────────

STATUTORY_KNOWLEDGE = {
    "nh_act_1956": """
### 📜 National Highways Act, 1956 — Land Acquisition Process
The NH Act 1956 governs land acquisition for National Highways in India. The statutory workflow comprises key milestones:

1. **Section 3A (Intention to Acquire)**:
   - Central Government declares intention to acquire land for highway building/expansion.
   - Published in the Official Gazette and two local newspapers.
   - Authorized officers gain power to survey, dig, and take levels under **Section 3B**.

2. **Section 3C (Hearing of Objections)**:
   - Affected landholders have **21 days** from 3A publication to file objections regarding land use.
   - Objections are heard by the Competent Authority for Land Acquisition (**CALA**), whose order is final.

3. **Section 3D (Declaration of Acquisition)**:
   - **CRITICAL STATUTORY DEADLINE**: Under Section 3D(1), the declaration **MUST be published within ONE YEAR** from the date of Section 3A publication.
   - If not published within 1 year, the entire Section 3A notification **lapses**, requiring the acquisition process to start over from scratch!
   - On publication of 3D, the land vests absolutely in the Central Government free from all encumbrances.

4. **Section 3E (Power to Take Possession)**:
   - CALA directs land surrender within **60 days** after compensation is deposited under Section 3H.
   - If peaceful possession is refused, District Magistrate/Superintendent of Police enforces surrender.

5. **Section 3G (Determination of Compensation)**:
   - CALA determines compensation payable to landowners.
   - If either party is dissatisfied with CALA's award, they can petition for **Arbitration** appointed by Central Govt (Divisional Commissioner).

6. **Section 3H (Deposit & Payment)**:
   - NHAI/Executing agency deposits amount with CALA for disbursement to landowners.
""",
    "rfctlarr_2013": """
### ⚖️ RFCTLARR Act, 2013 — Compensation & Rehabilitation Standard
The *Right to Fair Compensation and Transparency in Land Acquisition, Rehabilitation and Resettlement Act, 2013* governs modern compensation principles:

1. **Market Value Determination (Section 26)**:
   - Calculated as higher of: Circle rate / guideline value, OR average sale price of top 50% similar deeds recorded in past 3 years.

2. **Multiplication Factor (Section 26 Schedule 1)**:
   - **Urban Areas**: Multiplied by **1.0x**.
   - **Rural Areas**: Multiplied by a factor between **1.0x and 2.0x** (determined by State Govts based on distance from urban centers).

3. **Solatium (Section 30)**:
   - A mandatory **100% solatium** is added to total land value compensation.

4. **Additional Interest (Section 30(3))**:
   - **12% per annum** calculated from Section 3A/4 notification date to the date of CALA award.

5. **Rehabilitation & Resettlement (R&R) (Sections 31-38)**:
   - Mandatory provision of housing for displaced families, one-time resettlement allowance, subsistence grant, and employment support.
""",
    "priority_score": """
### 🎯 Phase 4 Decision-Support Priority Score
The LADRIS Priority Score dynamically ranks projects that need urgent administrative intervention before costly delays compound.

**Formula & Components**:
- **Baseline Stage Duration Slippage (30%)**: Number of months a project has exceeded typical SLA milestones (e.g. 3A to 3D elapsed time).
- **Statutory Lapse Risk (25%)**: Proximity to the 12-month Section 3D lapse cliff. Projects >9 months from 3A without 3D receive maximum urgency flags.
- **Legal & Litigation Bottlenecks (20%)**: Active court stays, writ petitions, and pending Section 3G(5) CALA arbitration disputes.
- **Compensation Disbursement Deficit (15%)**: Ratio of undisbursed compensation vs total award.
- **Encumbrance & Possession Gap (10%)**: Difference between acquired land and physically possessed right-of-way.
"""
}

NAVIGATION_MAP = {
    "dashboard": {"title": "Command Dashboard", "path": "/dashboard", "desc": "Executive overview of national KPIs, priority queue, and high-risk flags."},
    "priority": {"title": "Priority Intelligence", "path": "/priority-intelligence", "desc": "Dedicated multi-factor ranking engine to isolate delayed highway projects."},
    "workbench": {"title": "LA Officer Workbench", "path": "/la-workbench", "desc": "Operational hub for CALA/LA officers: 3A/3D workflows, objection hearings, and disbursement logs."},
    "agency": {"title": "Implementing Agency Portal", "path": "/agency-portal", "desc": "NHAI & agency tracking for civil contractor handovers and encumbrance clearances."},
    "intelligence": {"title": "Decision Intelligence & What-If", "path": "/intelligence", "desc": "Policy simulation sandbox to test expedited compensation budgets against delay reductions."},
    "projects": {"title": "Project Intelligence Workspace", "path": "/projects", "desc": "Complete directory of verified national highway acquisition projects."},
    "gis": {"title": "GIS Risk Map", "path": "/gis", "desc": "Interactive geospatial map rendering PostGIS verified project coordinates and corridor bottlenecks."},
    "analytics": {"title": "District Analytics", "path": "/analytics", "desc": "State and district aggregation with statistical sample size safeguards."},
    "alerts": {"title": "Alerts & Notifications", "path": "/alerts", "desc": "Rules-based early warnings for impending statutory lapses and legal escalations."},
    "datasources": {"title": "Data Sources", "path": "/data-sources", "desc": "Status of BhoomiRashi scraper, Data.gov.in, and e-Courts live pipelines."},
    "admin": {"title": "Administration", "path": "/admin", "desc": "User role management, audit logging, and system configurations."}
}


class SaarthiService:
    """Saarthi: Conversational and Query Engine for LADRIS."""

    async def get_system_stats(self, db: AsyncSession) -> Dict[str, Any]:
        """Fetch real-time snapshot of the database."""
        try:
            total_res = await db.execute(select(func.count(Project.id)))
            total_projects = total_res.scalar() or 0

            delayed_res = await db.execute(
                select(func.count(Project.id)).where(Project.status == ProjectStatus.DELAYED)
            )
            delayed_count = delayed_res.scalar() or 0

            high_risk_res = await db.execute(
                select(func.count(Project.id)).where(
                    or_(Project.risk_level == RiskLevel.CRITICAL, Project.risk_level == RiskLevel.HIGH)
                )
            )
            high_risk_count = high_risk_res.scalar() or 0

            alerts_res = await db.execute(
                select(func.count(Alert.id)).where(Alert.status == AlertStatus.ACTIVE)
            )
            active_alerts = alerts_res.scalar() or 0

            return {
                "total_projects": total_projects,
                "delayed_count": delayed_count,
                "high_risk_count": high_risk_count,
                "active_alerts": active_alerts,
            }
        except Exception:
            return {"total_projects": 0, "delayed_count": 0, "high_risk_count": 0, "active_alerts": 0}

    async def get_high_risk_projects(self, db: AsyncSession, limit: int = 5) -> List[Dict[str, Any]]:
        """Fetch top highest risk projects currently in DB."""
        try:
            stmt = (
                select(Project)
                .where(or_(Project.risk_level == RiskLevel.CRITICAL, Project.risk_level == RiskLevel.HIGH))
                .order_by(Project.delay_months.desc())
                .limit(limit)
            )
            res = await db.execute(stmt)
            projects = res.scalars().all()
            return [
                {
                    "id": str(p.id),
                    "code": p.project_code,
                    "name": p.name,
                    "state": p.state_code,
                    "risk": p.risk_level.value if hasattr(p.risk_level, "value") else str(p.risk_level),
                    "delay_months": p.delay_months or 0,
                    "delay_reason": p.delay_reason or "Administrative delays",
                    "legal_cases": p.legal_case_count or 0,
                }
                for p in projects
            ]
        except Exception:
            return []

    async def search_projects(self, db: AsyncSession, query_str: str, limit: int = 3) -> List[Dict[str, Any]]:
        """Search projects by name, code, state, or district."""
        try:
            clean_q = f"%{query_str.strip()}%"
            stmt = (
                select(Project)
                .where(
                    or_(
                        Project.name.ilike(clean_q),
                        Project.project_code.ilike(clean_q),
                        Project.state_code.ilike(clean_q),
                    )
                )
                .limit(limit)
            )
            res = await db.execute(stmt)
            projects = res.scalars().all()
            return [
                {
                    "id": str(p.id),
                    "code": p.project_code,
                    "name": p.name,
                    "state": p.state_code,
                    "status": p.status.value if hasattr(p.status, "value") else str(p.status),
                    "risk": p.risk_level.value if hasattr(p.risk_level, "value") else str(p.risk_level),
                    "delay_months": p.delay_months or 0,
                    "delay_reason": p.delay_reason or "None recorded",
                    "legal_cases": p.legal_case_count or 0,
                    "notification_3a": p.notification_3a_date.isoformat() if p.notification_3a_date else None,
                    "notification_3d": p.notification_3d_date.isoformat() if p.notification_3d_date else None,
                }
                for p in projects
            ]
        except Exception:
            return []

    async def process_query(
        self,
        query: str,
        user_role: Optional[str],
        active_page: Optional[str],
        db: AsyncSession,
    ) -> Dict[str, Any]:
        """Main NLP intent processing & live knowledge synthesis."""
        q = query.lower().strip()

        words_set = set(re.findall(r'\b[a-z0-9_]+\b', q))
        is_greeting = bool(words_set.intersection({"hello", "hi", "namaste", "hey", "greetings"})) or any(phrase in q for phrase in ["who are you", "what is saarthi", "introduce yourself", "about yourself"])
        if is_greeting and (len(words_set) <= 3 or "saarthi" in q or "who are you" in q):
            return {
                "reply": (
                    "🙏 **Namaste! I am Saarthi**, your dedicated AI Assistant and Decision Companion for **LADRIS** "
                    "(Land Acquisition Early-Warning & Decision Support Intelligence Platform).\n\n"
                    "I am here to guide you through:\n"
                    "- 📊 **Live Project Insights**: High-risk bottlenecks, compensation delays, and legal cases.\n"
                    "- ⚖️ **Statutory Guidance**: NH Act 1956 (Sections 3A–3H), RFCTLARR Act 2013, solatium & 1-year deadlines.\n"
                    "- 🗺️ **Platform Workflows**: How to use the Command Dashboard, GIS Map, LA Workbench, What-If Simulator, and Alerts.\n\n"
                    "How can I assist your mission today?"
                ),
                "actions": [
                    {"label": "📊 Command Dashboard", "path": "/dashboard"},
                    {"label": "🚨 High Risk Projects", "path": "/priority-intelligence"},
                    {"label": "🗺️ Open GIS Map", "path": "/gis"},
                ],
                "suggestions": [
                    "Which projects have the highest delay risk?",
                    "What is the Section 3D statutory 1-year rule?",
                    "How does the Priority Score work?",
                    "How do I use the LA Officer Workbench?"
                ]
            }

        # ── 2. What is LADRIS / Executive Overview ───────────────────────────
        if any(w in q for w in ["what is ladris", "about ladris", "overview", "what does this app do", "purpose"]):
            stats = await self.get_system_stats(db)
            return {
                "reply": (
                    "### 🏛️ About LADRIS Platform\n\n"
                    "**LADRIS** is an enterprise-grade AI decision-support platform engineered for Indian National Highway infrastructure projects.\n\n"
                    "#### Core Capabilities:\n"
                    "1. **Predictive Early Warning**: Automatically detects potential land acquisition delays months before civil construction contracts are stalled.\n"
                    "2. **Statutory Deadline Tracking**: Prevents costly notification lapses under the **National Highways Act 1956** (e.g. 1-year 3A-to-3D cliff).\n"
                    "3. **What-If Policy Simulation**: Allows directors and policy makers to simulate how increasing disbursal speed or legal settlement budgets cuts corridor delays.\n"
                    "4. **GIS Spatial Grounding**: PostGIS-powered geospatial corridor mapping preventing synthetic land assumptions.\n\n"
                    f"**Live System Status**: Currently tracking **{stats['total_projects']} verified projects** across India, "
                    f"with **{stats['high_risk_count']} high-risk corridors** requiring targeted administrative intervention."
                ),
                "actions": [
                    {"label": "Go to Priority Intelligence", "path": "/priority-intelligence"},
                    {"label": "Simulate in What-If Sandbox", "path": "/intelligence"},
                ],
                "suggestions": [
                    "Show me live system metrics",
                    "List all high risk projects",
                    "Explain statutory land acquisition laws"
                ]
            }

        # ── 3. High Risk / Delayed Projects Query ────────────────────────────
        if any(w in q for w in ["high risk", "delayed", "critical project", "bottleneck", "worst project", "risk project"]):
            high_risk = await self.get_high_risk_projects(db, limit=5)
            stats = await self.get_system_stats(db)

            if not high_risk:
                return {
                    "reply": (
                        f"Currently, there are **{stats['total_projects']} projects** recorded in the system. "
                        "None are categorized under Critical or High risk thresholds, or database records are syncing."
                    ),
                    "actions": [{"label": "View All Projects", "path": "/projects"}],
                    "suggestions": ["Show me total project statistics", "Explain Priority Score calculation"]
                }

            table_rows = []
            for p in high_risk:
                table_rows.append(
                    f"| **{p['name']}** | `{p['state']}` | 🔴 **{p['risk']}** | **{p['delay_months']} mos** | {p['legal_cases']} cases | {p['delay_reason']} |"
                )
            table_md = "\n".join(table_rows)

            return {
                "reply": (
                    f"### 🚨 Top High-Risk Corridors Requiring Urgent Attention\n\n"
                    f"Out of **{stats['total_projects']} monitored projects**, **{stats['high_risk_count']}** are flagged with Critical or High risk.\n\n"
                    "| Project Name | State | Risk Level | Delay | Active Court Cases | Primary Driver |\n"
                    "| :--- | :--- | :--- | :--- | :--- | :--- |\n"
                    f"{table_md}\n\n"
                    "> 💡 **Actionable Recommendation**: Review compensation disbursement ratios and expedite Section 3G CALA arbitration to clear Right-of-Way (RoW) for civil contractor mobilization."
                ),
                "actions": [
                    {"label": "Open Priority Queue", "path": "/priority-intelligence"},
                    {"label": "View GIS Corridor Map", "path": "/gis"},
                    {"label": "Review Active Alerts", "path": "/alerts"}
                ],
                "suggestions": [
                    "Tell me about legal disputes in these projects",
                    "What is the Section 3D statutory rule?",
                    "How can I resolve compensation bottlenecks?"
                ]
            }

        # ── 4. Legal Disputes / Court Cases ──────────────────────────────────
        if any(w in q for w in ["legal", "court", "dispute", "litigation", "stay", "case", "arbitration"]):
            return {
                "reply": (
                    "### ⚖️ Legal Disputes & CALA Arbitration Intelligence\n\n"
                    "In Indian Highway land acquisition, legal disputes predominantly arise under three categories:\n\n"
                    "1. **Disputed Land Ownership / Title Clashes**:\n"
                    "   - Disagreements between recorded pattadars and tenant cultivators.\n"
                    "   - *Remedy*: Disputed compensation is deposited with the Principal Civil Court under **Section 3H(4)**, while possession proceeds under Section 3E.\n\n"
                    "2. **Objections to CALA Award & Solatium (Section 3G(5))**:\n"
                    "   - Landowners dispute circle rate applicability or inadequate rural multiplication factors (1.0x–2.0x).\n"
                    "   - *Remedy*: Expeditious hearing before the appointed **Arbitrator** (Divisional Commissioner) without halting corridor possession.\n\n"
                    "3. **High Court Writ Petitions (Article 226)**:\n"
                    "   - Challenging non-compliance with the 1-year statutory limitation between Section 3A and Section 3D.\n"
                    "   - *LADRIS Safeguard*: The system triggers high-priority alerts when a project reaches **9 months** from Section 3A without a gazetted 3D."
                ),
                "actions": [
                    {"label": "View Alert Center", "path": "/alerts"},
                    {"label": "Open LA Workbench", "path": "/la-workbench"}
                ],
                "suggestions": [
                    "What happens if Section 3D is delayed past 1 year?",
                    "How is compensation calculated under RFCTLARR 2013?",
                    "Show projects with active court cases"
                ]
            }

        # ── 5. Statutory 3A, 3D, 3G / NH Act 1956 ────────────────────────────
        if any(w in q for w in ["3a", "3d", "3g", "3e", "3h", "nh act", "national highway act", "statutory", "lapse", "1 year"]):
            return {
                "reply": STATUTORY_KNOWLEDGE["nh_act_1956"],
                "actions": [
                    {"label": "LA Officer Workbench", "path": "/la-workbench"},
                    {"label": "Check Statutory Alerts", "path": "/alerts"}
                ],
                "suggestions": [
                    "What is the RFCTLARR 2013 solatium formula?",
                    "How does LADRIS calculate the Priority Score?",
                    "Which projects are close to the 1-year 3D cliff?"
                ]
            }

        # ── 6. RFCTLARR Act 2013 / Compensation ──────────────────────────────
        if any(w in q for w in ["rfctlarr", "compensation", "solatium", "market value", "r&r", "rehabilitation"]):
            return {
                "reply": STATUTORY_KNOWLEDGE["rfctlarr_2013"],
                "actions": [
                    {"label": "View What-If Simulator", "path": "/intelligence"},
                    {"label": "Open LA Workbench", "path": "/la-workbench"}
                ],
                "suggestions": [
                    "Explain Section 3A to 3D statutory workflow",
                    "How to prevent projects from lapsing?",
                    "Show projects with compensation backlogs"
                ]
            }

        # ── 7. Priority Score & AI Methodology ───────────────────────────────
        if any(w in q for w in ["priority score", "score", "how is it calculated", "algorithm", "formula", "methodology"]):
            return {
                "reply": (
                    STATUTORY_KNOWLEDGE["priority_score"] + "\n\n"
                    "#### 🛡️ Non-Causal & Scientific Safeguard Standard:\n"
                    "- **Decision Support Only**: LADRIS rankings are administrative alerts, not judicial determinations.\n"
                    "- **Zero Hallucination**: Projects without verified geocodes are tagged `Location Unavailable` rather than hallucinating coordinates.\n"
                    "- **Supervised Delay Prediction Deferred**: To maintain strict integrity, causal ML delay regression is deferred until $N \\ge 200$ fully completed real-world project timelines are audited."
                ),
                "actions": [
                    {"label": "Explore Priority Intelligence", "path": "/priority-intelligence"},
                    {"label": "Review Data Quality", "path": "/data-quality"}
                ],
                "suggestions": [
                    "Show me the highest priority projects",
                    "Explain the GIS Risk Map",
                    "How does BhoomiRashi scraper work?"
                ]
            }

        # ── 8. Navigation & Screen Guides ────────────────────────────────────
        for nav_key, nav_info in NAVIGATION_MAP.items():
            if nav_key in q or nav_info["title"].lower() in q or nav_info["path"] in q:
                return {
                    "reply": (
                        f"### 🧭 Guide to {nav_info['title']}\n\n"
                        f"**Route**: `{nav_info['path']}`\n\n"
                        f"**Function**: {nav_info['desc']}\n\n"
                        "#### Recommended Actions on this screen:\n"
                        "- Use the top filters (State, District, Risk Level) to narrow your scope.\n"
                        "- Export CSV/PDF summaries for inter-departmental review meetings.\n"
                        "- Click on any corridor card to dive into its full SLA lifecycle."
                    ),
                    "actions": [
                        {"label": f"Navigate to {nav_info['title']}", "path": nav_info["path"]},
                        {"label": "Command Dashboard", "path": "/dashboard"}
                    ],
                    "suggestions": [
                        "What other pages are available?",
                        "How do I use the What-If Simulator?",
                        "Show high risk projects"
                    ]
                }

        # ── 9. GIS Map Query ─────────────────────────────────────────────────
        if any(w in q for w in ["gis", "map", "spatial", "coordinates", "postgis", "latitude", "longitude"]):
            return {
                "reply": (
                    "### 🗺️ GIS Risk Map Intelligence\n\n"
                    "The **GIS Risk Map** (`/gis`) provides an interactive geospatial view of highway alignments across India:\n\n"
                    "- **Dynamic Risk Heat & Markers**: Colored pins indicate risk levels (🔴 Critical, 🟠 High, 🟡 Medium, 🟢 Low).\n"
                    "- **Verified PostGIS Coordinates**: All coordinates are verified from actual MoRTH/NHAI notification gazettes.\n"
                    "- **Strict Integrity Rule**: Projects without verified geocodes appear in a dedicated sidebar list labeled *Location Unavailable* to prevent misleading spatial projections.\n"
                    "- **Corridor Inspection**: Click any marker on the map to inspect compensation velocity, gazette dates, and legal dispute tags."
                ),
                "actions": [
                    {"label": "Open Interactive GIS Map", "path": "/gis"},
                    {"label": "View Priority Intelligence", "path": "/priority-intelligence"}
                ],
                "suggestions": [
                    "Show me high risk projects on the map",
                    "What is Section 3A to 3D timeline?",
                    "How are legal disputes mapped?"
                ]
            }

        # ── 10. Specific Project Search (e.g. "Sangareddy", "NH-65") ──────────
        words = [w.strip(",.?!") for w in q.split() if len(w) >= 3 and w not in ["the", "show", "tell", "about", "what", "project", "status", "info"]]
        for word in words:
            found_projects = await self.search_projects(db, word, limit=2)
            if found_projects:
                p = found_projects[0]
                return {
                    "reply": (
                        f"### 📍 Project Record: {p['name']}\n\n"
                        f"- **Code**: `{p['code']}`\n"
                        f"- **State**: {p['state']}\n"
                        f"- **Status**: **{p['status']}** | **Risk Level**: **{p['risk']}**\n"
                        f"- **Recorded Delay**: **{p['delay_months']} months**\n"
                        f"- **Delay Factor**: {p['delay_reason']}\n"
                        f"- **Active Court Cases**: {p['legal_cases']} pending\n"
                        f"- **Gazette Notifications**: 3A: `{p['notification_3a'] or 'Pending'}` | 3D: `{p['notification_3d'] or 'Pending'}`\n\n"
                        "> Click below to view the complete SLA lifecycle, compensation breakdown, and risk fingerprint."
                    ),
                    "actions": [
                        {"label": f"Open {p['name']} Workspace", "path": f"/projects/{p['id']}"},
                        {"label": "View on GIS Map", "path": "/gis"}
                    ],
                    "suggestions": [
                        "Show all high risk projects",
                        "What is Section 3D statutory deadline?",
                        "How do I simulate solutions in What-If tool?"
                    ]
                }

        # ── 11. System Statistics / Status ───────────────────────────────────
        if any(w in q for w in ["stat", "summary", "how many", "count", "metrics", "number of"]):
            stats = await self.get_system_stats(db)
            return {
                "reply": (
                    "### 📊 Live LADRIS Platform Statistics\n\n"
                    f"- **Total Monitored Highway Projects**: **{stats['total_projects']}**\n"
                    f"- **Active Critical / High Risk Projects**: **{stats['high_risk_count']}**\n"
                    f"- **Officially Delayed Projects**: **{stats['delayed_count']}**\n"
                    f"- **Active System Early-Warning Alerts**: **{stats['active_alerts']}**\n\n"
                    "All metrics are updated continuously through automated ingestion from BhoomiRashi gazettes, e-Courts case feeds, and state revenue portal updates."
                ),
                "actions": [
                    {"label": "View Command Dashboard", "path": "/dashboard"},
                    {"label": "Open Priority Queue", "path": "/priority-intelligence"},
                    {"label": "Check Data Sources", "path": "/data-sources"}
                ],
                "suggestions": [
                    "List the top high-risk projects",
                    "How is the priority score calculated?",
                    "What is Section 3A to 3D timeline?"
                ]
            }

        # ── 12. General Fallback with Comprehensive Context ──────────────────
        stats = await self.get_system_stats(db)
        return {
            "reply": (
                "### 🤖 Saarthi Decision Support\n\n"
                f"I parsed your question regarding **\"{query}\"**.\n\n"
                "As the **LADRIS AI Assistant**, I have instant access to our real-time database ("
                f"**{stats['total_projects']} projects**, **{stats['high_risk_count']} high-risk corridors**), "
                "statutory regulations (NH Act 1956, RFCTLARR 2013), and all platform capabilities.\n\n"
                "Here are key areas I can answer immediately:\n"
                "- 🚨 **Project Delays**: Inquire about high-risk corridors, delay reasons, or specific highway names (e.g. *\"Sangareddy Bypass\"*).\n"
                "- 📜 **Statutory Deadlines**: Ask about the mandatory 1-year Section 3A-to-3D rule, Section 3G CALA arbitration, or 100% solatium.\n"
                "- 🧭 **Platform Navigation**: Ask how to use the **GIS Map**, **What-If Simulator**, **LA Workbench**, or **Alerts**.\n\n"
                "Choose one of the quick options below or type your specific query!"
            ),
            "actions": [
                {"label": "📊 Command Dashboard", "path": "/dashboard"},
                {"label": "🚨 Priority Intelligence", "path": "/priority-intelligence"},
                {"label": "🗺️ Open GIS Map", "path": "/gis"},
            ],
            "suggestions": [
                "Which projects have the highest delay risk?",
                "What is the Section 3D statutory 1-year rule?",
                "How does the Priority Score work?",
                "Show live platform statistics"
            ]
        }


# Singleton service instance
saarthi_service = SaarthiService()
