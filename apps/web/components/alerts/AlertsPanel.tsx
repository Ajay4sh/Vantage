"use client";

// Phase 8.2 — alerts + in-app notification center. Lists triggered alerts
// (the fallback delivery channel when web push isn't granted), active alerts
// with delete, and a create form prefilled with the current symbol. Auth-gated
// upstream: the bell only appears when signed in.

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/react";
import type { AlertCondition } from "@/lib/store";

interface AlertRow {
  id: string;
  symbol: string;
  conditionType: AlertCondition;
  threshold: number | null;
  createdAt: string;
  triggeredAt: string | null;
  lastValue: number | null;
  label: string;
}

const CONDITION_KEYS: AlertCondition[] = [
  "price_above",
  "price_below",
  "cross_resistance",
  "cross_support",
  "52w_high",
  "52w_low",
  "iv_spike",
  "pcr_shift",
];

const NEEDS_THRESHOLD: AlertCondition[] = ["price_above", "price_below", "iv_spike", "pcr_shift"];

export default function AlertsPanel({ currentSymbol, onClose }: { currentSymbol: string; onClose: () => void }) {
  const t = useT();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [symbol, setSymbol] = useState(currentSymbol);
  const [condition, setCondition] = useState<AlertCondition>("price_above");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/alerts", { cache: "no-store" });
    if (res.ok) setAlerts(((await res.json()) as { alerts: AlertRow[] }).alerts);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          conditionType: condition,
          threshold: NEEDS_THRESHOLD.includes(condition) ? Number(threshold) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not create alert.");
        return;
      }
      setThreshold("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const triggered = alerts.filter((a) => a.triggeredAt);
  const active = alerts.filter((a) => !a.triggeredAt);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="col"
        style={{ width: 360, maxWidth: "100%", background: "var(--panel)", borderLeft: "1px solid var(--border)", overflowY: "auto" }}
      >
        <div className="panel-head">
          <div className="panel-title">{t("alerts.title")}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-3)", fontSize: 16 }}>
            ✕
          </button>
        </div>

        {/* New alert form */}
        <div className="card" style={{ margin: "0 14px 14px" }}>
          <div className="card-title">{t("alerts.new")}</div>
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol"
            className="mono"
            style={inputStyle}
          />
          <select value={condition} onChange={(e) => setCondition(e.target.value as AlertCondition)} style={inputStyle}>
            {CONDITION_KEYS.map((c) => (
              <option key={c} value={c}>
                {t(`alerts.cond.${c}`)}
              </option>
            ))}
          </select>
          {NEEDS_THRESHOLD.includes(condition) && (
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={t("alerts.threshold")}
              inputMode="decimal"
              className="mono"
              style={inputStyle}
            />
          )}
          <button className="btn primary" style={{ width: "100%", marginTop: 4 }} disabled={busy} onClick={create}>
            {t("alerts.create")}
          </button>
          {error && <p style={{ fontSize: 11, color: "var(--neg)", margin: "8px 0 0" }}>{error}</p>}
        </div>

        {/* Notification center: triggered alerts */}
        {triggered.length > 0 && (
          <div style={{ padding: "0 14px 12px" }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>
              {t("alerts.triggered")}
            </div>
            {triggered.map((a) => (
              <div key={a.id} className="card" style={{ padding: "10px 12px", marginBottom: 8, borderColor: "var(--gold-dim)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text)" }}>🔔 {a.label}</span>
                  <button onClick={() => remove(a.id)} style={delBtn} aria-label={t("alerts.delete")}>
                    ✕
                  </button>
                </div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>
                  at ₹{a.lastValue} · {new Date(a.triggeredAt!).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active alerts */}
        <div style={{ padding: "0 14px 20px" }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>
            {t("alerts.active")}
          </div>
          {active.length === 0 && <p style={{ fontSize: 11.5, color: "var(--text-3)" }}>{t("alerts.none")}</p>}
          {active.map((a) => (
            <div key={a.id} className="driver-row">
              <span style={{ fontSize: 12 }}>{a.label}</span>
              <button onClick={() => remove(a.id)} style={delBtn} aria-label={t("alerts.delete")}>
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--panel-2)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text)",
  fontSize: 12,
  marginBottom: 8,
  outline: "none",
};

const delBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-3)",
  fontSize: 12,
  cursor: "pointer",
};
