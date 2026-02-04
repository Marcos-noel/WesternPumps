from __future__ import annotations

import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from openpyxl import Workbook
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import require_roles
from app.models import Part, StockTransaction

try:
    from docx import Document
except Exception:  # pragma: no cover - handled at runtime
    Document = None


router = APIRouter(prefix="/api/reports", tags=["reports"])


def _format_response(data: bytes, filename: str, content_type: str) -> Response:
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return Response(content=data, media_type=content_type, headers=headers)


def _stock_rows(parts: list[Part]) -> list[list[str]]:
    rows = []
    for p in parts:
        rows.append(
            [
                p.sku,
                p.name,
                p.tracking_type,
                str(p.quantity_on_hand),
                str(p.min_quantity),
                f"{p.unit_price or 0:.2f}" if p.unit_price is not None else "",
            ]
        )
    return rows


@router.get("/stock-level", dependencies=[Depends(require_roles("manager"))])
def stock_level_report(
    db: Session = Depends(get_db),
    format: str = Query("excel", pattern="^(excel|pdf|docx)$"),
) -> Response:
    parts = db.scalars(select(Part).order_by(Part.name.asc())).all()
    headers = ["SKU", "Name", "Tracking", "Qty On Hand", "Min Qty", "Unit Cost"]
    rows = _stock_rows(parts)

    if format == "excel":
        wb = Workbook()
        ws = wb.active
        ws.title = "Stock Levels"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        return _format_response(buf.getvalue(), "stock-levels.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    if format == "pdf":
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, 770, "Stock Levels Report")
        c.setFont("Helvetica", 10)
        y = 740
        c.drawString(40, y, " | ".join(headers))
        y -= 16
        for row in rows:
            if y < 40:
                c.showPage()
                y = 770
            c.drawString(40, y, " | ".join(row))
            y -= 14
        c.save()
        return _format_response(buf.getvalue(), "stock-levels.pdf", "application/pdf")

    if format == "docx":
        if Document is None:
            raise HTTPException(status_code=500, detail="python-docx not installed")
        doc = Document()
        doc.add_heading("Stock Levels Report", level=1)
        table = doc.add_table(rows=1, cols=len(headers))
        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
        for row in rows:
            cells = table.add_row().cells
            for i, value in enumerate(row):
                cells[i].text = value
        buf = io.BytesIO()
        doc.save(buf)
        return _format_response(buf.getvalue(), "stock-levels.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    raise HTTPException(status_code=400, detail="Invalid format")


@router.get("/stock-movement", dependencies=[Depends(require_roles("manager"))])
def stock_movement_report(
    db: Session = Depends(get_db),
    format: str = Query("excel", pattern="^(excel|pdf|docx)$"),
    start: datetime | None = Query(None),
    end: datetime | None = Query(None),
) -> Response:
    stmt = select(StockTransaction).order_by(StockTransaction.created_at.desc())
    if start:
        stmt = stmt.where(StockTransaction.created_at >= start)
    if end:
        stmt = stmt.where(StockTransaction.created_at <= end)
    txs = db.scalars(stmt).all()
    headers = ["Date", "Part ID", "Type", "Delta", "Movement", "Request", "Technician"]
    rows: list[list[str]] = []
    for t in txs:
        rows.append(
            [
                t.created_at.isoformat(sep=" ", timespec="seconds"),
                str(t.part_id),
                t.transaction_type.value,
                str(t.quantity_delta),
                t.movement_type or "",
                str(t.request_id) if t.request_id else "",
                str(t.technician_id) if t.technician_id else "",
            ]
        )

    if format == "excel":
        wb = Workbook()
        ws = wb.active
        ws.title = "Stock Movements"
        ws.append(headers)
        for row in rows:
            ws.append(row)
        buf = io.BytesIO()
        wb.save(buf)
        return _format_response(buf.getvalue(), "stock-movements.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")

    if format == "pdf":
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, 770, "Stock Movement Report")
        c.setFont("Helvetica", 10)
        y = 740
        c.drawString(40, y, " | ".join(headers))
        y -= 16
        for row in rows:
            if y < 40:
                c.showPage()
                y = 770
            c.drawString(40, y, " | ".join(row))
            y -= 14
        c.save()
        return _format_response(buf.getvalue(), "stock-movements.pdf", "application/pdf")

    if format == "docx":
        if Document is None:
            raise HTTPException(status_code=500, detail="python-docx not installed")
        doc = Document()
        doc.add_heading("Stock Movement Report", level=1)
        table = doc.add_table(rows=1, cols=len(headers))
        hdr_cells = table.rows[0].cells
        for i, h in enumerate(headers):
            hdr_cells[i].text = h
        for row in rows:
            cells = table.add_row().cells
            for i, value in enumerate(row):
                cells[i].text = value
        buf = io.BytesIO()
        doc.save(buf)
        return _format_response(buf.getvalue(), "stock-movements.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")

    raise HTTPException(status_code=400, detail="Invalid format")
