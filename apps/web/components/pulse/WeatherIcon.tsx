// Weather-icon vocabulary for mood — sun = bullish, partly-cloudy = neutral,
// storm = bearish. Simple geometry only (circles + rays / ellipses / rain
// lines), geometry ported verbatim from the design reference. `rays` draws the
// full 8-ray sun (hero); the compact form drops the diagonals.

import { MOOD_COLOR, type Mood } from "@/lib/pulse";

export default function WeatherIcon({ mood, size = 40, rays = true }: { mood: Mood; size?: number; rays?: boolean }) {
  const c = MOOD_COLOR[mood];
  if (mood === "bullish") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="9" fill={c} />
        <g stroke={c} strokeWidth="2.5" strokeLinecap="round">
          <line x1="20" y1="2" x2="20" y2="7" />
          <line x1="20" y1="33" x2="20" y2="38" />
          <line x1="2" y1="20" x2="7" y2="20" />
          <line x1="33" y1="20" x2="38" y2="20" />
          {rays && (
            <>
              <line x1="7" y1="7" x2="10.5" y2="10.5" />
              <line x1="29.5" y1="29.5" x2="33" y2="33" />
              <line x1="7" y1="33" x2="10.5" y2="29.5" />
              <line x1="29.5" y1="10.5" x2="33" y2="7" />
            </>
          )}
        </g>
      </svg>
    );
  }
  if (mood === "bearish") {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <ellipse cx="20" cy="16" rx="15" ry="9.5" fill={c} />
        <g stroke={c} strokeWidth="2.5" strokeLinecap="round">
          <line x1="14" y1="29" x2="11" y2="37" />
          <line x1="21" y1="29" x2="18" y2="37" />
          <line x1="28" y1="29" x2="25" y2="37" />
        </g>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <circle cx="14" cy="15" r="7" fill={c} />
      <ellipse cx="23" cy="25" rx="13" ry="8.5" fill={c} />
      <ellipse cx="13" cy="27" rx="8" ry="6" fill={c} />
    </svg>
  );
}
