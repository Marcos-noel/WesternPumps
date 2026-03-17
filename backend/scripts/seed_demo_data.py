from __future__ import annotations

import argparse
import os
import random
import sys
from pathlib import Path


def _parse_args() -> argparse.Namespace:
    root = Path(__file__).resolve().parents[2]
    default_db = f"sqlite:///{(root / 'backend' / 'devdata' / 'westernpumps.db').as_posix()}"
    parser = argparse.ArgumentParser(description="Seed demo products, requests, and delivery requests.")
    parser.add_argument("--db-url", default=default_db, help="SQLAlchemy DB URL (default: backend/devdata/westernpumps.db)")
    parser.add_argument("--products", type=int, default=14, help="Target minimum products in catalog")
    parser.add_argument("--requests", type=int, default=10, help="Target minimum stock requests")
    parser.add_argument("--deliveries", type=int, default=6, help="Target minimum delivery requests")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    os.environ["DATABASE_URL"] = args.db_url

    backend_dir = Path(__file__).resolve().parents[1]
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from app.db import SessionLocal, ensure_schema, engine
    from app.models import (
        Category,
        DeliveryRequest,
        DeliveryRequestStatus,
        Location,
        Part,
        StockRequest,
        StockRequestLine,
        StockRequestStatus,
        StockTransaction,
        StockTransactionType,
        Supplier,
        User,
    )
    from app.security import get_password_hash
    from app.sku import generate_system_sku
    from sqlalchemy import func, select

    ensure_schema(engine)
    random.seed(20260224)

    with SessionLocal() as db:
        users_by_role: dict[str, User] = {}
        base_users = [
            ("admin@westernpumps.local", "admin", "Platform Admin"),
            ("manager@westernpumps.local", "manager", "Ops Manager"),
            ("store@westernpumps.local", "store_manager", "Store Manager"),
            ("tech@westernpumps.local", "technician", "Field Technician"),
            ("leadtech@westernpumps.local", "lead_technician", "Lead Technician"),
            ("rider@westernpumps.local", "rider", "Dispatch Rider"),
            ("driver@westernpumps.local", "driver", "Dispatch Driver"),
        ]
        for email, role, full_name in base_users:
            row = db.scalar(select(User).where(User.email == email).limit(1))
            if row is None:
                row = User(
                    email=email,
                    full_name=full_name,
                    role=role,
                    password_hash=get_password_hash("Password123!"),
                    is_active=True,
                )
                db.add(row)
                db.flush()
            users_by_role[role] = row

        category_names = ["Pumps", "Seals", "Bearings", "Valves", "Electrical", "Control Panels"]
        categories: list[Category] = []
        for name in category_names:
            row = db.scalar(select(Category).where(Category.name == name).limit(1))
            if row is None:
                row = Category(name=name, is_active=True)
                db.add(row)
                db.flush()
            categories.append(row)

        location_names = ["Main Warehouse", "Service Van A", "Service Van B", "Fast Movers Bay"]
        locations: list[Location] = []
        for name in location_names:
            row = db.scalar(select(Location).where(Location.name == name).limit(1))
            if row is None:
                row = Location(name=name, description=f"Seeded location: {name}", is_active=True)
                db.add(row)
                db.flush()
            locations.append(row)

        supplier_names = ["FlowTech Supplies", "HydroCore Distributors", "PrimeValve Partners"]
        suppliers: list[Supplier] = []
        for name in supplier_names:
            row = db.scalar(select(Supplier).where(Supplier.name == name).limit(1))
            if row is None:
                row = Supplier(name=name, contact_name="Seed Contact", phone="+254700000001", email=f"seed-{name.split()[0].lower()}@mail.local")
                db.add(row)
                db.flush()
            suppliers.append(row)

        existing_products = int(db.scalar(select(func.count(Part.id))) or 0)
        to_create_products = max(0, int(args.products) - existing_products)
        for i in range(to_create_products):
            category = categories[i % len(categories)]
            location = locations[i % len(locations)]
            supplier = suppliers[i % len(suppliers)]
            qty = random.randint(6, 34)
            min_qty = random.randint(4, 12)
            unit_price = round(random.uniform(1200, 18500), 2)
            item = Part(
                sku=generate_system_sku(db),
                name=f"Seed Product {existing_products + i + 1}",
                description=f"Demo item {(existing_products + i + 1)} for walkthrough and retesting.",
                image_url=f"https://picsum.photos/seed/westernpumps-{existing_products + i + 1}/640/360",
                quantity_on_hand=qty,
                min_quantity=min_qty,
                unit_price=unit_price,
                tracking_type="BATCH",
                unit_of_measure="PCS",
                category_id=category.id,
                location_id=location.id,
                supplier_id=supplier.id,
                is_active=True,
            )
            db.add(item)
            db.flush()
            db.add(
                StockTransaction(
                    part_id=item.id,
                    created_by_user_id=users_by_role["manager"].id,
                    transaction_type=StockTransactionType.IN,
                    quantity_delta=qty,
                    movement_type="INITIAL_STOCK",
                    notes="Seeded initial stock",
                )
            )

        db.flush()
        all_parts = db.scalars(select(Part).where(Part.is_active.is_(True)).order_by(Part.id.asc())).all()
        if not all_parts:
            db.commit()
            print("Seed complete: no parts available.")
            return 0

        existing_requests = int(db.scalar(select(func.count(StockRequest.id))) or 0)
        to_create_requests = max(0, int(args.requests) - existing_requests)
        for i in range(to_create_requests):
            requester = users_by_role["technician"] if i % 2 == 0 else users_by_role["lead_technician"]
            req = StockRequest(
                requested_by_user_id=requester.id,
                status=StockRequestStatus.PENDING if i % 3 != 0 else StockRequestStatus.APPROVED,
                required_approval_role="manager",
                approved_by_user_id=users_by_role["manager"].id if i % 3 == 0 else None,
            )
            db.add(req)
            db.flush()
            sample_parts = random.sample(all_parts, k=min(2, len(all_parts)))
            total = 0.0
            for part in sample_parts:
                qty = random.randint(1, 4)
                db.add(
                    StockRequestLine(
                        request_id=req.id,
                        part_id=part.id,
                        quantity=qty,
                        unit_cost=float(part.unit_price or 0),
                        tracking_type=part.tracking_type,
                    )
                )
                total += float(part.unit_price or 0) * qty
            req.total_value = round(total, 2)

        existing_deliveries = int(db.scalar(select(func.count(DeliveryRequest.id))) or 0)
        to_create_deliveries = max(0, int(args.deliveries) - existing_deliveries)
        request_ids = db.scalars(select(StockRequest.id).order_by(StockRequest.id.desc()).limit(30)).all()
        for i in range(to_create_deliveries):
            mode = "RIDER" if i % 2 == 0 else "DRIVER"
            courier = users_by_role["rider"] if mode == "RIDER" else users_by_role["driver"]
            d = DeliveryRequest(
                stock_request_id=request_ids[i % len(request_ids)] if request_ids else None,
                technician_id=users_by_role["technician"].id,
                requested_by_user_id=users_by_role["manager"].id,
                assigned_to_user_id=courier.id,
                delivery_mode=mode,
                status=DeliveryRequestStatus.PENDING,
                pickup_location="Main Warehouse",
                dropoff_location="Field Site - Nairobi Region",
                equipment_summary="Seal kit, pressure gauge, valve wrench set",
                notes="Seeded delivery request for workflow demo",
                approved_by_user_id=users_by_role["manager"].id,
            )
            db.add(d)

        db.commit()

        final_products = int(db.scalar(select(func.count(Part.id))) or 0)
        final_requests = int(db.scalar(select(func.count(StockRequest.id))) or 0)
        final_deliveries = int(db.scalar(select(func.count(DeliveryRequest.id))) or 0)
        print(f"Seed complete using {args.db_url}")
        print(f"Products: {final_products}")
        print(f"Requests: {final_requests}")
        print(f"Deliveries: {final_deliveries}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
