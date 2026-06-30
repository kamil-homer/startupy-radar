"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, code }),
      });
      if (res.ok) {
        // Wracamy tam, skąd przyszliśmy (?next=...), domyślnie na stronę główną.
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        const safeNext = next && next.startsWith("/") ? next : "/";
        window.location.assign(safeNext);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Logowanie nie powiodło się.");
    } catch {
      setError("Błąd sieci. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.wrap}>
      <form onSubmit={onSubmit} style={styles.card}>
        <div style={styles.kicker}>STARTUP RADAR</div>
        <h1 style={styles.h1}>Logowanie</h1>
        <p style={styles.sub}>Hasło + kod 2FA z aplikacji Authenticator.</p>

        <label style={styles.label}>
          Hasło
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Kod 2FA
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            style={{ ...styles.input, letterSpacing: "0.4em", fontFamily: "monospace" }}
          />
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? "Sprawdzam…" : "Wejdź"}
        </button>
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: 360,
    background: "var(--paper2, #e9e2cc)",
    border: "1px solid var(--line, #c9bfa0)",
    borderRadius: 14,
    padding: "32px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    boxShadow: "0 18px 50px rgba(22,38,58,0.12)",
  },
  kicker: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 12,
    letterSpacing: "0.22em",
    color: "var(--rust, #b5532c)",
    fontWeight: 600,
  },
  h1: {
    fontFamily: "'Space Grotesk', sans-serif",
    margin: 0,
    fontSize: 28,
    color: "var(--ink, #16263a)",
  },
  sub: {
    margin: "0 0 8px",
    fontSize: 14,
    color: "var(--ink-soft, #3c4a5c)",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 13,
    color: "var(--ink-soft, #3c4a5c)",
  },
  input: {
    padding: "11px 12px",
    borderRadius: 9,
    border: "1px solid var(--line, #c9bfa0)",
    background: "var(--paper, #f1ecdd)",
    color: "var(--ink, #16263a)",
    fontSize: 16,
    outline: "none",
  },
  error: {
    background: "rgba(181,83,44,0.1)",
    border: "1px solid rgba(181,83,44,0.4)",
    color: "var(--rust, #b5532c)",
    borderRadius: 8,
    padding: "9px 11px",
    fontSize: 13,
  },
  button: {
    marginTop: 6,
    padding: "12px 14px",
    borderRadius: 9,
    border: "none",
    background: "var(--teal, #0f4c5c)",
    color: "#f1ecdd",
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
  },
};
