// The mood wave — a tide/heartbeat line, deliberately NOT a stock chart. One
// fixed gesture per mood (up-curving / gentle / down-drifting), colored by
// mood. Static per the handoff; a subtle color-only animation can be layered
// later without changing the path.

import { MOOD_COLOR, MOOD_WAVE, type Mood } from "@/lib/pulse";

export default function MoodWave({ mood, height = 72, strokeWidth = 3 }: { mood: Mood; height?: number; strokeWidth?: number }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 350 90" style={{ display: "block" }} aria-hidden>
      <path d={MOOD_WAVE[mood]} fill="none" stroke={MOOD_COLOR[mood]} strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}
