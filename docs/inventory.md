# Inventory

This module manages items (parts), suppliers, and stock movements.

## Concepts

### Item

An item (also called a “part”) is tracked in inventory.

Key fields:

- SKU (unique)
- Name
- Description
- Unit price (optional)
- Quantity on hand (current stock)
- Min quantity (low-stock threshold)
- Supplier (optional)
- Tracking type (Batch / Individual)
- Unit of measure
- Category
- Location

### Supplier

A supplier is a vendor you buy inventory from.

Key fields:

- Name (unique)
- Contact info (optional)
- Notes (optional)

### Stock transaction (movement log)

Every stock change should be recorded as a transaction:

- `IN`: receiving stock (increases on-hand)
- `OUT`: issuing stock (decreases on-hand)
- `ADJUST`: correction (can increase or decrease)

Transactions create an audit trail and make inventory changes explainable.

## Common workflows

- Create an item
- Set a reorder point (min quantity)
- Receive stock against an item (creates an `IN` transaction)
- Issue stock (creates an `OUT` transaction)
- Investigate why on-hand changed (review transaction history)
- View low-stock list (items where on-hand is below threshold)
- Generate item QR codes for labels or quick lookup
- Export inventory reports (CSV)

## Low-stock behavior

An item is considered “low stock” when:

`quantity_on_hand <= min_quantity`

## QR codes

- Each item can generate a QR code that encodes its SKU (format: `SKU:<value>`).
- Intended for printing labels or quick scanning in the warehouse.

## Reports

- Inventory CSV exports support:
  - Current view (filters/search applied)
  - All items
  - Low stock only
- Stock transactions can be exported per item from the stock modal.
