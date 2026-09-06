// Phase 9 guardrail: the "not investment advice / not SEBI-registered
// research" line stays visible on every new screen this phase adds. One
// component so the wording never drifts between them.

export default function RiskDisclaimer({ children }: { children?: React.ReactNode }) {
  return (
    <div className="disclaimer" style={{ margin: "14px 0 0" }}>
      {children ??
        "These are risk figures for reflection, not trade advice. Not investment advice. Not SEBI-registered research. Numbers use your own inputs and sample/estimated pricing — verify against live quotes before acting."}
    </div>
  );
}
