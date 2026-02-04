import React, { useEffect, useState } from "react";
import { createCustomer, listCustomers } from "../api/customers";
import type { Customer } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await listCustomers());
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createCustomer({
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null
      });
      setName("");
      setContactName("");
      setPhone("");
      setEmail("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create customer"));
    }
  }

  return (
    <div className="container">
      <h2>Customers</h2>
      <div className="grid">
        <div className="card">
          <h3>Add customer</h3>
          <form onSubmit={handleCreate}>
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
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" type="submit">
                Create
              </button>
            </div>
          </form>
          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>Customer list</h3>
            <button className="btn secondary" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading ? <p className="muted">Loading...</p> : null}
          {!loading && customers.length === 0 ? <p className="muted">No customers yet.</p> : null}

          {!loading && customers.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{c.contact_name ?? ""}</td>
                      <td>{c.phone ?? ""}</td>
                      <td>{c.email ?? ""}</td>
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
