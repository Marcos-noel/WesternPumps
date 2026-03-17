# Database Scaling Strategy

## Objective

Support growth targets including:
- 10,000+ SKUs
- 100,000+ individual item instances
- sustained report and transaction workloads

## Current strategy

1. Index-first optimization:
   - SKU/serial/barcode lookup indexes
   - transaction and audit timeline indexes
2. Data lifecycle controls:
   - inactive product soft-delete
   - periodic audit archival artifacts
3. Operational controls:
   - backup encryption/retention/restore runbooks
   - governance checks for index coverage and benchmark evidence

## Scale evidence scripts

- `python scripts/scale_benchmark.py --sku-count 10000 --instance-count 100000`
- `python scripts/db_scaling_checks.py --sqlite-path backend/westernpumps.db`

## Forward scaling plan

1. Introduce read replicas for report-heavy workloads.
2. Partition/segregate high-volume append-only tables (transactions/audit) where engine supports it.
3. Add materialized/summary reporting tables for dashboard and movement analytics.
4. Add periodic query-plan regression checks for top N critical queries.
