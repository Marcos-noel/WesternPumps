# Product Overview

WesternPumps is a lightweight, full-stack business system for:

- Managing customers
- Creating and tracking service jobs
- Managing inventory items and stock levels

## Design goals

- Fast data entry (minimal clicks, keyboard-friendly forms)
- Clear “current state” views (tables with filters, sorting, and quick actions)
- Auditability for inventory changes (stock movements recorded)
- Simple deployment (Docker-first, works locally without Docker)

## Core modules

### Customers

- Customer directory with contact info and notes
- Used as the primary entity for creating service jobs

### Jobs

- A job is work performed for a customer
- Jobs have a status and priority and can be assigned to a user

### Inventory

- Inventory items (SKU, name, description, unit price)
- Stock levels (on-hand quantity, low-stock threshold)
- Suppliers (who you buy items from)
- Stock movements (receipts, issues, adjustments) with an audit trail

## Roles

- `admin`: can create users
- `staff`: standard access to operational screens

