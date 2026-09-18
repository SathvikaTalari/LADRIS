"""
populate_all_project_parcels.py

Populates rich, realistic PostGIS spatial data for all 12 projects in LADRIS:
- Route alignment LineStrings (corridor route)
- Boundary polygons
- Realistic land parcels (Khasra numbers, village breakdown, 3 status colors: Red/Orange/Green,
  detailed ownership, compensation, legal status, and days pending).
"""

import asyncio
import json
import math
from sqlalchemy import text
from app.database import AsyncSessionLocal

PROJECT_DATA = {
    "TG-NHAI-SRD-001": {
        "name": "NH65 Sangareddy Highway Four-Laning",
        # Already has 4 parcels in land_parcels, let's add alignment and boundary
        "alignment_coords": [
            [78.570, 17.325],
            [78.588, 17.322],
            [78.606, 17.319],
            [78.618, 17.316],
            [78.670, 17.285],
            [78.730, 17.255],
            [78.750, 17.240]
        ],
        "skip_parcels": True  # Already has 4 detailed parcels
    },
    "TG-IRR-KHM-008": {
        "name": "Khammam Lift Irrigation Expansion Package",
        "bearing_deg": 35,
        "district": "Khammam",
        "tehsil": "Khammam Rural",
        "state_code": "TG",
        "project_type": "IRRIGATION",
        "parcels": [
            {
                "kn": "102/1",
                "village": "Raghunathapalem",
                "tehsil": "Khammam Rural",
                "area_ha": 16.4,
                "owners": 4,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 310,
                "ownership_status": "Title Disputed (Inheritance & Succession Claim)",
                "compensation_status": "Stayed by Telangana High Court Order",
                "legal_status": "High Court Injunction (WP-1289/2023)"
            },
            {
                "kn": "104/A",
                "village": "Raghunathapalem",
                "tehsil": "Khammam Rural",
                "area_ha": 21.8,
                "owners": 3,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 265,
                "ownership_status": "Boundary Dispute with Irrigation Canal Reserve",
                "compensation_status": "Section 19 Notification Challenged in Court",
                "legal_status": "Civil Court Status Quo Order (OS-88/2023)"
            },
            {
                "kn": "118/2",
                "village": "Maddulapalli",
                "tehsil": "Khammam Rural",
                "area_ha": 14.2,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 175,
                "ownership_status": "Joint Ownership (Verified Patta Passbook)",
                "compensation_status": "Section 23 Award Inquiry in Progress",
                "legal_status": "Clear / No Litigation"
            },
            {
                "kn": "125/3",
                "village": "Maddulapalli",
                "tehsil": "Khammam Rural",
                "area_ha": 18.5,
                "owners": 1,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 95,
                "ownership_status": "Single Title Holder",
                "compensation_status": "Award Passed — Treasury Release Pending",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "201/1",
                "village": "Edulapuram",
                "tehsil": "Khammam Urban",
                "area_ha": 12.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired (CALA)",
                "compensation_status": "100% Disbursed (Direct Benefit Transfer)",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "204/B",
                "village": "Edulapuram",
                "tehsil": "Khammam Urban",
                "area_ha": 25.3,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired & Demarcated",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "UP-NHAI-VNS-007": {
        "name": "Varanasi Eastern Bypass Land Acquisition",
        "bearing_deg": 60,
        "district": "Varanasi",
        "tehsil": "Pindra",
        "state_code": "UP",
        "project_type": "HIGHWAY",
        "parcels": [
            {
                "kn": "45/A",
                "village": "Shivpur",
                "tehsil": "Pindra",
                "area_ha": 19.5,
                "owners": 5,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 340,
                "ownership_status": "Title Partition Suit Pending in High Court",
                "compensation_status": "Compensation Apportionment Stayed",
                "legal_status": "Allahabad HC Stay (WP-3341/2023)"
            },
            {
                "kn": "52/1",
                "village": "Shivpur",
                "tehsil": "Pindra",
                "area_ha": 15.0,
                "owners": 2,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 280,
                "ownership_status": "Religious Trust Land Ownership Dispute",
                "compensation_status": "Section 3H Reference to District Judge",
                "legal_status": "Reference U/S 3H(4) NHAI Act Active"
            },
            {
                "kn": "78/2",
                "village": "Ramnagar",
                "tehsil": "Varanasi Sadar",
                "area_ha": 22.1,
                "owners": 3,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 150,
                "ownership_status": "Joint Ownership (Revenue Mutation Pending)",
                "compensation_status": "Award Declared — Awaiting Tehsil Clearance",
                "legal_status": "Clear / No Litigation"
            },
            {
                "kn": "84/B",
                "village": "Ramnagar",
                "tehsil": "Varanasi Sadar",
                "area_ha": 17.8,
                "owners": 1,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 80,
                "ownership_status": "Single Title Holder",
                "compensation_status": "Structure Valuation Review Pending",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "112/1",
                "village": "Chunar Link",
                "tehsil": "Varanasi Sadar",
                "area_ha": 14.6,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired Land",
                "compensation_status": "100% Disbursed to Beneficiary",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "115/3",
                "village": "Chunar Link",
                "tehsil": "Varanasi Sadar",
                "area_ha": 26.2,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired & Handed Over",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "MH-PWD-PUN-004": {
        "name": "Pune Ring Road Land Acquisition Package",
        "bearing_deg": 120,
        "district": "Pune",
        "tehsil": "Maval",
        "state_code": "MH",
        "project_type": "HIGHWAY",
        "parcels": [
            {
                "kn": "210/1",
                "village": "Urse",
                "tehsil": "Maval",
                "area_ha": 18.0,
                "owners": 4,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 220,
                "ownership_status": "Title Dispute between Co-parceners",
                "compensation_status": "Civil Court Injunction Order",
                "legal_status": "Civil Court Senior Division Stay"
            },
            {
                "kn": "214/A",
                "village": "Parandwadi",
                "tehsil": "Maval",
                "area_ha": 12.5,
                "owners": 3,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 140,
                "ownership_status": "Joint Ownership (Heirs Verification Pending)",
                "compensation_status": "Award Passed — Consent Terms Pending",
                "legal_status": "No Litigation"
            },
            {
                "kn": "218/3",
                "village": "Parandwadi",
                "tehsil": "Maval",
                "area_ha": 16.0,
                "owners": 1,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 75,
                "ownership_status": "Single Title Holder",
                "compensation_status": "Horticultural Valuation Sanction Pending",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "301/2",
                "village": "Khed Shivapur",
                "tehsil": "Haveli",
                "area_ha": 20.4,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "MSRDC Acquired",
                "compensation_status": "100% Disbursed via Direct Bank Transfer",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "305/1",
                "village": "Khed Shivapur",
                "tehsil": "Haveli",
                "area_ha": 14.8,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "MSRDC Acquired & Demarcated",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "312/B",
                "village": "Kasar Amboli",
                "tehsil": "Mulshi",
                "area_ha": 23.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "AP-NICDC-NLR-009": {
        "name": "Nellore Industrial Corridor Land Package",
        "bearing_deg": 15,
        "district": "Nellore",
        "tehsil": "Chillakur",
        "state_code": "AP",
        "project_type": "INDUSTRIAL_CORRIDOR",
        "parcels": [
            {
                "kn": "67/1",
                "village": "Menakur",
                "tehsil": "Chillakur",
                "area_ha": 24.0,
                "owners": 6,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 350,
                "ownership_status": "D-Form Patta Land Resumption Dispute",
                "compensation_status": "AP High Court Stay on Section 11 Notification",
                "legal_status": "High Court Injunction (WP-5512/2023)"
            },
            {
                "kn": "71/B",
                "village": "Menakur",
                "tehsil": "Chillakur",
                "area_ha": 19.2,
                "owners": 3,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 290,
                "ownership_status": "Title Succession & Joint Tenancy Conflict",
                "compensation_status": "Stayed by District Collector Order",
                "legal_status": "Revenue Divisional Officer Inquiry Pending"
            },
            {
                "kn": "88/2",
                "village": "Chillakur",
                "tehsil": "Chillakur",
                "area_ha": 15.5,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 160,
                "ownership_status": "Joint Ownership (Passbooks Verified)",
                "compensation_status": "Special Dy. Collector Award Approval Pending",
                "legal_status": "Clear / No Litigation"
            },
            {
                "kn": "94/1",
                "village": "Chillakur",
                "tehsil": "Chillakur",
                "area_ha": 21.0,
                "owners": 1,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 85,
                "ownership_status": "Single Title Holder",
                "compensation_status": "Treasury ECS Mandate Processing",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "130/4",
                "village": "Gudur Rural",
                "tehsil": "Gudur",
                "area_ha": 28.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "APIIC Acquired",
                "compensation_status": "100% Disbursed via CFMS Andhra Pradesh",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "135/2",
                "village": "Gudur Rural",
                "tehsil": "Gudur",
                "area_ha": 22.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "APIIC Acquired & Demarcated",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "RJ-DFCCIL-JPR-005": {
        "name": "Jaipur Freight Corridor Land Package",
        "bearing_deg": 80,
        "district": "Jaipur",
        "tehsil": "Phulera",
        "state_code": "RJ",
        "project_type": "RAILWAY",
        "parcels": [
            {
                "kn": "312/A",
                "village": "Phulera",
                "tehsil": "Phulera",
                "area_ha": 17.5,
                "owners": 4,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 260,
                "ownership_status": "Title Dispute under Railways Act Sec 20E",
                "compensation_status": "Arbitration Proceedings Active",
                "legal_status": "High Court Rajasthan Stay on Possession"
            },
            {
                "kn": "315/2",
                "village": "Phulera",
                "tehsil": "Phulera",
                "area_ha": 14.0,
                "owners": 3,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 170,
                "ownership_status": "Commercial vs Agricultural Rate Discrepancy",
                "compensation_status": "Award Enhancement Petition Pending",
                "legal_status": "Clear / No Court Stay"
            },
            {
                "kn": "340/1",
                "village": "Sanganer West",
                "tehsil": "Sanganer",
                "area_ha": 19.8,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 90,
                "ownership_status": "Joint Title Verified",
                "compensation_status": "Treasury Clearance Awaited",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "402/1",
                "village": "Bassi",
                "tehsil": "Bassi",
                "area_ha": 16.2,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "DFCCIL Acquired Land",
                "compensation_status": "100% Disbursed (Direct Transfer)",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "408/3",
                "village": "Bassi",
                "tehsil": "Bassi",
                "area_ha": 21.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "DFCCIL Acquired & In Possession",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "KA-BMRCL-BLR-006": {
        "name": "Bengaluru Metro Extension Land Package",
        "bearing_deg": 100,
        "district": "Bengaluru Urban",
        "tehsil": "Bengaluru East",
        "state_code": "KA",
        "project_type": "URBAN_DEVELOPMENT",
        "parcels": [
            {
                "kn": "89/1",
                "village": "Whitefield",
                "tehsil": "Bengaluru East",
                "area_ha": 8.5,
                "owners": 5,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 270,
                "ownership_status": "Commercial Property Setback & Demolition Dispute",
                "compensation_status": "Karnataka High Court Stay Order",
                "legal_status": "Karnataka HC Injunction (WP-9104/2023)"
            },
            {
                "kn": "92/A",
                "village": "Hoodi",
                "tehsil": "Bengaluru East",
                "area_ha": 11.2,
                "owners": 3,
                "status_color": "ORANGE",
                "is_hotspot": True,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 135,
                "ownership_status": "Commercial Tenants Relocation Package Under Review",
                "compensation_status": "KIADB Award Declared — Tenant Consent Pending",
                "legal_status": "Clear / No Litigation"
            },
            {
                "kn": "95/3",
                "village": "Hoodi",
                "tehsil": "Bengaluru East",
                "area_ha": 9.4,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "OWNERSHIP",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 80,
                "ownership_status": "Khata Bifurcation Pending at BBMP",
                "compensation_status": "Award Passed — Awaiting A-Khata Certificate",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "104/2",
                "village": "Kadugodi",
                "tehsil": "Bengaluru East",
                "area_ha": 14.8,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "BMRCL Acquired Land",
                "compensation_status": "100% Disbursed via KIADB Portal",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "108/1",
                "village": "Kadugodi",
                "tehsil": "Bengaluru East",
                "area_ha": 12.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "BMRCL Acquired & In Possession",
                "compensation_status": "100% Disbursed & Viaduct Work Started",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "115/B",
                "village": "Channasandra",
                "tehsil": "Bengaluru East",
                "area_ha": 16.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "GJ-NHAI-VAD-003": {
        "name": "Vadodara Expressway Link Package",
        "bearing_deg": 140,
        "district": "Vadodara",
        "tehsil": "Vadodara Rural",
        "state_code": "GJ",
        "project_type": "HIGHWAY",
        "parcels": [
            {
                "kn": "16/1",
                "village": "Makarpura",
                "tehsil": "Vadodara Rural",
                "area_ha": 14.5,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 60,
                "ownership_status": "Joint Title Verified",
                "compensation_status": "CALA Award Sanction Awaiting Treasury Release",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "22/A",
                "village": "Makarpura",
                "tehsil": "Vadodara Rural",
                "area_ha": 18.2,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired Land",
                "compensation_status": "100% Disbursed (DBT Direct Transfer)",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "48/3",
                "village": "Por",
                "tehsil": "Vadodara Rural",
                "area_ha": 22.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired & Demarcated",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "54/1",
                "village": "Chhani",
                "tehsil": "Vadodara Rural",
                "area_ha": 16.8,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "61/2",
                "village": "Dashrath",
                "tehsil": "Vadodara Rural",
                "area_ha": 25.4,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired & Handover Complete",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "GJ-DFCCIL-SRT-010": {
        "name": "Surat Freight Corridor Land Acquisition",
        "bearing_deg": 45,
        "district": "Surat",
        "tehsil": "Choryasi",
        "state_code": "GJ",
        "project_type": "RAILWAY",
        "parcels": [
            {
                "kn": "34/1",
                "village": "Sachin",
                "tehsil": "Choryasi",
                "area_ha": 15.0,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 65,
                "ownership_status": "Tenant Rehabilitation Assessment Ongoing",
                "compensation_status": "Award Sanctioned — Tenant Clearance Pending",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "40/B",
                "village": "Sachin",
                "tehsil": "Choryasi",
                "area_ha": 19.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "DFCCIL Acquired Land",
                "compensation_status": "100% Disbursed via RTGS",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "55/2",
                "village": "Bhestan",
                "tehsil": "Choryasi",
                "area_ha": 21.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "DFCCIL Acquired & Demarcated",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "71/1",
                "village": "Udhna North",
                "tehsil": "Choryasi",
                "area_ha": 17.2,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Railways Land Handed Over",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "82/3",
                "village": "Palsana",
                "tehsil": "Palsana",
                "area_ha": 24.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "UP-NHAI-LKO-011": {
        "name": "Lucknow Highway Expansion Package",
        "bearing_deg": 130,
        "district": "Lucknow",
        "tehsil": "Mohanlalganj",
        "state_code": "UP",
        "project_type": "HIGHWAY",
        "parcels": [
            {
                "kn": "41/2",
                "village": "Mohanlalganj",
                "tehsil": "Mohanlalganj",
                "area_ha": 16.0,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 55,
                "ownership_status": "Joint Title Verified",
                "compensation_status": "Orchard Asset Valuation Appraisal Ongoing",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "47/A",
                "village": "Mohanlalganj",
                "tehsil": "Mohanlalganj",
                "area_ha": 20.2,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired Land",
                "compensation_status": "100% Disbursed via DBT",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "63/1",
                "village": "Sarojini Nagar",
                "tehsil": "Sarojini Nagar",
                "area_ha": 18.5,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NHAI Acquired & Possessed",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "79/3",
                "village": "Gosainganj",
                "tehsil": "Mohanlalganj",
                "area_ha": 23.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "88/1",
                "village": "Bakkas",
                "tehsil": "Mohanlalganj",
                "area_ha": 15.6,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired & Handover Complete",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "MP-NWDA-PNA-012": {
        "name": "Panna Water Infrastructure Land Package",
        "bearing_deg": 65,
        "district": "Panna",
        "tehsil": "Ajaigarh",
        "state_code": "MP",
        "project_type": "IRRIGATION",
        "parcels": [
            {
                "kn": "19/1",
                "village": "Ajaigarh",
                "tehsil": "Ajaigarh",
                "area_ha": 17.5,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 70,
                "ownership_status": "Forest Fringe Boundary Joint Demarcation Pending",
                "compensation_status": "Award Declared — Forest Clearance Verification Ongoing",
                "legal_status": "Clear / No Litigation"
            },
            {
                "kn": "25/B",
                "village": "Ajaigarh",
                "tehsil": "Ajaigarh",
                "area_ha": 21.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "NWDA Acquired Land",
                "compensation_status": "100% Disbursed via State Treasury",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "38/1",
                "village": "Devendranagar",
                "tehsil": "Devendranagar",
                "area_ha": 19.8,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Water Resources Dept Acquired",
                "compensation_status": "100% Disbursed & In Physical Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "44/2",
                "village": "Gunnor",
                "tehsil": "Gunnor",
                "area_ha": 16.4,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "51/3",
                "village": "Pawai",
                "tehsil": "Pawai",
                "area_ha": 25.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired & Handed Over",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            }
        ]
    },
    "AP-RVNL-GNT-002": {
        "name": "Guntur Rail Connectivity Expansion",
        "bearing_deg": 50,
        "district": "Guntur",
        "tehsil": "Guntur Rural",
        "state_code": "AP",
        "project_type": "RAILWAY",
        "parcels": [
            {
                "kn": "28/1",
                "village": "Namburu",
                "tehsil": "Guntur Rural",
                "area_ha": 18.0,
                "owners": 3,
                "status_color": "RED",
                "is_hotspot": True,
                "issue_type": "LEGAL",
                "has_legal": True,
                "is_notif": True,
                "is_award": False,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 240,
                "ownership_status": "Alignment Encroachment & RoW Dispute",
                "compensation_status": "Stayed by Andhra Pradesh High Court",
                "legal_status": "AP High Court Stay (WP-6120/2023)"
            },
            {
                "kn": "33/A",
                "village": "Pedakakani",
                "tehsil": "Pedakakani",
                "area_ha": 14.5,
                "owners": 2,
                "status_color": "ORANGE",
                "is_hotspot": False,
                "issue_type": "COMPENSATION",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": False,
                "is_poss": False,
                "days_pending": 75,
                "ownership_status": "Title Succession Verification in Progress",
                "compensation_status": "Section 20F Award Passed — Treasury Clearance Awaited",
                "legal_status": "Clear / No Dispute"
            },
            {
                "kn": "49/2",
                "village": "Pedakakani",
                "tehsil": "Pedakakani",
                "area_ha": 20.4,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "RVNL Acquired Land",
                "compensation_status": "100% Disbursed (Direct Benefit Transfer)",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "56/1",
                "village": "Tadikonda",
                "tehsil": "Tadikonda",
                "area_ha": 17.8,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Railways Land In Possession",
                "compensation_status": "100% Disbursed & In Possession",
                "legal_status": "Clear Title Registered"
            },
            {
                "kn": "68/3",
                "village": "Mangalagiri",
                "tehsil": "Mangalagiri",
                "area_ha": 24.0,
                "owners": 1,
                "status_color": "GREEN",
                "is_hotspot": False,
                "issue_type": "NONE",
                "has_legal": False,
                "is_notif": True,
                "is_award": True,
                "is_comp": True,
                "is_poss": True,
                "days_pending": 0,
                "ownership_status": "Government Acquired & Handover Complete",
                "compensation_status": "100% Disbursed & Track Doubling Started",
                "legal_status": "Clear Title Registered"
            }
        ]
    }
}


def generate_parcel_geometry(center_lat: float, center_lng: float, index: int, total: int, bearing_deg: float):
    """
    Generates a realistic 4-corner polygon parcel alongside the route corridor.
    """
    theta = math.radians(bearing_deg)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    # Offset along the route alignment centerline
    # Each parcel is ~600m long, separated by a 100m gap
    spacing = 0.007  # approx 700m in lat/lng
    s_start = (index - total / 2.0) * spacing
    s_end = s_start + 0.0055

    # Side of the alignment: alternate or flank on one side
    w_offset = 0.0008  # slight gap from center line
    width = 0.0040     # parcel depth

    # Parcel 4 corners [lng, lat]
    p1 = [
        round(center_lng + s_start * cos_t - (w_offset + width) * sin_t, 6),
        round(center_lat + s_start * sin_t + (w_offset + width) * cos_t, 6)
    ]
    p2 = [
        round(center_lng + s_end * cos_t - (w_offset + width) * sin_t, 6),
        round(center_lat + s_end * sin_t + (w_offset + width) * cos_t, 6)
    ]
    p3 = [
        round(center_lng + s_end * cos_t - w_offset * sin_t, 6),
        round(center_lat + s_end * sin_t + w_offset * cos_t, 6)
    ]
    p4 = [
        round(center_lng + s_start * cos_t - w_offset * sin_t, 6),
        round(center_lat + s_start * sin_t + w_offset * cos_t, 6)
    ]

    # Closed polygon ring
    return {
        "type": "Polygon",
        "coordinates": [[p1, p2, p3, p4, p1]]
    }


def generate_alignment_geometry(center_lat: float, center_lng: float, total_parcels: int, bearing_deg: float):
    """
    Generates an alignment route LineString passing straight through the corridor.
    """
    theta = math.radians(bearing_deg)
    cos_t = math.cos(theta)
    sin_t = math.sin(theta)

    spacing = 0.007
    s_min = (-total_parcels / 2.0 - 0.8) * spacing
    s_max = (total_parcels / 2.0 + 0.8) * spacing

    # 5-point alignment LineString
    steps = 5
    coords = []
    for i in range(steps):
        s = s_min + (s_max - s_min) * (i / (steps - 1))
        # Add subtle natural curve
        wiggle = 0.0004 * math.sin(i * 1.5)
        lng = round(center_lng + s * cos_t + wiggle * sin_t, 6)
        lat = round(center_lat + s * sin_t + wiggle * cos_t, 6)
        coords.append([lng, lat])

    return {
        "type": "LineString",
        "coordinates": coords
    }


async def run_population():
    async with AsyncSessionLocal() as session:
        # Fetch all active projects
        res = await session.execute(text("""
            SELECT id, project_code, name, latitude, longitude, state_code, district_codes, executing_agency, nodal_agency
            FROM projects
            WHERE deleted_at IS NULL
        """))
        projects_in_db = {row[1]: row for row in res.fetchall()}

        print(f"Found {len(projects_in_db)} active projects in database.")

        for code, conf in PROJECT_DATA.items():
            proj_row = projects_in_db.get(code)
            if not proj_row:
                print(f"Warning: Project {code} not found in database, skipping.")
                continue

            pid = proj_row[0]
            lat = float(proj_row[3])
            lng = float(proj_row[4])

            print(f"\nProcessing {code} ({proj_row[2]})...")

            # 1. Update Project Alignment Geometry
            if "alignment_coords" in conf:
                alignment_geom = {
                    "type": "LineString",
                    "coordinates": conf["alignment_coords"]
                }
            else:
                bearing = conf.get("bearing_deg", 45)
                parcels_len = len(conf.get("parcels", []))
                alignment_geom = generate_alignment_geometry(lat, lng, parcels_len, bearing)

            align_json = json.dumps(alignment_geom)
            await session.execute(text("""
                UPDATE projects
                SET alignment_geom = ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)
                WHERE id = :pid
            """), {"geom": align_json, "pid": pid})
            print(f"  -> Updated alignment_geom route LineString.")

            # 2. Skip parcels if already defined (e.g. TG-NHAI-SRD-001)
            if conf.get("skip_parcels"):
                print(f"  -> Skipping parcel insert (already has existing parcels).")
                continue

            # Delete any existing parcels for this project to ensure clean idempotency
            await session.execute(text("DELETE FROM land_parcels WHERE project_id = :pid"), {"pid": pid})

            parcels_list = conf.get("parcels", [])
            bearing = conf.get("bearing_deg", 45)

            for idx, p_cfg in enumerate(parcels_list):
                geom = generate_parcel_geometry(lat, lng, idx, len(parcels_list), bearing)
                geom_str = json.dumps(geom)

                kn = p_cfg["kn"]
                vil = p_cfg["village"]
                teh = p_cfg["tehsil"]
                dist = conf["district"]
                area = p_cfg["area_ha"]

                merged_props = {
                    "parcel_id": f"{code}-{idx+1:03d}",
                    "khasra_number": kn,
                    "village": vil,
                    "tehsil": teh,
                    "district": dist,
                    "state_code": conf["state_code"],
                    "area_ha": area,
                    "project_name": conf["name"],
                    "project_code": code,
                    "project_type": conf["project_type"],
                    "ownership_status": p_cfg["ownership_status"],
                    "compensation_status": p_cfg["compensation_status"],
                    "legal_status": p_cfg["legal_status"],
                    "days_pending": p_cfg["days_pending"],
                    "status_color": p_cfg["status_color"],
                    "is_hotspot": p_cfg["is_hotspot"],
                    "issue_type": p_cfg["issue_type"],
                }

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
                        "pid": pid,
                        "kn": kn,
                        "vil": vil,
                        "teh": teh,
                        "dist": dist,
                        "area": area,
                        "owners": p_cfg.get("owners", 1),
                        "notif": p_cfg.get("is_notif", True),
                        "award": p_cfg.get("is_award", False),
                        "comp": p_cfg.get("is_comp", False),
                        "poss": p_cfg.get("is_poss", False),
                        "legal": p_cfg.get("has_legal", False),
                        "props": json.dumps(merged_props),
                        "geom": geom_str,
                    },
                )
            print(f"  -> Inserted {len(parcels_list)} parcels for {code}.")

        await session.commit()
        print("\nAll 12 projects successfully equipped with detailed GIS spatial data!")


if __name__ == "__main__":
    asyncio.run(run_population())
