"use client";

// "Explain this" affordance: wrap any metric label with
// <MetricTooltip term="pe_ratio">P/E</MetricTooltip> and it renders the label
// plus a small "?" that reveals a plain-language definition on hover or
// keyboard focus. Definitions come from lib/glossary.ts.
//
// Accessibility: the trigger is a real <button> (keyboard-focusable), the
// popover is aria-describedby-linked, and it opens on focus as well as hover.

import { useId, useState } from "react";
import { glossary } from "@/lib/glossary";

export default function MetricTooltip({ term, children }: { term: string; children: React.ReactNode }) {
  const entry = glossary(term);
  const [open, setOpen] = useState(false);
  const id = useId();

  // Unknown term → render the label plainly rather than a dangling "?".
  if (!entry) return <>{children}</>;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, position: "relative" }}>
      {children}
      <button
        type="button"
        aria-label={`What is ${entry.title}?`}
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="metric-explain"
      >
        ?
      </button>
      {open && (
        <span role="tooltip" id={id} className="metric-tooltip">
          <b style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>{entry.title}</b>
          {entry.body}
        </span>
      )}
    </span>
  );
}
