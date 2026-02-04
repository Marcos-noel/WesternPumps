import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { bootstrapAdmin } from "../api/auth";
import { getApiErrorMessage } from "../api/error";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const bootstrapCompleted = Boolean(error && error.toLowerCase().includes("bootstrap already completed"));

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/customers");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleBootstrap() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await bootstrapAdmin(email.trim(), password, fullName);
      await login(email.trim(), password);
      navigate("/customers");
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Bootstrap failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <h2>Login</h2>
      <p className="muted">Use Bootstrap Admin once when no admin exists yet.</p>

      <div className="card">
        <form onSubmit={handleLogin}>
          <div className="grid">
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@westernpumps.com"
                required
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder="********"
                minLength={8}
                required
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Full name (bootstrap only)</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Western Pumps Admin" />
            </div>
          </div>

          {error ? (
            <>
              <p className="error">{error}</p>
              {bootstrapCompleted ? (
                <p className="muted" style={{ marginTop: 8 }}>
                  If you don&apos;t know the existing admin credentials, reset the database (Docker:{" "}
                  <code>docker compose down -v</code>) and then bootstrap again.
                </p>
              ) : null}
            </>
          ) : null}

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn" type="submit" disabled={loading}>
              Login
            </button>
            <button className="btn secondary" type="button" onClick={handleBootstrap} disabled={loading}>
              Bootstrap Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
