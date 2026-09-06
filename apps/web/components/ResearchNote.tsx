"use client";

// Mount with key={stock.sym} so the note resets when the selection changes,
// matching the demo's selectStock() behaviour.

import { useState } from "react";
import { useApp } from "./AppProvider";
import { useT } from "@/lib/i18n/react";
import { generateNote } from "@/lib/conviction";
import type { OptionsAnalytics, Stock } from "@/lib/types";

export default function ResearchNote({ stock, analytics }: { stock: Stock; analytics?: OptionsAnalytics }) {
  const { locale } = useApp();
  const t = useT();
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!note) return;
    navigator.clipboard.writeText(note).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  return (
    <>
      <div className="panel-head" style={{ marginTop: 6 }}>
        <div className="panel-title">{t("note.title")}</div>
      </div>
      <div className="note-actions">
        <button className="btn primary" onClick={() => setNote(generateNote(stock, analytics, locale))}>
          ↻ {t("note.generate")}
        </button>
        <button className="btn" onClick={handleCopy}>
          {copied ? `✓ ${t("note.copied")}` : `⧉ ${t("note.copy")}`}
        </button>
      </div>
      <div className="note-body">{note ?? t("note.placeholder")}</div>
      <div className="disclaimer">{t("disclaimer.body")}</div>
    </>
  );
}
