import React, { useEffect, useState } from "react";
import { listCustomers } from "../api/customers";
import { createJob, listJobs } from "../api/jobs";
import type { Customer, Job } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, j] = await Promise.all([listCustomers(), listJobs()]);
      setCustomers(c);
      setJobs(j);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load jobs"));
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
    if (customerId === "") {
      setError("Select a customer");
      return;
    }
    try {
      await createJob({
        customer_id: customerId,
        title,
        description: description || null
      });
      setCustomerId("");
      setTitle("");
      setDescription("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create job"));
    }
  }

  const customerNameById = new Map(customers.map((c) => [c.id, c.name]));

  return (
    <div className="container">
      <h2>Jobs</h2>
      <div className="grid">
        <div className="card">
          <h3>Create job</h3>
          <form onSubmit={handleCreate}>
            <div className="grid">
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Customer</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
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
            <h3 style={{ margin: 0 }}>Job list</h3>
            <button className="btn secondary" onClick={refresh} disabled={loading}>
              Refresh
            </button>
          </div>
          {loading ? <p className="muted">Loading...</p> : null}
          {!loading && jobs.length === 0 ? <p className="muted">No jobs yet.</p> : null}

          {!loading && jobs.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id}>
                      <td>{j.id}</td>
                      <td>{customerNameById.get(j.customer_id) ?? j.customer_id}</td>
                      <td>{j.title}</td>
                      <td>{j.status}</td>
                      <td>{j.priority}</td>
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
