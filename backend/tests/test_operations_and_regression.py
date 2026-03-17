from __future__ import annotations

from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_stock_and_request_regression_flow() -> None:
    with TestClient(app) as client:
        suffix = uuid4().hex[:8]

        item_resp = client.post(
            "/api/items",
            json={
                "name": f"Regression Item {suffix}",
                "image_url": "https://example.com/item.png",
                "quantity_on_hand": 15,
                "min_quantity": 2,
                "tracking_type": "BATCH",
            },
        )
        assert item_resp.status_code in {200, 201}, item_resp.text
        item_id = item_resp.json()["id"]

        request_resp = client.post(
            "/api/requests",
            json={
                "lines": [{"part_id": item_id, "quantity": 2}],
            },
        )
        assert request_resp.status_code in {200, 201}, request_resp.text
        req = request_resp.json()
        assert req["status"] == "PENDING"
        req_id = req["id"]

        list_resp = client.get("/api/requests", params={"mine": True})
        assert list_resp.status_code == 200, list_resp.text
        assert any(int(row["id"]) == int(req_id) for row in list_resp.json())


def test_operations_workflows_end_to_end() -> None:
    with TestClient(app) as client:
        suffix = uuid4().hex[:8]

        supplier_resp = client.post("/api/suppliers", json={"name": f"Ops Supplier {suffix}"})
        assert supplier_resp.status_code in {200, 201}, supplier_resp.text
        supplier_id = supplier_resp.json()["id"]

        from_loc_resp = client.post("/api/locations", json={"name": f"Warehouse A {suffix}"})
        assert from_loc_resp.status_code in {200, 201}, from_loc_resp.text
        from_location_id = from_loc_resp.json()["id"]

        to_loc_resp = client.post("/api/locations", json={"name": f"Warehouse B {suffix}"})
        assert to_loc_resp.status_code in {200, 201}, to_loc_resp.text
        to_location_id = to_loc_resp.json()["id"]

        item_resp = client.post(
            "/api/items",
            json={
                "name": f"Ops Item {suffix}",
                "image_url": "https://example.com/ops-item.png",
                "quantity_on_hand": 5,
                "min_quantity": 1,
                "supplier_id": supplier_id,
                "location_id": from_location_id,
                "tracking_type": "BATCH",
            },
        )
        assert item_resp.status_code in {200, 201}, item_resp.text
        item_id = item_resp.json()["id"]

        loc_stock_resp = client.post(
            f"/api/items/{item_id}/locations",
            json=[
                {"location_id": from_location_id, "quantity_on_hand": 30},
                {"location_id": to_location_id, "quantity_on_hand": 0},
            ],
        )
        assert loc_stock_resp.status_code == 200, loc_stock_resp.text

        po_resp = client.post(
            "/api/operations/purchase-orders",
            json={
                "supplier_id": supplier_id,
                "notes": "PO for operations test",
                "lines": [{"part_id": item_id, "ordered_quantity": 4, "unit_cost": 5.25}],
            },
        )
        assert po_resp.status_code in {200, 201}, po_resp.text
        po = po_resp.json()
        po_id = po["id"]
        po_line_id = po["lines"][0]["id"]

        po_approve = client.post(f"/api/operations/purchase-orders/{po_id}/status", json={"status": "APPROVED"})
        assert po_approve.status_code == 200, po_approve.text

        receipt_resp = client.post(
            f"/api/operations/purchase-orders/{po_id}/receipts",
            json={
                "grn_number": f"GRN-{po_id}",
                "notes": "Received with audit notes",
                "lines": [
                    {
                        "purchase_order_line_id": po_line_id,
                        "received_quantity": 4,
                        "accepted_quantity": 4,
                        "rejected_quantity": 0,
                        "lot_code": "LOT-OPS",
                    }
                ],
            },
        )
        assert receipt_resp.status_code in {200, 201}, receipt_resp.text

        reserve_resp = client.post(
            "/api/operations/reservations",
            json={"part_id": item_id, "quantity": 2, "notes": "reserve for test"},
        )
        assert reserve_resp.status_code in {200, 201}, reserve_resp.text
        reservation_id = reserve_resp.json()["id"]

        release_resp = client.post(f"/api/operations/reservations/{reservation_id}/release")
        assert release_resp.status_code == 200, release_resp.text

        transfer_resp = client.post(
            "/api/operations/transfers",
            json={
                "from_location_id": from_location_id,
                "to_location_id": to_location_id,
                "lines": [{"part_id": item_id, "quantity": 3}],
            },
        )
        assert transfer_resp.status_code in {200, 201}, transfer_resp.text
        transfer_id = transfer_resp.json()["id"]

        transfer_approve = client.post(f"/api/operations/transfers/{transfer_id}/approve")
        assert transfer_approve.status_code == 200, transfer_approve.text

        transfer_complete = client.post(f"/api/operations/transfers/{transfer_id}/complete")
        assert transfer_complete.status_code == 200, transfer_complete.text

        cycle_resp = client.post("/api/operations/cycle-counts", json={"location_id": from_location_id, "notes": "cycle init"})
        assert cycle_resp.status_code in {200, 201}, cycle_resp.text
        cycle = cycle_resp.json()
        cycle_id = cycle["id"]
        cycle_line_payload = [
            {
                "id": row["id"],
                "counted_quantity": row["expected_quantity"],
                "reason": "counted",
            }
            for row in cycle["lines"]
        ]
        cycle_submit = client.post(f"/api/operations/cycle-counts/{cycle_id}/submit", json={"lines": cycle_line_payload})
        assert cycle_submit.status_code == 200, cycle_submit.text

        cycle_approve = client.post(f"/api/operations/cycle-counts/{cycle_id}/approve", json={"notes": "approved"})
        assert cycle_approve.status_code == 200, cycle_approve.text

        kpi_resp = client.get("/api/operations/kpi/summary")
        assert kpi_resp.status_code == 200, kpi_resp.text

        repl_resp = client.get("/api/operations/replenishment/suggestions")
        assert repl_resp.status_code == 200, repl_resp.text

        executive_resp = client.get("/api/operations/executive/summary")
        assert executive_resp.status_code == 200, executive_resp.text
