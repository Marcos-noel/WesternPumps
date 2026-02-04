import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createItem, listItems, listLowStock, updateItem } from "../api/items";
import { listSuppliers } from "../api/suppliers";
import { createStockTransaction, listStockTransactions } from "../api/stock";
import type { Item, StockTransaction, StockTransactionType, Supplier } from "../api/types";
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

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const suppliersById = useMemo(() => new Map(suppliers.map((s) => [s.id, s])), [suppliers]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<SortField>("name");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const refreshSuppliers = useCallback(async () => {
    try {
      setSuppliers(await listSuppliers({ include_inactive: true }));
    } catch {
      // Non-critical: inventory can still function without supplier names loaded.
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
    setSupplierId(item.supplier_id ?? "");
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
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

  const [stockItem, setStockItem] = useState<Item | null>(null);
  const [stockType, setStockType] = useState<StockTransactionType>("IN");
  const [stockQty, setStockQty] = useState("1");
  const [stockSupplierId, setStockSupplierId] = useState<number | "">("");
  const [stockNotes, setStockNotes] = useState("");
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

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

  async function handlePostStock(e: React.FormEvent) {
    e.preventDefault();
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
      <h2>Inventory</h2>
      <div className="grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{editing ? "Edit item" : "Add item"}</h3>
          <form onSubmit={handleSave}>
            <div className="grid">
              <div>
                <label>SKU</label>
                <input value={sku} onChange={(e) => setSku(e.target.value)} required />
              </div>
              <div>
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Supplier (optional)</label>
                <select value={supplierId} onChange={(e) => setSupplierId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">None</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.is_active ? s.name : `${s.name} (inactive)`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Unit price</label>
                <input
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 12.50"
                />
              </div>
              <div>
                <label>Qty on hand</label>
                <input value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <label>Min qty</label>
                <input value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} inputMode="numeric" />
              </div>
            </div>

            {formError ? <p className="error">{formError}</p> : null}

            <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
              <div className="row">
                <button className="btn" type="submit" disabled={saving}>
                  {editing ? "Save changes" : "Create item"}
                </button>
                {editing ? (
                  <button className="btn secondary" type="button" onClick={resetForm} disabled={saving}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Item list</h3>
            <button className="btn secondary" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setQ(searchInput.trim());
            }}
            className="row"
            style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap" }}
          >
            <div style={{ flex: 1, minWidth: 240 }}>
              <label>Search</label>
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by SKU or name"
              />
            </div>
            <div style={{ minWidth: 160 }}>
              <label>Page size</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPage(1);
                  setPageSize(Number(e.target.value));
                }}
                disabled={lowOnly}
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ minWidth: 190 }}>
              <label>&nbsp;</label>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn secondary" type="submit" disabled={loading}>
                  Search
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setQ("");
                    setPage(1);
                  }}
                  disabled={loading && items.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
            <div style={{ minWidth: 190 }}>
              <label>&nbsp;</label>
              <label className="row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={lowOnly}
                  onChange={(e) => {
                    setPage(1);
                    setLowOnly(e.target.checked);
                  }}
                  style={{ width: "auto" }}
                />
                Low stock only
              </label>
            </div>
          </form>

          {listError ? <p className="error">{listError}</p> : null}
          {loading ? <p className="muted">Loading...</p> : null}
          {!loading && items.length === 0 ? <p className="muted">No items found.</p> : null}

          {!loading && items.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>
                      <button className="th-button" type="button" onClick={() => toggleSort("sku")} disabled={lowOnly}>
                        SKU {sort === "sku" ? (direction === "asc" ? "^" : "v") : ""}
                      </button>
                    </th>
                    <th>
                      <button className="th-button" type="button" onClick={() => toggleSort("name")} disabled={lowOnly}>
                        Name {sort === "name" ? (direction === "asc" ? "^" : "v") : ""}
                      </button>
                    </th>
                    <th>Supplier</th>
                    <th>
                      <button
                        className="th-button"
                        type="button"
                        onClick={() => toggleSort("quantity_on_hand")}
                        disabled={lowOnly}
                      >
                        Qty {sort === "quantity_on_hand" ? (direction === "asc" ? "^" : "v") : ""}
                      </button>
                    </th>
                    <th>
                      <button
                        className="th-button"
                        type="button"
                        onClick={() => toggleSort("min_quantity")}
                        disabled={lowOnly}
                      >
                        Min {sort === "min_quantity" ? (direction === "asc" ? "^" : "v") : ""}
                      </button>
                    </th>
                    <th>Unit price</th>
                    <th style={{ width: 190 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td>{it.sku}</td>
                      <td>{it.name}</td>
                      <td>{it.supplier_id ? suppliersById.get(it.supplier_id)?.name ?? it.supplier_id : ""}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span>{it.quantity_on_hand}</span>
                          {isLowStock(it) ? <span className="badge low">Low</span> : null}
                        </div>
                      </td>
                      <td>{it.min_quantity}</td>
                      <td>{formatMoney(it.unit_price)}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn secondary" type="button" onClick={() => startEdit(it)} disabled={saving}>
                            Edit
                          </button>
                          <button
                            className="btn secondary"
                            type="button"
                            onClick={() => openStockModal(it)}
                            disabled={saving}
                          >
                            Stock
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {!loading && !lowOnly ? (
            <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
              <p className="muted" style={{ margin: 0 }}>
                Page {page} of {totalPages} | Total {total}
              </p>
              <div className="row">
                <button
                  className="btn secondary"
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={loading || page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {stockItem ? (
        <div className="modal-backdrop" onMouseDown={closeStockModal}>
          <div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <h3 style={{ margin: 0 }}>Stock movement</h3>
                <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>
                  {stockItem.sku} — {stockItem.name}
                </p>
              </div>
              <button className="btn secondary" type="button" onClick={closeStockModal} disabled={stockSaving}>
                Close
              </button>
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
              <p className="muted" style={{ margin: 0 }}>
                On hand: <strong>{stockItem.quantity_on_hand}</strong> | Min: <strong>{stockItem.min_quantity}</strong>
              </p>
              {isLowStock(stockItem) ? (
                <span className="badge low">Low stock</span>
              ) : (
                <span className="badge good">OK</span>
              )}
            </div>

            <div className="card" style={{ marginTop: 12, padding: 12 }}>
              <form onSubmit={handlePostStock}>
                <div className="row" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div style={{ minWidth: 160 }}>
                    <label>Type</label>
                    <select value={stockType} onChange={(e) => setStockType(e.target.value as StockTransactionType)}>
                      <option value="IN">Receive</option>
                      <option value="OUT">Issue</option>
                      <option value="ADJUST">Adjust</option>
                    </select>
                  </div>
                  <div style={{ minWidth: 160 }}>
                    <label>{stockType === "ADJUST" ? "Adjust by (+/-)" : "Quantity"}</label>
                    <input
                      type="number"
                      step={1}
                      min={stockType === "ADJUST" ? undefined : 1}
                      value={stockQty}
                      onChange={(e) => setStockQty(e.target.value)}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <label>Supplier (optional)</label>
                    <select
                      value={stockSupplierId}
                      onChange={(e) => setStockSupplierId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">None</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.is_active ? s.name : `${s.name} (inactive)`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <label>Notes (optional)</label>
                  <input value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} placeholder="e.g. PO #1234" />
                </div>

                {stockError ? <p className="error">{stockError}</p> : null}

                <div className="row" style={{ marginTop: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
                  <p className="muted" style={{ margin: 0 }}>
                    This will add a transaction to the stock ledger.
                  </p>
                  <button className="btn" type="submit" disabled={stockSaving}>
                    Post
                  </button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>Recent transactions</h4>
              {txLoading ? <p className="muted">Loading transactions...</p> : null}
              {!txLoading && transactions.length === 0 ? <p className="muted">No transactions yet.</p> : null}

              {!txLoading && transactions.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Delta</th>
                        <th>Supplier</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id}>
                          <td>{formatDateTime(t.created_at)}</td>
                          <td>{t.transaction_type}</td>
                          <td>{formatDelta(t.quantity_delta)}</td>
                          <td>{t.supplier_id ? suppliersById.get(t.supplier_id)?.name ?? t.supplier_id : ""}</td>
                          <td>{t.notes ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
