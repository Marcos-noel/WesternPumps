import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createSupplier, deactivateSupplier, listSuppliers, updateSupplier } from "../api/suppliers";
import type { Supplier } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await listSuppliers({ q: q || undefined, include_inactive: includeInactive });
      setSuppliers(data);
    } catch (err: any) {
      setListError(getApiErrorMessage(err, "Failed to load suppliers"));
    } finally {
      setLoading(false);
    }
  }, [includeInactive, q]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCount = useMemo(() => suppliers.filter((s) => s.is_active).length, [suppliers]);

  const [editing, setEditing] = useState<Supplier | null>(null);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function resetForm() {
    setEditing(null);
    setName("");
    setContactName("");
    setPhone("");
    setEmail("");
    setNotes("");
    setFormError(null);
  }

  function startEdit(supplier: Supplier) {
    setEditing(supplier);
    setName(supplier.name);
    setContactName(supplier.contact_name ?? "");
    setPhone(supplier.phone ?? "");
    setEmail(supplier.email ?? "");
    setNotes(supplier.notes ?? "");
    setFormError(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const nameValue = name.trim();
    if (!nameValue) {
      setFormError("Supplier name is required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: nameValue,
        contact_name: contactName.trim() ? contactName.trim() : null,
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim() : null,
        notes: notes.trim() ? notes.trim() : null
      };

      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload);
      }
      resetForm();
      await refresh();
    } catch (err: any) {
      setFormError(getApiErrorMessage(err, "Failed to save supplier"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(supplier: Supplier) {
    setListError(null);
    try {
      if (supplier.is_active) {
        const ok = window.confirm(`Deactivate supplier "${supplier.name}"?`);
        if (!ok) return;
        await deactivateSupplier(supplier.id);
      } else {
        await updateSupplier(supplier.id, { is_active: true });
      }
      await refresh();
    } catch (err: any) {
      setListError(getApiErrorMessage(err, "Failed to update supplier"));
    }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>Suppliers</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {loading ? "Loading..." : `${activeCount} active supplier${activeCount === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="row">
          <button className="btn secondary" type="button" onClick={refresh} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{editing ? "Edit supplier" : "Add supplier"}</h3>
          <form onSubmit={handleSave}>
            <div className="grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div>
                <label>Contact</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div>
                <label>Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </div>

            {formError ? <p className="error">{formError}</p> : null}

            <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
              <div className="row">
                <button className="btn" type="submit" disabled={saving}>
                  {editing ? "Save changes" : "Create supplier"}
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
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Supplier list</h3>
            <label className="row" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                style={{ width: "auto" }}
              />
              Include inactive
            </label>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
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
                placeholder="Search by name or contact"
              />
            </div>
            <div style={{ minWidth: 180 }}>
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
                  }}
                  disabled={loading && suppliers.length === 0}
                >
                  Clear
                </button>
              </div>
            </div>
          </form>

          {listError ? <p className="error">{listError}</p> : null}
          {loading ? <p className="muted">Loading...</p> : null}
          {!loading && suppliers.length === 0 ? <p className="muted">No suppliers found.</p> : null}

          {!loading && suppliers.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th style={{ width: 200 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.contact_name ?? ""}</td>
                      <td>{s.phone ?? ""}</td>
                      <td>{s.email ?? ""}</td>
                      <td>
                        {s.is_active ? (
                          <span className="badge good">Active</span>
                        ) : (
                          <span className="badge low">Inactive</span>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <button className="btn secondary" type="button" onClick={() => startEdit(s)} disabled={saving}>
                            Edit
                          </button>
                          <button className="btn secondary" type="button" onClick={() => toggleActive(s)} disabled={saving}>
                            {s.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
