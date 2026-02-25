import { useState } from "react";

export default function App() {
  const [inn, setInn] = useState("7700000009");
  const [result, setResult] = useState(null);
  const [audit, setAudit] = useState(null);

  async function run() {
    setResult(null);
    setAudit(null);

    const r = await fetch("/api/scoring", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer ok" // токен для SSO-mock
      },
      body: JSON.stringify({ inn })
    });
    setResult(await r.json());
  }

  async function loadAudit() {
    const r = await fetch(`/api/audit?inn=${encodeURIComponent(inn)}`, {
      headers: { "Authorization": "Bearer ok" }
    });
    setAudit(await r.json());
  }

  return (
    <div style={{ fontFamily: "Arial", padding: 24 }}>
      <h2>Платформа скоринга (демо)</h2>

      <div style={{ display: "flex", gap: 8 }}>
        <input value={inn} onChange={(e) => setInn(e.target.value)} />
        <button onClick={run}>Скоринг</button>
        <button onClick={loadAudit}>Аудит</button>
      </div>

      <h3>Результат</h3>
      <pre>{result ? JSON.stringify(result, null, 2) : "—"}</pre>

      <h3>Audit log</h3>
      <pre>{audit ? JSON.stringify(audit, null, 2) : "—"}</pre>
    </div>
  );
}