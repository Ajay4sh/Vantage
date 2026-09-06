import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // The terminal theme is hand-ported from the demo's stylesheet in
  // app/globals.css — preflight would fight those base styles.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bg: "#0E1013",
        panel: "#15181D",
        "panel-2": "#1B1F26",
        borderc: "#262B33",
        gold: "#D4A73C",
        "gold-dim": "#8A6E28",
        pos: "#35B08B",
        neg: "#E0616B",
      },
    },
  },
  plugins: [],
};

export default config;
