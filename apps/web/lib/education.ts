// Phase 9, Feature 5 — defined-risk strategy education. Static content,
// rendered in-app (no backend). Written at the same plain-language level as the
// Phase 7 glossary, and deliberately not gatekept as "advanced": the whole
// point is to show that a similar view can often be expressed with a capped,
// known downside instead of an open-ended one.
//
// Framing rule (Phase 9 guardrails): this teaches risk shape, it does not
// recommend trading. Every module names the real trade-offs, including the ones
// that make the "safer" structure not free.

export interface EducationModule {
  slug: string;
  title: string;
  oneLiner: string;
  /** Plain-language paragraphs. */
  body: string[];
  /** The honest trade-off — what you give up for the capped risk. */
  tradeoff: string;
}

export const EDUCATION: EducationModule[] = [
  {
    slug: "defined-vs-undefined",
    title: "Defined vs. undefined risk",
    oneLiner: "Knowing the worst case before you enter — and why it matters.",
    body: [
      "A defined-risk position has a maximum loss you can calculate before you place it. Buying a call or a put is defined-risk: the most you can lose is the premium you paid, no matter how far the stock moves against you.",
      "An undefined-risk position does not cap the downside. Selling a naked call is the classic example — if the stock keeps rising, the loss keeps growing, with no ceiling. Selling a naked put caps the loss only at the strike, which for any real position is still a large multiple of the premium you collected.",
      "The practical difference: with defined risk you decide your worst case in advance and size the position to it. With undefined risk, a single large move can cost far more than you planned — which is why this terminal asks for a separate, explicit acknowledgment before any short leg.",
    ],
    tradeoff:
      "Defined-risk buying has a cost: time decay works against you every day, and most of the premium can quietly erode even if you were broadly right about direction.",
  },
  {
    slug: "covered-call",
    title: "Covered call",
    oneLiner: "Owning the stock and selling a call against it for income.",
    body: [
      "If you already own (or buy) the underlying shares, you can sell a call option against them. You collect the premium up front. Because you own the shares, the call is 'covered' — you can always deliver them if assigned, so there is no unbounded loss the way a naked call has.",
      "Your downside is simply owning the stock (which can fall), reduced a little by the premium you collected. Your upside is capped at the strike you sold: above it, the shares get called away and you keep the premium plus the gain up to that strike.",
      "It is often used by longer-term holders to earn a modest yield on a position they intend to keep, in exchange for giving up the big upside moves.",
    ],
    tradeoff:
      "You cap your upside. If the stock jumps well past the strike, you miss that gain — you still profit, but far less than holding the shares alone would have.",
  },
  {
    slug: "credit-spread",
    title: "Credit spread",
    oneLiner: "Selling one option and buying a cheaper, further one to cap the risk.",
    body: [
      "A credit spread pairs two options of the same type and expiry: you sell one closer to the money (collecting premium) and buy one further out-of-the-money (paying a smaller premium) as protection. You keep the net credit.",
      "The bought option is what defines the risk: it puts a hard ceiling on the loss. Your maximum loss is the gap between the two strikes minus the credit you received — a number you know exactly when you enter, unlike a naked short.",
      "In return for that protection, your maximum profit is limited to the credit collected. It is a way to express a directional or range view with both the gain and the loss capped and known.",
    ],
    tradeoff:
      "Both ends are capped. Your best case is only the credit received, and a spread still loses its full defined amount if the move goes firmly against you.",
  },
];

export function educationModule(slug: string): EducationModule | null {
  return EDUCATION.find((m) => m.slug === slug) ?? null;
}
