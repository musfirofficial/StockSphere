"""
backend/seed_data.py

Comprehensive realistic dataset generator for StockSphere:
- 400 Inventory Items
- 120 Suppliers (with Active & Inactive statuses)
- 25 Hardware Categories
- 14 Standard Units
- 10 System Users (Admin, Manager, Sales, Auditor)
- Multi-Supplier M:M Links with Agreed Prices & Primary Supplier Flags
- Stock Batches with Expiry Dates, Purchase Costs & Batch-Level Selling Prices
- Purchase Orders with Line Items & Full Lifecycle Statuses
- 1,200+ Mathematically Consistent Stock Transactions across 7 Types
- Stock Alerts (CRITICAL, LOW_STOCK, RESOLVED)
- Comprehensive Audit Trail Logs
"""

import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from collections import defaultdict

from sqlalchemy import select, delete, insert

from app.database import async_session_maker, create_db_and_tables
from app.models import (
    User,
    UserRole,
    Category,
    Unit,
    Supplier,
    Item,
    ItemSupplier,
    StockBatch,
    PurchaseOrder,
    PurchaseOrderItem,
    POStatus,
    Transaction,
    TransactionType,
    StockAlert,
    AlertStatus,
    AuditLog,
    AuditAction,
)
from app.services.security import hash_password

# --------------------------------------------------------------------------- #
# Constants & Configuration
# --------------------------------------------------------------------------- #
local_tz = timezone(timedelta(hours=5, minutes=30))

NUM_CATEGORIES = 25
NUM_SUPPLIERS = 120
NUM_INACTIVE_SUPPLIERS = 15
NUM_ITEMS = 400
NUM_INACTIVE_ITEMS = 35
TARGET_TRANSACTIONS = 1200

# --------------------------------------------------------------------------- #
# Realistic Sri Lankan Names and Addresses Pool
# --------------------------------------------------------------------------- #
SINHALA_FIRST = [
    "Nimal", "Sunil", "Kamal", "Chaminda", "Ruwan", "Saman", "Priyantha",
    "Chandana", "Dilshan", "Lasantha", "Nuwan", "Roshan", "Tharindu",
    "Kasun", "Amila", "Nadeesha", "Chathurika", "Dilrukshi", "Kumari",
    "Malani", "Priyanka", "Sanduni", "Nayana", "Iresha", "Anusha",
    "Dhanushka", "Gayan", "Bandula", "Sanjeewa", "Pradeep", "Mahesh",
]
SINHALA_LAST = [
    "Perera", "Fernando", "Silva", "Jayasuriya", "Wickramasinghe",
    "Gunasekara", "Rajapaksa", "Bandara", "Dissanayake", "Weerasinghe",
    "Karunaratne", "Mendis", "Rathnayake", "Senanayake", "Abeywickrama",
    "Alwis", "Gunawardena", "Peiris", "Liyanage", "Fonseka",
]
TAMIL_FIRST = [
    "Kumar", "Suresh", "Ravi", "Prasanna", "Vijay", "Anand", "Kishore",
    "Priya", "Kavitha", "Deepa", "Nirosha", "Thivya", "Vani", "Selvi",
    "Karthik", "Ramesh", "Sanjay", "Bhavani", "Dharshini", "Meena",
]
TAMIL_LAST = [
    "Rajendran", "Kumaraswamy", "Sivakumar", "Muthulingam", "Sabaratnam",
    "Thiruchelvam", "Balasubramaniam", "Ganeshan", "Selvarajah", "Nadarajah",
]
MUSLIM_FIRST = [
    "Mohamed", "Ahamed", "Fathima", "Rizwan", "Nazeer", "Farhana",
    "Shafraz", "Rikaza", "Rushdie", "Ismail", "Nusrath", "Mansoor",
    "Imran", "Tariq", "Zameer", "Shazna", "Akeel", "Shakir",
]
MUSLIM_LAST = [
    "Hameed", "Rasheed", "Careem", "Marikkar", "Naina", "Thaha",
    "Jayah", "Nizam", "Iqbal", "Rauf", "Cassim", "Fazil",
]

CITIES = [
    "Colombo", "Kandy", "Galle", "Negombo", "Jaffna", "Kurunegala",
    "Anuradhapura", "Batticaloa", "Trincomalee", "Matara", "Ratnapura",
    "Badulla", "Nuwara Eliya", "Gampaha", "Kalutara", "Puttalam",
    "Polonnaruwa", "Ampara", "Hambantota", "Kegalle", "Moratuwa",
    "Dehiwala", "Panadura", "Wattala", "Ja Ela",
]
STREET_NAMES = [
    "Main Street", "Temple Road", "Station Road", "Galle Road",
    "Kandy Road", "Negombo Road", "Hospital Road", "Lake Road",
    "Church Street", "Market Street", "Colombo Road", "Peradeniya Road",
    "Commercial Street", "Industrial Zone Road", "Harbour Road",
]

# Pure alphabets and spaces for Supplier validation: ^[a-zA-Z\s]+$
SUPPLIER_PREFIXES = [
    "Ceylon", "Lanka", "National", "Metro", "Central", "Royal",
    "Sunrise", "Golden", "United", "Prime", "Coastal", "Highland",
    "Pearl", "Island", "Crown", "Premier", "Apex", "Zenith",
    "Sterling", "Pinnacle", "Vanguard", "Regal", "Supreme", "Silverline",
    "Global", "Universal", "Pacific", "Atlantic", "Summit", "Horizon",
    "Diamond", "Emerald", "Sapphire", "Ruby", "Titan", "Atlas",
    "Imperial", "Dynasty", "Heritage", "Paramount", "Empire", "Crest",
]
SUPPLIER_SUFFIXES = [
    "Hardware Traders", "Hardware Suppliers", "Trading Company",
    "Enterprises", "Distributors", "Industries", "Building Materials",
    "Hardware Stores", "Trading House", "Suppliers", "Corporation",
    "Merchants", "Industrial Supplies", "Wholesalers", "Importers",
    "Logistics", "Commercial Supplies", "Commercial Traders",
]

SUPPLIER_NOTE_TEMPLATES = [
    "Reliable supplier with consistent delivery timelines.",
    "Preferred vendor for bulk hardware orders.",
    "Offers discounts on orders above LKR 100000.",
    "Delivery within 3 to 5 working days island wide.",
    "Long term business partner since store opening.",
    "Occasional delays during peak monsoon season.",
    "Strict quality control on delivered hardware stock.",
    "Requires advance purchase order for custom fabrication.",
]

# --------------------------------------------------------------------------- #
# Units (14 Standard Units)
# --------------------------------------------------------------------------- #
STANDARD_UNITS = [
    ("Pieces", "pcs", "Individual count units"),
    ("Kilograms", "kg", "Weight in kilograms"),
    ("Grams", "g", "Weight in grams"),
    ("Liters", "L", "Liquid volume in liters"),
    ("Milliliters", "ml", "Liquid volume in milliliters"),
    ("Meters", "m", "Linear measurement in meters"),
    ("Centimeters", "cm", "Linear measurement in centimeters"),
    ("Boxes", "box", "Packaged boxed items"),
    ("Bags", "bag", "Bulk bagged material like cement"),
    ("Sheets", "sheet", "Flat surface sheets and boards"),
    ("Rolls", "roll", "Rolled materials like mesh and wire"),
    ("Sets", "set", "Packaged component sets"),
    ("Packs", "pack", "Multi item packs"),
    ("Pairs", "pair", "Paired items like hinges and gloves"),
]

# --------------------------------------------------------------------------- #
# 25 Categories & Item Template Generators
# --------------------------------------------------------------------------- #
CATEGORY_TEMPLATES = {
    "Cement and Concrete": {
        "unit": "bag",
        "prefix": "CNC",
        "stems": ["Portland Cement", "Rapid Set Cement", "Ready Mix Concrete", "White Cement", "Masonry Cement", "Hydraulic Water Plug"],
        "sizes": ["25kg", "50kg", "10kg", "Standard Bag", "Bulk Pack", "Commercial Grade"],
        "base_cost": (800, 2600),
        "perishable_days": 180,
    },
    "Steel and Iron Rods": {
        "unit": "pcs",
        "prefix": "STL",
        "stems": ["Deformed Steel Bar", "Round Iron Rod", "Steel Angle Bar", "Square Steel Tube", "Flat Steel Strip", "TMT High Tensile Rebar"],
        "sizes": ["8mm x 6m", "10mm x 6m", "12mm x 6m", "16mm x 6m", "20mm x 6m", "25mm x 6m"],
        "base_cost": (1200, 7500),
        "perishable_days": None,
    },
    "Plumbing and Pipes": {
        "unit": "pcs",
        "prefix": "PLM",
        "stems": ["PVC Pressure Pipe", "GI Galvanized Pipe", "PPR Hot Water Pipe", "CPVC Heavy Duty Pipe", "Corrugated Drainage Pipe", "Brass Ball Valve"],
        "sizes": ["Half Inch 4m", "Three Quarter Inch 4m", "One Inch 4m", "Two Inch 4m", "Four Inch 4m", "Standard"],
        "base_cost": (350, 4800),
        "perishable_days": None,
    },
    "Electrical Wiring": {
        "unit": "m",
        "prefix": "WIR",
        "stems": ["Copper Insulated Wire", "Flexible Cable", "Armoured Power Cable", "Earth Conductor Wire", "Twin Flat Cable", "Multi Core Flex Cable"],
        "sizes": ["1mm Coil", "1.5mm Coil", "2.5mm Coil", "4mm Coil", "6mm Coil", "10mm Coil"],
        "base_cost": (80, 850),
        "perishable_days": None,
    },
    "Electrical Fittings": {
        "unit": "pcs",
        "prefix": "ELF",
        "stems": ["Switch Socket", "MCB Circuit Breaker", "Ceiling Rose", "Distribution Box", "LED Panel Light", "Gang Wall Switch"],
        "sizes": ["Single Gang", "Double Gang", "16 Amp", "32 Amp", "63 Amp", "Standard"],
        "base_cost": (250, 3200),
        "perishable_days": None,
    },
    "Paints and Coatings": {
        "unit": "L",
        "prefix": "PNT",
        "stems": ["Emulsion Wall Paint", "Enamel Gloss Paint", "Wood Varnish", "Anti Rust Metal Primer", "Weather Shield Exterior", "Acrylic Wall Sealer"],
        "sizes": ["1L Can", "4L Gallon", "10L Bucket", "20L Drum", "500ml Can"],
        "base_cost": (900, 14500),
        "perishable_days": 730,
    },
    "Hand Tools": {
        "unit": "pcs",
        "prefix": "HTL",
        "stems": ["Claw Hammer", "Screwdriver Set", "Adjustable Wrench", "Combination Pliers", "Hacksaw Heavy Frame", "Cold Chisel"],
        "sizes": ["Small", "Medium", "Large", "8 Inch", "10 Inch", "12 Inch"],
        "base_cost": (450, 4200),
        "perishable_days": None,
    },
    "Power Tools": {
        "unit": "pcs",
        "prefix": "PTL",
        "stems": ["Angle Grinder", "Rotary Hammer Drill", "Circular Saw", "Impact Wrench", "Jigsaw Machine", "Bench Grinder"],
        "sizes": ["600W", "750W", "900W", "1200W", "1500W", "Cordless 20V"],
        "base_cost": (8500, 38000),
        "perishable_days": None,
    },
    "Fasteners and Screws": {
        "unit": "box",
        "prefix": "FST",
        "stems": ["Drywall Bugle Screw", "Wood Thread Screw", "Machine Zinc Screw", "Self Drilling Screw", "Masonry Anchor Screw", "Brass Wood Screw"],
        "sizes": ["Half Inch 100pk", "1 Inch 100pk", "1.5 Inch 100pk", "2 Inch 100pk", "3 Inch 50pk", "4 Inch 50pk"],
        "base_cost": (320, 1400),
        "perishable_days": None,
    },
    "Nails and Nuts Bolts": {
        "unit": "kg",
        "prefix": "NAL",
        "stems": ["Common Concrete Nail", "Hex Head Bolt", "Wing Nut", "Roofing Umbrella Nail", "Stainless Carriage Bolt", "Nylon Lock Nut"],
        "sizes": ["1 Inch", "2 Inch", "3 Inch", "4 Inch", "5 Inch", "M08 Assorted"],
        "base_cost": (280, 1100),
        "perishable_days": None,
    },
    "Locks and Security": {
        "unit": "pcs",
        "prefix": "LCK",
        "stems": ["Mortise Door Lock", "Solid Brass Padlock", "Rim Night Latch", "Digital Keypad Lock", "Hardened Security Chain", "Double Cylinder Lock"],
        "sizes": ["40mm", "50mm", "60mm", "Standard", "Heavy Duty", "High Security"],
        "base_cost": (950, 16500),
        "perishable_days": None,
    },
    "Door and Window Hardware": {
        "unit": "pcs",
        "prefix": "DWH",
        "stems": ["Stainless Door Hinge", "Window Stay Arm", "Hydraulic Door Closer", "Tower Barrel Bolt", "Magnetic Door Stopper", "Telescopic Drawer Slide"],
        "sizes": ["3 Inch", "4 Inch", "5 Inch", "6 Inch", "Standard", "Heavy Duty"],
        "base_cost": (200, 3800),
        "perishable_days": None,
    },
    "Roofing Sheets": {
        "unit": "sheet",
        "prefix": "ROF",
        "stems": ["Corrugated Roofing Sheet", "Aluminium Zinc Sheet", "Polycarbonate Clear Sheet", "Tile Profile Sheet", "Fibre Cement Sheet", "Transparent Skylight Sheet"],
        "sizes": ["6 Feet", "8 Feet", "10 Feet", "12 Feet", "14 Feet", "16 Feet"],
        "base_cost": (1800, 7200),
        "perishable_days": None,
    },
    "Tiles and Flooring": {
        "unit": "box",
        "prefix": "TIL",
        "stems": ["Ceramic Floor Tile", "Glazed Wall Tile", "Homogeneous Granite Tile", "Vinyl Plank Flooring", "Porcelain Exterior Tile", "Terracotta Floor Tile"],
        "sizes": ["300x300mm", "400x400mm", "600x600mm", "600x1200mm", "Wood Grain Finish", "Standard Box"],
        "base_cost": (2200, 8500),
        "perishable_days": None,
    },
    "Sanitary Ware": {
        "unit": "pcs",
        "prefix": "SAN",
        "stems": ["Ceramic Wash Basin", "Water Closet Commode", "Chrome Shower Mixer", "Stainless Steel Sink", "Bidet Spray Kit", "Wall Hung Urinal"],
        "sizes": ["Compact", "Standard", "Premium", "Single Bowl", "Double Bowl", "Deluxe"],
        "base_cost": (3500, 42000),
        "perishable_days": None,
    },
    "Adhesives and Sealants": {
        "unit": "pcs",
        "prefix": "ADH",
        "stems": ["Silicone Weatherproof Sealant", "Tile Grout Adhesive", "Epoxy Resin Steel Glue", "Polyurethane Foam Spray", "Heavy Duty Contact Adhesive", "PVC Solvent Cement"],
        "sizes": ["300ml Cartridge", "500ml Can", "1kg Pack", "5kg Tub", "20kg Bag", "100ml Tube"],
        "base_cost": (450, 4800),
        "perishable_days": 365,
    },
    "Safety Equipment": {
        "unit": "pcs",
        "prefix": "SFT",
        "stems": ["Industrial Safety Helmet", "Cut Resistant Gloves", "Polycarbonate Safety Goggles", "High Visibility Reflective Vest", "Steel Toe Safety Boots", "Dust Filter Respirator"],
        "sizes": ["Small", "Medium", "Large", "Size 9", "Size 10", "Pack of 10"],
        "base_cost": (350, 9500),
        "perishable_days": None,
    },
    "Garden and Outdoor Tools": {
        "unit": "pcs",
        "prefix": "GDN",
        "stems": ["Steel Garden Spade", "Bypass Pruning Shears", "Reinforced Garden Hose", "Heavy Grass Rake", "Knapsack Plant Sprayer", "Wheelbarrow Heavy Duty"],
        "sizes": ["Standard", "15 Meter", "30 Meter", "16 Liter", "Single Wheel", "Heavy Duty"],
        "base_cost": (750, 11500),
        "perishable_days": None,
    },
    "Ladders and Scaffolding": {
        "unit": "pcs",
        "prefix": "LAD",
        "stems": ["Aluminium Extension Ladder", "A Frame Step Ladder", "Scaffolding Steel Pipe", "Swivel Scaffolding Coupler", "Platform Work Bench", "Telescopic Compact Ladder"],
        "sizes": ["6 Feet", "8 Feet", "10 Feet", "12 Feet", "16 Feet", "Heavy Duty"],
        "base_cost": (4500, 28000),
        "perishable_days": None,
    },
    "Wood and Timber": {
        "unit": "sheet",
        "prefix": "WOD",
        "stems": ["Marine Plywood Sheet", "Teak Timber Rafter", "MDF Laminated Board", "Hardwood Roof Battens", "Treated Softwood Plank", "Commercial Plywood Board"],
        "sizes": ["4x8ft 6mm", "4x8ft 12mm", "4x8ft 18mm", "10 Feet Length", "12 Feet Length", "Standard"],
        "base_cost": (2800, 14500),
        "perishable_days": None,
    },
    "Glass and Mirrors": {
        "unit": "sheet",
        "prefix": "GLS",
        "stems": ["Clear Float Glass Sheet", "Beveled Bathroom Mirror", "Tempered Safety Glass", "Frosted Privacy Glass", "Tinted Window Glass", "Reflective Solar Glass"],
        "sizes": ["4mm x 4x6ft", "5mm x 4x6ft", "6mm x 4x6ft", "8mm x 4x6ft", "24x36 Inch", "Custom Cut"],
        "base_cost": (2100, 12500),
        "perishable_days": None,
    },
    "Welding Equipment": {
        "unit": "pcs",
        "prefix": "WLD",
        "stems": ["Mild Steel Welding Rod", "Auto Darkening Welding Mask", "Inverter Arc Welding Machine", "Welding Earth Clamp", "TIG Welding Gas Torch", "Welding Leather Apron"],
        "sizes": ["2.5mm 5kg Pack", "3.2mm 5kg Pack", "4.0mm 5kg Pack", "200 Amp", "250 Amp", "Standard"],
        "base_cost": (850, 32000),
        "perishable_days": None,
    },
    "Water Tanks and Pumps": {
        "unit": "pcs",
        "prefix": "WTR",
        "stems": ["Triple Layer Water Tank", "Submersible Deep Well Pump", "Automatic Pressure Booster Pump", "Centrifugal Clean Water Pump", "Brass Float Valve Controller", "Pressure Tank Vessel"],
        "sizes": ["500L Capacity", "1000L Capacity", "2000L Capacity", "0.5 HP Motor", "1.0 HP Motor", "1.5 HP Motor"],
        "base_cost": (6500, 58000),
        "perishable_days": None,
    },
    "Cleaning Supplies": {
        "unit": "pcs",
        "prefix": "CLN",
        "stems": ["Industrial Heavy Broom", "Concentrated Floor Cleaner", "Microfibre Cleaning Cloth", "Heavy Duty Mop Bucket Set", "Pressure Washer Detergent", "Wire Scratch Brush"],
        "sizes": ["5L Can", "20L Drum", "Pack of 5", "Pack of 10", "Standard", "Commercial Grade"],
        "base_cost": (280, 4500),
        "perishable_days": 730,
    },
    "Measuring Instruments": {
        "unit": "pcs",
        "prefix": "MSR",
        "stems": ["Steel Measuring Tape", "Aluminium Spirit Level", "Digital Vernier Caliper", "Laser Distance Meter", "Square Angle Ruler", "Infrared Thermometer Gun"],
        "sizes": ["5m Length", "8m Length", "600mm", "1000mm", "150mm Range", "50m Range"],
        "base_cost": (450, 12500),
        "perishable_days": None,
    },
}

# --------------------------------------------------------------------------- #
# Helper Functions
# --------------------------------------------------------------------------- #
def random_datetime_last_365_days() -> datetime:
    days_ago = random.randint(0, 365)
    seconds_in_day = random.randint(0, 86399)
    return datetime.now(local_tz) - timedelta(days=days_ago, seconds=seconds_in_day)


def gen_full_name() -> str:
    pool = random.choice([
        (SINHALA_FIRST, SINHALA_LAST),
        (TAMIL_FIRST, TAMIL_LAST),
        (MUSLIM_FIRST, MUSLIM_LAST),
    ])
    first, last = pool
    return f"{random.choice(first)} {random.choice(last)}"


def gen_phone(used: set) -> str:
    prefixes = ["070", "071", "072", "074", "075", "076", "077", "078"]
    while True:
        p = random.choice(prefixes)
        rest = f"{random.randint(100, 999)} {random.randint(1000, 9999)}"
        phone = f"{p} {rest}"
        if phone not in used:
            used.add(phone)
            return phone


def gen_nic(used: set) -> str:
    while True:
        if random.random() < 0.5:
            nic = f"{random.randint(700000000, 999999999)}V"
        else:
            nic = f"{random.randint(197500000000, 200599999999)}"
        if nic not in used:
            used.add(nic)
            return nic


def gen_email(name: str, domain: str, used: set) -> str:
    base = name.lower().replace(" ", ".")
    base = "".join(ch for ch in base if ch.isalnum() or ch in "._")
    email = f"{base}@{domain}"
    counter = 1
    while email in used:
        email = f"{base}{counter}@{domain}"
        counter += 1
    used.add(email)
    return email


def gen_address() -> str:
    return (
        f"No. {random.randint(1, 450)}, {random.choice(STREET_NAMES)}, "
        f"{random.choice(CITIES)}"
    )


def gen_supplier_name(used: set) -> str:
    while True:
        name = f"{random.choice(SUPPLIER_PREFIXES)} {random.choice(SUPPLIER_SUFFIXES)}"
        if name not in used:
            used.add(name)
            return name


def gen_username(full_name: str, used: set) -> str:
    base = full_name.lower().replace(" ", ".")
    base = "".join(ch for ch in base if ch.isalnum() or ch in "._")
    username = base
    counter = 1
    while username in used:
        username = f"{base}{counter}"
        counter += 1
    used.add(username)
    return username


# --------------------------------------------------------------------------- #
# Main Seeding Execution
# --------------------------------------------------------------------------- #
async def seed_database():
    print(">>> Initializing database schema...")
    await create_db_and_tables()

    async with async_session_maker() as session:
        print(">>> Cleaning previous database tables for a clean slate...")
        await session.execute(delete(AuditLog))
        await session.execute(delete(StockAlert))
        await session.execute(delete(Transaction))
        await session.execute(delete(PurchaseOrderItem))
        await session.execute(delete(PurchaseOrder))
        await session.execute(delete(StockBatch))
        await session.execute(delete(ItemSupplier))
        await session.execute(delete(Item))
        await session.execute(delete(Supplier))
        await session.execute(delete(Category))
        await session.execute(delete(Unit))
        await session.execute(delete(User))
        await session.commit()

        used_phones: set = set()
        used_nics: set = set()
        used_emails: set = set()
        used_usernames: set = set()
        used_supplier_names: set = set()

        # ------------------------------------------------------------------- #
        # 1. Seed Users (10 total: Standard users + team members)
        # ------------------------------------------------------------------- #
        print(">>> Seeding System Users (10 users)...")
        now_dt = datetime.now(local_tz)

        admin_user = User(
            user_id=uuid.uuid4(),
            full_name="System Administrator",
            user_name="admin",
            nic=gen_nic(used_nics),
            email=gen_email("admin", "stocksphere.com", used_emails),
            phone=gen_phone(used_phones),
            password_hash=hash_password("Admin@123"),
            role=UserRole.ADMIN,
            is_active=True,
            created_at=now_dt - timedelta(days=360),
            updated_at=now_dt - timedelta(days=360),
        )
        used_usernames.add("admin")

        musfir_user = User(
            user_id=uuid.uuid4(),
            full_name="Musfir Mohamed",
            user_name="musfir",
            nic=gen_nic(used_nics),
            email=gen_email("musfir", "stocksphere.com", used_emails),
            phone=gen_phone(used_phones),
            password_hash=hash_password("Password@123"),
            role=UserRole.ADMIN,
            is_active=True,
            created_at=now_dt - timedelta(days=350),
            updated_at=now_dt - timedelta(days=350),
        )
        used_usernames.add("musfir")

        manager_user = User(
            user_id=uuid.uuid4(),
            full_name="Nimal Perera",
            user_name="manager",
            nic=gen_nic(used_nics),
            email=gen_email("manager", "stocksphere.com", used_emails),
            phone=gen_phone(used_phones),
            password_hash=hash_password("Manager@123"),
            role=UserRole.INVENTORY_MANAGER,
            is_active=True,
            created_at=now_dt - timedelta(days=340),
            updated_at=now_dt - timedelta(days=340),
        )
        used_usernames.add("manager")

        sales_user = User(
            user_id=uuid.uuid4(),
            full_name="Suresh Kumar",
            user_name="sales",
            nic=gen_nic(used_nics),
            email=gen_email("sales", "stocksphere.com", used_emails),
            phone=gen_phone(used_phones),
            password_hash=hash_password("Sales@123"),
            role=UserRole.SALES,
            is_active=True,
            created_at=now_dt - timedelta(days=330),
            updated_at=now_dt - timedelta(days=330),
        )
        used_usernames.add("sales")

        auditor_user = User(
            user_id=uuid.uuid4(),
            full_name="Fathima Rasheed",
            user_name="auditor",
            nic=gen_nic(used_nics),
            email=gen_email("auditor", "stocksphere.com", used_emails),
            phone=gen_phone(used_phones),
            password_hash=hash_password("Auditor@123"),
            role=UserRole.AUDITOR,
            is_active=True,
            created_at=now_dt - timedelta(days=320),
            updated_at=now_dt - timedelta(days=320),
        )
        used_usernames.add("auditor")

        # Additional active staff
        extra_users = []
        extra_roles = [
            (UserRole.INVENTORY_MANAGER, "Chaminda Silva"),
            (UserRole.SALES, "Kasun Rajapaksa"),
            (UserRole.SALES, "Tharindu Mendis"),
            (UserRole.SALES, "Anand Sivakumar"),
            (UserRole.SALES, "Rizwan Hameed"),
        ]
        for role, name in extra_roles:
            uname = gen_username(name, used_usernames)
            extra_users.append(
                User(
                    user_id=uuid.uuid4(),
                    full_name=name,
                    user_name=uname,
                    nic=gen_nic(used_nics),
                    email=gen_email(uname, "stocksphere.com", used_emails),
                    phone=gen_phone(used_phones),
                    password_hash=hash_password("Password@123"),
                    role=role,
                    is_active=True,
                    created_at=now_dt - timedelta(days=random.randint(50, 300)),
                    updated_at=now_dt - timedelta(days=random.randint(50, 300)),
                )
            )

        all_users = [admin_user, musfir_user, manager_user, sales_user, auditor_user] + extra_users
        session.add_all(all_users)
        await session.flush()

        operator_users = [u for u in all_users if u.role != UserRole.AUDITOR]

        # ------------------------------------------------------------------- #
        # 2. Seed Standard Units (14 Units)
        # ------------------------------------------------------------------- #
        print(">>> Seeding Standard Units (14 units)...")
        unit_objs = {}
        for name, symbol, desc in STANDARD_UNITS:
            u = Unit(
                unit_id=uuid.uuid4(),
                unit_name=name,
                unit_symbol=symbol,
                description=desc,
                is_active=True,
                created_at=now_dt - timedelta(days=360),
                updated_at=now_dt - timedelta(days=360),
            )
            session.add(u)
            unit_objs[symbol] = u
        await session.flush()

        # ------------------------------------------------------------------- #
        # 3. Seed Categories (25 Categories)
        # ------------------------------------------------------------------- #
        print(">>> Seeding Hardware Categories (25 categories)...")
        category_objs = {}
        for cat_name, cat_data in CATEGORY_TEMPLATES.items():
            cat = Category(
                category_id=uuid.uuid4(),
                category_name=cat_name,
                description=f"Commercial and residential hardware products for {cat_name.lower()}.",
                created_at=now_dt - timedelta(days=355),
                updated_at=now_dt - timedelta(days=355),
            )
            session.add(cat)
            category_objs[cat_name] = cat
        await session.flush()

        # ------------------------------------------------------------------- #
        # 4. Seed Suppliers (120 Suppliers, 15 Inactive)
        # ------------------------------------------------------------------- #
        print(f">>> Seeding Suppliers ({NUM_SUPPLIERS} suppliers)...")
        supplier_objs = []
        inactive_supplier_indices = set(random.sample(range(NUM_SUPPLIERS), NUM_INACTIVE_SUPPLIERS))

        for i in range(NUM_SUPPLIERS):
            s_name = gen_supplier_name(used_supplier_names)
            c_person = gen_full_name()
            s_email = gen_email(s_name, "suppliers.lk", used_emails)
            s_phone = gen_phone(used_phones)
            s_address = gen_address()
            is_active = i not in inactive_supplier_indices

            sup = Supplier(
                supplier_id=uuid.uuid4(),
                supplier_name=s_name,
                contact_person=c_person,
                phone=s_phone,
                email=s_email,
                address=s_address,
                notes=random.choice(SUPPLIER_NOTE_TEMPLATES),
                is_active=is_active,
                total_supplies=random.randint(15, 350) if is_active else random.randint(0, 20),
                created_at=now_dt - timedelta(days=random.randint(60, 350)),
                updated_at=now_dt - timedelta(days=random.randint(10, 60)),
            )
            session.add(sup)
            supplier_objs.append(sup)
        await session.flush()

        active_suppliers = [s for s in supplier_objs if s.is_active]

        # ------------------------------------------------------------------- #
        # 5. Seed Inventory Items (400 Items, 35 Inactive)
        # ------------------------------------------------------------------- #
        print(f">>> Generating {NUM_ITEMS} Inventory Items across 25 categories...")
        item_objs = []
        item_suppliers_links = []
        sku_counter = 1000
        used_item_names = set()
        items_per_category = NUM_ITEMS // NUM_CATEGORIES  # 16 per category

        inactive_item_indices = set(random.sample(range(NUM_ITEMS), NUM_INACTIVE_ITEMS))
        item_idx = 0

        for cat_name, cat_data in CATEGORY_TEMPLATES.items():
            cat = category_objs[cat_name]
            unit_sym = cat_data["unit"]
            unit_obj = unit_objs.get(unit_sym, unit_objs["pcs"])
            prefix = cat_data["prefix"]
            stems = cat_data["stems"]
            sizes = cat_data["sizes"]
            min_c, max_c = cat_data["base_cost"]

            combos = [(st, sz) for st in stems for sz in sizes]
            random.shuffle(combos)
            chosen_combos = combos[:items_per_category]

            for stem, size in chosen_combos:
                item_idx += 1
                sku_counter += 1
                sku = f"{prefix}-{sku_counter}"

                item_name = f"{stem} {size}"
                if item_name in used_item_names:
                    item_name = f"{item_name} {random.randint(1, 99)}"
                used_item_names.add(item_name)

                # Pricing
                cost_price = Decimal(str(round(random.uniform(min_c, max_c), 2)))
                margin_multiplier = Decimal(str(round(random.uniform(1.20, 1.55), 2)))
                selling_price = (cost_price * margin_multiplier).quantize(Decimal("1.00"))

                reorder_level = random.randint(10, 40)
                reorder_quantity = random.randint(25, 100)
                is_active = (item_idx - 1) not in inactive_item_indices

                item = Item(
                    item_id=uuid.uuid4(),
                    item_name=item_name,
                    sku=sku,
                    description=f"High quality {item_name} certified for residential and industrial hardware applications.",
                    category_id=cat.category_id,
                    unit_id=unit_obj.unit_id,
                    unit=unit_sym,
                    cost_price=cost_price,
                    selling_price=selling_price,
                    reorder_level=reorder_level,
                    reorder_quantity=reorder_quantity,
                    quantity_in_stock=0,  # Will be populated through batches & transaction replay
                    is_active=is_active,
                    created_at=now_dt - timedelta(days=random.randint(100, 350)),
                    updated_at=now_dt - timedelta(days=random.randint(10, 100)),
                )
                session.add(item)
                item_objs.append(item)

                # Link 1 to 3 suppliers to this item with agreed purchase prices
                sourcing_count = random.choices([1, 2, 3], weights=[50, 35, 15])[0]
                assigned_sups = random.sample(active_suppliers, sourcing_count)

                for s_i, s_obj in enumerate(assigned_sups):
                    is_primary = (s_i == 0)
                    price_var = Decimal(str(round(random.uniform(0.95, 1.05), 2)))
                    agreed_p = (cost_price * price_var).quantize(Decimal("0.01"))

                    item_suppliers_links.append(
                        ItemSupplier(
                            item_id=item.item_id,
                            supplier_id=s_obj.supplier_id,
                            agreed_price=agreed_p,
                            is_primary=is_primary,
                            supplier_sku=f"{s_obj.supplier_name[:3].upper()}-{sku}",
                        )
                    )

        await session.flush()
        print(">>> Linking Items to Suppliers (Agreed Prices & Primary Sourcing)...")
        session.add_all(item_suppliers_links)
        await session.flush()

        # Map item suppliers for quick lookup
        primary_supplier_by_item = {}
        suppliers_by_item = defaultdict(list)
        for link in item_suppliers_links:
            suppliers_by_item[link.item_id].append(link)
            if link.is_primary:
                primary_supplier_by_item[link.item_id] = link

        # ------------------------------------------------------------------- #
        # 6. Seed Active Stock Batches with Expiry & Batch-Level Selling Price
        # ------------------------------------------------------------------- #
        print(">>> Seeding Active Stock Batches with Expiry Dates & Batch Selling Prices...")
        batch_objs = []
        today = date.today()

        for item in item_objs:
            if not item.is_active:
                continue

            cat_info = None
            for c_name, c_data in CATEGORY_TEMPLATES.items():
                if item.sku.startswith(c_data["prefix"]):
                    cat_info = c_data
                    break

            primary_link = primary_supplier_by_item.get(item.item_id)
            if not primary_link:
                continue

            num_batches = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
            for b_idx in range(num_batches):
                initial_qty = random.randint(40, 200)
                current_qty = random.randint(15, initial_qty)

                # Batch selling price (with occasional batch-level premium/discount)
                batch_sell_var = Decimal(str(round(random.uniform(0.98, 1.08), 2)))
                batch_sell_price = (item.selling_price * batch_sell_var).quantize(Decimal("1.00"))

                # Expiry date calculation
                exp_date = None
                if cat_info and cat_info["perishable_days"]:
                    exp_date = today + timedelta(days=random.randint(60, cat_info["perishable_days"]))

                batch = StockBatch(
                    batch_id=uuid.uuid4(),
                    item_id=item.item_id,
                    supplier_id=primary_link.supplier_id,
                    batch_number=f"BATCH-{item.sku}-{2026}{chr(65 + b_idx)}",
                    purchase_price=primary_link.agreed_price,
                    selling_price=batch_sell_price,
                    initial_quantity=initial_qty,
                    current_quantity=current_qty,
                    expiry_date=exp_date,
                    received_date=now_dt - timedelta(days=random.randint(10, 180)),
                )
                session.add(batch)
                batch_objs.append(batch)
                item.quantity_in_stock += current_qty

        await session.flush()

        batches_by_item = defaultdict(list)
        for b in batch_objs:
            batches_by_item[b.item_id].append(b)

        # ------------------------------------------------------------------- #
        # 7. Seed Purchase Orders across Statuses (25 Purchase Orders)
        # ------------------------------------------------------------------- #
        print(">>> Seeding Purchase Orders across lifecycle statuses...")
        po_statuses = [
            POStatus.COMPLETED,
            POStatus.COMPLETED,
            POStatus.COMPLETED,
            POStatus.APPROVED,
            POStatus.APPROVED,
            POStatus.PARTIALLY_RECEIVED,
            POStatus.PARTIALLY_RECEIVED,
            POStatus.PENDING_APPROVAL,
            POStatus.PENDING_APPROVAL,
            POStatus.DRAFT,
            POStatus.DRAFT,
            POStatus.CANCELLED,
        ]

        selected_po_suppliers = random.sample(active_suppliers, min(20, len(active_suppliers)))
        for s_idx, sup in enumerate(selected_po_suppliers):
            status = po_statuses[s_idx % len(po_statuses)]
            po_id = uuid.uuid4()
            po_date = now_dt - timedelta(days=random.randint(5, 120))

            # Find items supplied by this vendor
            sup_links = [l for l in item_suppliers_links if l.supplier_id == sup.supplier_id]
            if not sup_links:
                continue

            chosen_links = sup_links[:min(4, len(sup_links))]
            po_total = Decimal("0.00")
            poi_rows = []

            for link in chosen_links:
                matched_item = next((i for i in item_objs if i.item_id == link.item_id), None)
                if not matched_item:
                    continue

                order_qty = random.randint(20, 100)
                recv_qty = 0
                if status == POStatus.COMPLETED:
                    recv_qty = order_qty
                elif status == POStatus.PARTIALLY_RECEIVED:
                    recv_qty = order_qty // 2

                line_total = (link.agreed_price * Decimal(order_qty)).quantize(Decimal("0.01"))
                po_total += line_total

                poi_rows.append(
                    PurchaseOrderItem(
                        poi_id=uuid.uuid4(),
                        po_id=po_id,
                        item_id=matched_item.item_id,
                        quantity=order_qty,
                        quantity_received=recv_qty,
                        unit_price=link.agreed_price,
                    )
                )

            po = PurchaseOrder(
                po_id=po_id,
                supplier_id=sup.supplier_id,
                status=status,
                po_type=status,
                notes=f"Quarterly replenishment purchase order for {sup.supplier_name}.",
                created_by=manager_user.user_id,
                created_at=po_date,
                updated_at=po_date + timedelta(hours=random.randint(1, 48)),
            )
            session.add(po)
            session.add_all(poi_rows)

        await session.flush()

        # ------------------------------------------------------------------- #
        # 8. Seed Realistic Transactions across 7 Types (1,200+ Transactions)
        # ------------------------------------------------------------------- #
        print(f">>> Simulating {TARGET_TRANSACTIONS} mathematically consistent transactions...")
        transaction_rows = []
        active_items_pool = [i for i in item_objs if i.is_active and len(batches_by_item[i.item_id]) > 0]

        for _ in range(TARGET_TRANSACTIONS):
            item = random.choice(active_items_pool)
            batches = batches_by_item[item.item_id]
            batch = random.choice(batches)
            operator = random.choice(operator_users)

            tx_type = random.choices(
                [
                    TransactionType.SOLD,
                    TransactionType.PURCHASE,
                    TransactionType.CUSTOMER_RETURN,
                    TransactionType.DAMAGED,
                    TransactionType.EXPIRED,
                    TransactionType.ADJUSTMENT_INCREASE,
                    TransactionType.ADJUSTMENT_DECREASE,
                ],
                weights=[60, 20, 7, 4, 3, 3, 3],
            )[0]

            qty = random.randint(1, 12)
            prev_qty = item.quantity_in_stock
            tx_date = now_dt - timedelta(days=random.randint(0, 300), hours=random.randint(0, 23))

            if tx_type == TransactionType.SOLD:
                if prev_qty < qty:
                    tx_type = TransactionType.PURCHASE
                    new_qty = prev_qty + qty
                    item.quantity_in_stock = new_qty
                    unit_p = batch.purchase_price
                    note = f"Stock delivery received for batch {batch.batch_number}"
                else:
                    new_qty = prev_qty - qty
                    item.quantity_in_stock = new_qty
                    unit_p = batch.selling_price or item.selling_price
                    note = f"Retail customer invoice (Batch: {batch.batch_number})"
            elif tx_type == TransactionType.PURCHASE:
                new_qty = prev_qty + qty
                item.quantity_in_stock = new_qty
                unit_p = batch.purchase_price
                note = f"Vendor replenishment received for batch {batch.batch_number}"
            elif tx_type == TransactionType.CUSTOMER_RETURN:
                new_qty = prev_qty + qty
                item.quantity_in_stock = new_qty
                unit_p = batch.selling_price or item.selling_price
                note = "Customer returned excess unused units in good condition"
            elif tx_type in (TransactionType.DAMAGED, TransactionType.EXPIRED):
                qty = min(qty, max(1, prev_qty // 4))
                new_qty = max(0, prev_qty - qty)
                item.quantity_in_stock = new_qty
                unit_p = batch.purchase_price
                note = "Damaged during warehouse transit" if tx_type == TransactionType.DAMAGED else "Expired shelf life write-off"
            elif tx_type == TransactionType.ADJUSTMENT_INCREASE:
                new_qty = prev_qty + qty
                item.quantity_in_stock = new_qty
                unit_p = item.cost_price
                note = "Physical count surplus reconciliation"
            else:  # ADJUSTMENT_DECREASE
                qty = min(qty, max(1, prev_qty // 3))
                new_qty = max(0, prev_qty - qty)
                item.quantity_in_stock = new_qty
                unit_p = item.cost_price
                note = "Inventory audit variance reconciliation"

            reason = note if "ADJUSTMENT" in tx_type.value or tx_type == TransactionType.CUSTOMER_RETURN else None

            transaction_rows.append(
                Transaction(
                    transaction_id=uuid.uuid4(),
                    item_id=item.item_id,
                    supplier_id=batch.supplier_id,
                    batch_id=batch.batch_id,
                    user_id=operator.user_id,
                    transaction_type=tx_type,
                    quantity=qty,
                    previous_quantity=prev_qty,
                    new_quantity=new_qty,
                    unit_price=unit_p,
                    reason=reason,
                    note=note,
                    transaction_date=tx_date,
                )
            )

        session.add_all(transaction_rows)
        await session.flush()

        # ------------------------------------------------------------------- #
        # 9. Seed Stock Alerts (CRITICAL, LOW_STOCK, RESOLVED)
        # ------------------------------------------------------------------- #
        print(">>> Generating Stock Alerts based on inventory thresholds...")
        alert_rows = []
        for item in item_objs:
            if not item.is_active:
                continue

            primary_link = primary_supplier_by_item.get(item.item_id)
            sup_id = primary_link.supplier_id if primary_link else active_suppliers[0].supplier_id

            if item.quantity_in_stock == 0:
                alert_rows.append(
                    StockAlert(
                        alert_id=uuid.uuid4(),
                        item_id=item.item_id,
                        supplier_id=sup_id,
                        status=AlertStatus.CRITICAL,
                        created_at=now_dt - timedelta(days=random.randint(1, 15)),
                        resolved_at=None,
                    )
                )
            elif item.quantity_in_stock <= item.reorder_level:
                alert_rows.append(
                    StockAlert(
                        alert_id=uuid.uuid4(),
                        item_id=item.item_id,
                        supplier_id=sup_id,
                        status=AlertStatus.LOW_STOCK,
                        created_at=now_dt - timedelta(days=random.randint(1, 25)),
                        resolved_at=None,
                    )
                )
            elif random.random() < 0.2:  # Historical resolved alert
                alert_date = now_dt - timedelta(days=random.randint(30, 200))
                alert_rows.append(
                    StockAlert(
                        alert_id=uuid.uuid4(),
                        item_id=item.item_id,
                        supplier_id=sup_id,
                        status=AlertStatus.RESOLVED,
                        created_at=alert_date,
                        resolved_at=alert_date + timedelta(days=random.randint(2, 10)),
                    )
                )

        session.add_all(alert_rows)
        await session.flush()

        # ------------------------------------------------------------------- #
        # 10. Seed Audit Logs
        # ------------------------------------------------------------------- #
        print(">>> Generating System Audit Logs...")
        audit_rows = []

        # User creation logs
        for u in all_users:
            audit_rows.append(
                AuditLog(
                    log_id=uuid.uuid4(),
                    user_id=admin_user.user_id,
                    action=AuditAction.USER_CREATE,
                    description=f"Created user account for {u.full_name} ({u.user_name}) with role {u.role.value}.",
                    target_table="users",
                    target_id=u.user_id,
                    created_at=u.created_at,
                )
            )

        # Login logs
        for _ in range(60):
            u = random.choice(all_users)
            action = random.choice([AuditAction.LOGIN_SUCCESS, AuditAction.LOGOUT_SUCCESS])
            verb = "logged in" if action == AuditAction.LOGIN_SUCCESS else "logged out"
            audit_rows.append(
                AuditLog(
                    log_id=uuid.uuid4(),
                    user_id=u.user_id,
                    action=action,
                    description=f"User {u.full_name} ({u.user_name}) {verb} successfully.",
                    target_table="users",
                    target_id=None,
                    created_at=random_datetime_last_365_days(),
                )
            )

        # Category create logs
        for cat_name, cat_obj in category_objs.items():
            audit_rows.append(
                AuditLog(
                    log_id=uuid.uuid4(),
                    user_id=admin_user.user_id,
                    action=AuditAction.CATEGORY_CREATE,
                    description=f"Created hardware category '{cat_name}'.",
                    target_table="categories",
                    target_id=cat_obj.category_id,
                    created_at=cat_obj.created_at,
                )
            )

        # Supplier create logs
        for s in supplier_objs[:40]:
            audit_rows.append(
                AuditLog(
                    log_id=uuid.uuid4(),
                    user_id=manager_user.user_id,
                    action=AuditAction.SUPPLIER_CREATE,
                    description=f"Registered new sourcing supplier '{s.supplier_name}'.",
                    target_table="suppliers",
                    target_id=s.supplier_id,
                    created_at=s.created_at,
                )
            )

        session.add_all(audit_rows)
        await session.commit()

        print("==================================================================")
        print("[SUCCESS] DATABASE SEEDING COMPLETED SUCCESSFULLY!")
        print(f" - Users: {len(all_users)}")
        print(f" - Standard Units: {len(unit_objs)}")
        print(f" - Categories: {len(category_objs)}")
        print(f" - Suppliers: {len(supplier_objs)} ({NUM_INACTIVE_SUPPLIERS} inactive)")
        print(f" - Items: {len(item_objs)} ({NUM_INACTIVE_ITEMS} inactive)")
        print(f" - Item-Supplier Sourcing Links: {len(item_suppliers_links)}")
        print(f" - Stock Batches: {len(batch_objs)}")
        print(f" - Transactions: {len(transaction_rows)}")
        print(f" - Stock Alerts: {len(alert_rows)}")
        print(f" - Audit Logs: {len(audit_rows)}")
        print("==================================================================")


if __name__ == "__main__":
    asyncio.run(seed_database())
