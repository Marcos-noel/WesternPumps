import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Form, Input, Modal, Select, Space, Table, Tag, Typography } from "antd";
import {
  bulkCreateItemInstances,
  createItem,
  getItemQrSvg,
  listItemInstances,
  listItems,
  listLowStock,
  updateItem
} from "../api/items";
import { listCategories } from "../api/categories";
import { listLocations } from "../api/locations";
import { listSuppliers } from "../api/suppliers";
import { createStockTransaction, listStockTransactions } from "../api/stock";
import type { Category, Item, ItemInstance, Location, StockTransaction, StockTransactionType, Supplier } from "../api/types";
import { getApiErrorMessage } from "../api/error";

type SortField = "name" | "sku" | "quantity_on_hand" | "min_quantity" | "created_at" | "updated_at";
type SortDirection = "asc" | "desc";

function isLowStock(item: Item): boolean {
  return item.quantity_on_hand <= item.min_quantity;
}

function toInt(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}

function toFloat(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortField>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const refreshSuppliers = useCallback(async () => {
    try {
      setSuppliers(await listSuppliers({ include_inactive: true }));
    } catch {
      // Non-critical: inventory can still function without supplier names loaded.
    }
  }, []);

  const refreshCategories = useCallback(async () => {
    try {
      setCategories(await listCategories({ include_inactive: true }));
    } catch {
      // Optional
    }
  }, []);

  const refreshLocations = useCallback(async () => {
    try {
      setLocations(await listLocations({ include_inactive: true }));
    } catch {
      // Optional
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      if (lowOnly) {
        const low = await listLowStock({ limit: 500, q: q || undefined });
        setItems(low);
        setTotal(low.length);
      } else {
        const data = await listItems({
          page,
          page_size: pageSize,
          q: q || undefined,
          sort,
          direction
        });
        setItems(data.items);
        setTotal(data.total);
      }
    } catch (err: any) {
      setListError(getApiErrorMessage(err, "Failed to load inventory"));
    } finally {
      setLoading(false);
    }
  }, [direction, lowOnly, page, pageSize, q, sort]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshSuppliers();
  }, [refreshSuppliers]);

  useEffect(() => {
    refreshCategories();
  }, [refreshCategories]);

  useEffect(() => {
    refreshLocations();
  }, [refreshLocations]);

  function toggleSort(field: SortField) {
    setPage(1);
    if (sort === field) {
      setDirection(direction === "asc" ? "desc" : "asc");
      return;
    }
    setSort(field);
    setDirection("asc");
  }

  function resetForm() {
    setEditing(null);
    setSku("");
    setName("");
    setDescription("");
    setUnitPrice("");
    setQuantityOnHand("0");
    setMinQuantity("0");
    setTrackingType("BATCH");
    setUnitOfMeasure("");
    setCategoryId("");
    setLocationId("");
    setSupplierId("");
    setFormError(null);
  }

  const [editing, setEditing] = useState<Item | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantityOnHand, setQuantityOnHand] = useState("0");
  const [minQuantity, setMinQuantity] = useState("0");
  const [trackingType, setTrackingType] = useState<"BATCH" | "INDIVIDUAL">("BATCH");
  const [unitOfMeasure, setUnitOfMeasure] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function startEdit(item: Item) {
    setEditing(item);
    setSku(item.sku);
    setName(item.name);
    setDescription(item.description ?? "");
    setUnitPrice(item.unit_price == null ? "" : String(item.unit_price));
    setQuantityOnHand(String(item.quantity_on_hand));
    setMinQuantity(String(item.min_quantity));
    setTrackingType((item.tracking_type as "BATCH" | "INDIVIDUAL") ?? "BATCH");
    setUnitOfMeasure(item.unit_of_measure ?? "");
    setCategoryId(item.category_id ?? "");
    setLocationId(item.location_id ?? "");
    setSupplierId(item.supplier_id ?? "");
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);

    const skuValue = sku.trim();
    const nameValue = name.trim();
    if (!skuValue) {
      setFormError("SKU is required");
      return;
    }
    if (!nameValue) {
      setFormError("Name is required");
      return;
    }

    const qoh = toInt(quantityOnHand);
    if (qoh === null || qoh < 0) {
      setFormError("Quantity on hand must be a whole number >= 0");
      return;
    }
    const minQty = toInt(minQuantity);
    if (minQty === null || minQty < 0) {
      setFormError("Min quantity must be a whole number >= 0");
      return;
    }
    const price = toFloat(unitPrice);
    if (price !== null && price < 0) {
      setFormError("Unit price must be >= 0");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sku: skuValue,
        name: nameValue,
        description: description.trim() ? description.trim() : null,
        unit_price: price,
        quantity_on_hand: qoh,
        min_quantity: minQty,
        tracking_type: trackingType,
        unit_of_measure: unitOfMeasure.trim() ? unitOfMeasure.trim() : null,
        category_id: categoryId === "" ? null : Number(categoryId),
        location_id: locationId === "" ? null : Number(locationId),
        supplier_id: supplierId === "" ? null : Number(supplierId)
      };
      if (editing) {
        await updateItem(editing.id, payload);
      } else {
        await createItem(payload);
      }
      resetForm();
      setPage(1);
      await refresh();
    } catch (err: any) {
      setFormError(getApiErrorMessage(err, "Failed to save item"));
    } finally {
      setSaving(false);
    }
  }

  function formatMoney(v?: number | null): string {
    if (v == null || Number.isNaN(v)) return "";
    return `$${v.toFixed(2)}`;
  }

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const itemColumns = useMemo(() => {
    const label = (text: string, field: SortField) => (
      <Button type="link" onClick={() => toggleSort(field)} disabled={lowOnly} style={{ padding: 0 }}>
        {text} {sort === field ? (direction === "asc" ? "↑" : "↓") : ""}
      </Button>
    );
    return [
      { title: label("SKU", "sku"), dataIndex: "sku", key: "sku" },
      { title: label("Name", "name"), dataIndex: "name", key: "name" },
      {
        title: "Category",
        key: "category",
        render: (_: unknown, item: Item) => (item.category_id ? categoryNameById.get(item.category_id) ?? item.category_id : "")
      },
      { title: "Tracking", dataIndex: "tracking_type", key: "tracking_type", render: (value: string) => value ?? "BATCH" },
      {
        title: "Supplier",
        key: "supplier",
        render: (_: unknown, item: Item) =>
          item.supplier_id ? suppliersById.get(item.supplier_id)?.name ?? item.supplier_id : ""
      },
      {
        title: label("Qty", "quantity_on_hand"),
        key: "quantity_on_hand",
        render: (_: unknown, item: Item) => (
          <Space size="small">
            <span>{item.quantity_on_hand}</span>
            {isLowStock(item) ? <Tag color="red">Low</Tag> : null}
          </Space>
        )
      },
      { title: label("Min", "min_quantity"), dataIndex: "min_quantity", key: "min_quantity" },
      { title: "Unit price", dataIndex: "unit_price", key: "unit_price", render: (value: number | null) => formatMoney(value) },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, item: Item) => (
          <Space wrap>
            <Button onClick={() => startEdit(item)} disabled={saving}>
              Edit
            </Button>
            <Button onClick={() => openStockModal(item)} disabled={saving}>
              Stock
            </Button>
            {item.tracking_type === "INDIVIDUAL" ? (
              <Button onClick={() => openInstancesModal(item)} disabled={saving}>
                Instances
              </Button>
            ) : null}
            <Button onClick={() => openQrModal(item)} disabled={saving}>
              QR
            </Button>
          </Space>
        )
      }
    ];
  }, [categoryNameById, direction, lowOnly, saving, sort, suppliersById]);

  const transactionColumns = useMemo(
    () => [
      { title: "Date", dataIndex: "created_at", key: "created_at", render: (value: string) => formatDateTime(value) },
      { title: "Type", dataIndex: "transaction_type", key: "transaction_type" },
      { title: "Delta", dataIndex: "quantity_delta", key: "quantity_delta", render: (value: number) => formatDelta(value) },
      {
        title: "Supplier",
        dataIndex: "supplier_id",
        key: "supplier_id",
        render: (value: number | null) => (value ? suppliersById.get(value)?.name ?? value : "")
      },
      { title: "Notes", dataIndex: "notes", key: "notes", render: (value: string | null) => value ?? "" }
    ],
    [suppliersById]
  );

  const instanceColumns = useMemo(
    () => [
      { title: "Serial", dataIndex: "serial_number", key: "serial_number" },
      { title: "Status", dataIndex: "status", key: "status" },
      { title: "Created", dataIndex: "created_at", key: "created_at", render: (value: string) => formatDateTime(value) }
    ],
    []
  );

  const buildItemsCsv = useCallback(
    (rows: Item[]) =>
      buildCsv(
        ["SKU", "Name", "Supplier", "Qty On Hand", "Min Qty", "Unit Price", "Low Stock", "Description"],
        rows.map((it) => [
          it.sku,
          it.name,
          it.supplier_id ? suppliersById.get(it.supplier_id)?.name ?? it.supplier_id : "",
          it.quantity_on_hand,
          it.min_quantity,
          it.unit_price ?? "",
          isLowStock(it) ? "Yes" : "No",
          it.description ?? ""
        ])
      ),
    [suppliersById]
  );

  const [stockItem, setStockItem] = useState<Item | null>(null);
  const [stockType, setStockType] = useState<StockTransactionType>("IN");
  const [stockQty, setStockQty] = useState("1");
  const [stockSupplierId, setStockSupplierId] = useState<number | "">("");
  const [stockNotes, setStockNotes] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txExporting, setTxExporting] = useState(false);

  const [qrItem, setQrItem] = useState<Item | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const [instancesItem, setInstancesItem] = useState<Item | null>(null);
  const [instances, setInstances] = useState<ItemInstance[]>([]);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [instancesError, setInstancesError] = useState<string | null>(null);
  const [bulkQty, setBulkQty] = useState("1");

  const loadTransactions = useCallback(async (partId: number) => {
    setTxLoading(true);
    try {
      const tx = await listStockTransactions({ part_id: partId, limit: 25 });
      setTransactions(tx);
    } catch {
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  const closeStockModal = useCallback(() => {
    setStockItem(null);
    setStockError(null);
    setTransactions([]);
    setStockNotes("");
    setStockQty("1");
    setStockType("IN");
    setStockSupplierId("");
  }, []);

  useEffect(() => {
    if (!stockItem) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeStockModal();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeStockModal, stockItem]);

  async function openStockModal(item: Item) {
    setStockItem(item);
    setStockType("IN");
    setStockQty("1");
    setStockSupplierId(item.supplier_id ?? "");
    setStockNotes("");
    setStockError(null);
    await loadTransactions(item.id);
  }

  function formatDelta(delta: number): string {
    return `${delta > 0 ? "+" : ""}${delta}`;
  }

  function formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  const qrDataUrl = useMemo(
    () => (qrSvg ? `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}` : ""),
    [qrSvg]
  );
  const qrText = useMemo(() => (qrItem ? `SKU:${qrItem.sku}` : ""), [qrItem]);

  const openQrModal = useCallback(
    async (item: Item) => {
      setQrItem(item);
      setQrSvg(null);
      setQrError(null);
      setQrLoading(true);
      try {
        const svg = await getItemQrSvg(item.id);
        setQrSvg(svg);
      } catch (err: any) {
        setQrError(getApiErrorMessage(err, "Failed to load QR code"));
      } finally {
        setQrLoading(false);
      }
    },
    []
  );

  const closeQrModal = useCallback(() => {
    setQrItem(null);
    setQrSvg(null);
    setQrError(null);
    setQrLoading(false);
  }, []);

  const loadInstances = useCallback(async (itemId: number) => {
    setInstancesLoading(true);
    setInstancesError(null);
    try {
      setInstances(await listItemInstances(itemId));
    } catch (err: any) {
      setInstancesError(getApiErrorMessage(err, "Failed to load instances"));
    } finally {
      setInstancesLoading(false);
    }
  }, []);

  const openInstancesModal = useCallback(
    async (item: Item) => {
      setInstancesItem(item);
      setBulkQty("1");
      await loadInstances(item.id);
    },
    [loadInstances]
  );

  const closeInstancesModal = useCallback(() => {
    setInstancesItem(null);
    setInstances([]);
    setInstancesError(null);
    setInstancesLoading(false);
  }, []);

  async function handleBulkCreate() {
    if (!instancesItem) return;
    const qty = toInt(bulkQty);
    if (qty === null || qty <= 0) {
      setInstancesError("Quantity must be a whole number > 0");
      return;
    }
    setInstancesLoading(true);
    setInstancesError(null);
    try {
      await bulkCreateItemInstances(instancesItem.id, { quantity: qty });
      await loadInstances(instancesItem.id);
      await refresh();
    } catch (err: any) {
      setInstancesError(getApiErrorMessage(err, "Failed to create instances"));
    } finally {
      setInstancesLoading(false);
    }
  }

  async function exportCurrentView() {
    setReportError(null);
    const csv = buildItemsCsv(items);
    const label = lowOnly ? "low-stock" : "current-view";
    downloadTextFile(`inventory-${label}.csv`, csv, "text/csv");
  }

  async function exportAllItems() {
    setReporting(true);
    setReportError(null);
    try {
      const all: Item[] = [];
      let pageCursor = 1;
      let totalItems = 0;
      while (true) {
        const data = await listItems({
          page: pageCursor,
          page_size: 100,
          q: q || undefined,
          sort,
          direction
        });
        totalItems = data.total;
        all.push(...data.items);
        if (all.length >= totalItems || data.items.length === 0) break;
        pageCursor += 1;
      }
      const csv = buildItemsCsv(all);
      downloadTextFile("inventory-all.csv", csv, "text/csv");
    } catch (err: any) {
      setReportError(getApiErrorMessage(err, "Failed to export inventory"));
    } finally {
      setReporting(false);
    }
  }

  async function exportLowStock() {
    setReporting(true);
    setReportError(null);
    try {
      const low = await listLowStock({ limit: 500, q: q || undefined });
      const csv = buildItemsCsv(low);
      downloadTextFile("inventory-low-stock.csv", csv, "text/csv");
    } catch (err: any) {
      setReportError(getApiErrorMessage(err, "Failed to export low stock"));
    } finally {
      setReporting(false);
    }
  }

  async function exportTransactions() {
    if (!stockItem) return;
    setTxExporting(true);
    setStockError(null);
    try {
      const tx = await listStockTransactions({ part_id: stockItem.id, limit: 200 });
      const csv = buildCsv(
        ["Date", "Type", "Delta", "Supplier", "Notes"],
        tx.map((t) => [
          formatDateTime(t.created_at),
          t.transaction_type,
          t.quantity_delta,
          t.supplier_id ? suppliersById.get(t.supplier_id)?.name ?? t.supplier_id : "",
          t.notes ?? ""
        ])
      );
      downloadTextFile(`stock-transactions-${stockItem.sku}.csv`, csv, "text/csv");
    } catch (err: any) {
      setStockError(getApiErrorMessage(err, "Failed to export transactions"));
    } finally {
      setTxExporting(false);
    }
  }

  async function handlePostStock() {
    if (!stockItem) return;

    setStockError(null);
    const qty = toInt(stockQty);
    if (qty === null) {
      setStockError(stockType === "ADJUST" ? "Adjust by must be a whole number" : "Quantity must be a whole number");
      return;
    }

    let delta: number;
    if (stockType === "IN") {
      if (qty <= 0) {
        setStockError("Receive quantity must be > 0");
        return;
      }
      delta = qty;
    } else if (stockType === "OUT") {
      if (qty <= 0) {
        setStockError("Issue quantity must be > 0");
        return;
      }
      delta = -qty;
    } else {
      if (qty === 0) {
        setStockError("Adjust by must be non-zero");
        return;
      }
      delta = qty;
    }

    setStockSaving(true);
    try {
      const tx = await createStockTransaction({
        part_id: stockItem.id,
        transaction_type: stockType,
        quantity_delta: delta,
        supplier_id: stockSupplierId === "" ? null : Number(stockSupplierId),
        notes: stockNotes.trim() ? stockNotes.trim() : null
      });

      setStockItem((prev) => (prev ? { ...prev, quantity_on_hand: prev.quantity_on_hand + tx.quantity_delta } : prev));
      setStockNotes("");
      setStockQty("1");
      await loadTransactions(stockItem.id);
      await refresh();
    } catch (err: any) {
      setStockError(getApiErrorMessage(err, "Failed to post stock transaction"));
    } finally {
      setStockSaving(false);
    }
  }

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Inventory
      </Typography.Title>
      <div className="grid">
        <Card title={editing ? "Edit item" : "Add item"}>
          <Form layout="vertical" onFinish={handleSave}>
            <div className="grid">
              <Form.Item label="SKU" required>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} />
              </Form.Item>
              <Form.Item label="Name" required>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </Form.Item>
              <Form.Item label="Description" style={{ gridColumn: "1 / -1" }}>
                <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </Form.Item>
              <Form.Item label="Tracking">
                <Select value={trackingType} onChange={(value) => setTrackingType(value)}>
                  <Select.Option value="BATCH">Batch/Quantity</Select.Option>
                  <Select.Option value="INDIVIDUAL">Individual (Serialized)</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label="Unit of measure">
                <Input value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} placeholder="e.g. pcs" />
              </Form.Item>
              <Form.Item label="Category" style={{ gridColumn: "1 / -1" }}>
                <Select<number>
                  value={categoryId === "" ? undefined : categoryId}
                  onChange={(value) => setCategoryId(value ?? "")}
                  placeholder="Uncategorized"
                  allowClear
                >
                  {categories.map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Supplier (optional)" style={{ gridColumn: "1 / -1" }}>
                <Select<number>
                  value={supplierId === "" ? undefined : supplierId}
                  onChange={(value) => setSupplierId(value ?? "")}
                  placeholder="None"
                  allowClear
                >
                  {suppliers.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.is_active ? s.name : `${s.name} (inactive)`}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Location" style={{ gridColumn: "1 / -1" }}>
                <Select<number>
                  value={locationId === "" ? undefined : locationId}
                  onChange={(value) => setLocationId(value ?? "")}
                  placeholder="Not set"
                  allowClear
                >
                  {locations.map((l) => (
                    <Select.Option key={l.id} value={l.id}>
                      {l.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item label="Unit price">
                <Input
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 12.50"
                />
              </Form.Item>
              <Form.Item label="Qty on hand">
                <Input value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} inputMode="numeric" />
              </Form.Item>
              <Form.Item label="Min qty">
                <Input value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} inputMode="numeric" />
              </Form.Item>
            </div>

            {formError ? <Typography.Text type="danger">{formError}</Typography.Text> : null}

            <Space style={{ marginTop: 12 }}>
              <Button type="primary" htmlType="submit" disabled={saving}>
                {editing ? "Save changes" : "Create item"}
              </Button>
              {editing ? (
                <Button onClick={resetForm} disabled={saving}>
                  Cancel
                </Button>
              ) : null}
            </Space>
          </Form>
        </Card>

        <Card
          title="Item list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >

          <Form
            layout="inline"
            onFinish={() => {
              setPage(1);
              setQ(searchInput.trim());
            }}
            style={{ marginTop: 12, flexWrap: "wrap" }}
          >
            <Form.Item label="Search">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by SKU or name"
              />
            </Form.Item>
            <Form.Item label="Page size">
              <Select<number>
                value={pageSize}
                onChange={(value) => {
                  setPage(1);
                  setPageSize(value);
                }}
                disabled={lowOnly}
                style={{ width: 120 }}
              >
                {[10, 20, 50, 100].map((n) => (
                  <Select.Option key={n} value={n}>
                    {n}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Space>
                <Button htmlType="submit" disabled={loading}>
                  Search
                </Button>
                <Button
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                    setPage(1);
                  }}
                  disabled={loading && items.length === 0}
                >
                  Clear
                </Button>
              </Space>
            </Form.Item>
            <Form.Item>
              <Checkbox
                checked={lowOnly}
                onChange={(e) => {
                  setPage(1);
                  setLowOnly(e.target.checked);
                }}
              >
                Low stock only
              </Checkbox>
            </Form.Item>
          </Form>

          {listError ? <Typography.Text type="danger">{listError}</Typography.Text> : null}

          <Table
            rowKey="id"
            loading={loading}
            dataSource={items}
            columns={itemColumns}
            pagination={false}
            locale={{ emptyText: lowOnly ? "No low stock items." : "No items found." }}
          />

          {!loading && !lowOnly ? (
            <Space style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
              <Typography.Text type="secondary">
                Page {page} of {totalPages} | Total {total}
              </Typography.Text>
              <Space>
                <Button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <Button disabled={loading || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </Space>
            </Space>
          ) : null}
        </Card>

        <Card title="Reports" style={{ gridColumn: "1 / -1" }}>
          <Typography.Text type="secondary">Export inventory data as CSV for reporting or sharing.</Typography.Text>
          <Space wrap style={{ marginTop: 8 }}>
            <Button onClick={exportCurrentView} disabled={loading || items.length === 0}>
              Export current view
            </Button>
            <Button onClick={exportAllItems} disabled={reporting}>
              Export all items
            </Button>
            <Button onClick={exportLowStock} disabled={reporting}>
              Export low stock
            </Button>
          </Space>
          {reportError ? <Typography.Text type="danger">{reportError}</Typography.Text> : null}
        </Card>
      </div>

      <Modal open={!!stockItem} onCancel={closeStockModal} footer={null} title="Stock movement" width={900}>
        {stockItem ? (
          <div>
            <Typography.Text type="secondary">
              {stockItem.sku} — {stockItem.name}
            </Typography.Text>

            <Space style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
              <Typography.Text type="secondary">
                On hand: <strong>{stockItem.quantity_on_hand}</strong> | Min: <strong>{stockItem.min_quantity}</strong>
              </Typography.Text>
              {isLowStock(stockItem) ? <Tag color="red">Low stock</Tag> : <Tag color="green">OK</Tag>}
            </Space>

            <Card style={{ marginTop: 12 }}>
              <Form layout="vertical" onFinish={handlePostStock}>
                <Space wrap align="end">
                  <Form.Item label="Type">
                    <Select value={stockType} onChange={(value) => setStockType(value as StockTransactionType)}>
                      <Select.Option value="IN">Receive</Select.Option>
                      <Select.Option value="OUT">Issue</Select.Option>
                      <Select.Option value="ADJUST">Adjust</Select.Option>
                    </Select>
                  </Form.Item>
                  <Form.Item label={stockType === "ADJUST" ? "Adjust by (+/-)" : "Quantity"}>
                    <Input
                      type="number"
                      step={1}
                      min={stockType === "ADJUST" ? undefined : 1}
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                    />
                  </Form.Item>
                  <Form.Item label="Supplier (optional)" style={{ minWidth: 220, flex: 1 }}>
                    <Select<number>
                      value={stockSupplierId === "" ? undefined : stockSupplierId}
                      onChange={(value) => setStockSupplierId(value ?? "")}
                      placeholder="None"
                      allowClear
                    >
                      {suppliers.map((s) => (
                        <Select.Option key={s.id} value={s.id}>
                          {s.is_active ? s.name : `${s.name} (inactive)`}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Space>
                <Form.Item label="Notes (optional)">
                  <Input value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} placeholder="e.g. PO #1234" />
                </Form.Item>

                {stockError ? <Typography.Text type="danger">{stockError}</Typography.Text> : null}

                <Space style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
                  <Typography.Text type="secondary">This will add a transaction to the stock ledger.</Typography.Text>
                  <Button type="primary" htmlType="submit" disabled={stockSaving}>
                    Post
                  </Button>
                </Space>
              </Form>
            </Card>

            <Space style={{ marginTop: 14, display: "flex", justifyContent: "space-between" }}>
              <Typography.Title level={4} style={{ margin: 0 }}>
                Recent transactions
              </Typography.Title>
              <Button onClick={exportTransactions} disabled={txExporting || txLoading}>
                Export CSV
              </Button>
            </Space>
            <Table
              rowKey="id"
              loading={txLoading}
              dataSource={transactions}
              columns={transactionColumns}
              pagination={false}
              locale={{ emptyText: "No transactions yet." }}
            />
          </div>
        ) : null}
      </Modal>

      <Modal open={!!qrItem} onCancel={closeQrModal} footer={null} title="Item QR code" width={520}>
        {qrItem ? (
          <div>
            <Typography.Text type="secondary">
              {qrItem.sku} — {qrItem.name}
            </Typography.Text>

            {qrLoading ? (
              <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                Generating QR code...
              </Typography.Text>
            ) : null}
            {qrError ? <Typography.Text type="danger">{qrError}</Typography.Text> : null}

            {qrSvg ? (
              <div style={{ marginTop: 12 }}>
                <Card style={{ display: "flex", justifyContent: "center" }}>
                  <img src={qrDataUrl} alt={`QR for ${qrItem.sku}`} style={{ width: 220, height: 220 }} />
                </Card>
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  Encoded value: <strong>{qrText}</strong>
                </Typography.Text>
                <Space>
                  <Button onClick={() => downloadTextFile(`qr-${qrItem.sku}.svg`, qrSvg, "image/svg+xml")}>
                    Download SVG
                  </Button>
                  <Button onClick={() => navigator.clipboard?.writeText(qrText)}>Copy value</Button>
                </Space>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={!!instancesItem} onCancel={closeInstancesModal} footer={null} title="Item instances" width={700}>
        {instancesItem ? (
          <div>
            <Typography.Text type="secondary">
              {instancesItem.sku} — {instancesItem.name}
            </Typography.Text>

            <Card style={{ marginTop: 12 }}>
              <Form layout="vertical">
                <Space align="end" wrap>
                  <Form.Item label="Generate quantity">
                    <Input value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} inputMode="numeric" />
                  </Form.Item>
                  <Button onClick={handleBulkCreate} disabled={instancesLoading}>
                    Generate
                  </Button>
                </Space>
                <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
                  New instances will be created with unique serial numbers and QR codes.
                </Typography.Text>
              </Form>
            </Card>

            {instancesError ? <Typography.Text type="danger">{instancesError}</Typography.Text> : null}

            <Table
              rowKey="id"
              loading={instancesLoading}
              dataSource={instances}
              columns={instanceColumns}
              pagination={false}
              style={{ marginTop: 12 }}
              locale={{ emptyText: "No instances yet." }}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
