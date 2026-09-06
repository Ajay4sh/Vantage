import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";
import AppProvider from "@/components/AppProvider";
import PwaProvider from "@/components/PwaProvider";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

// Devanagari fallback for Hindi (8.3) — Inter/Space Grotesk don't cover it.
// Loaded once; applied via the --font-deva variable only when locale is Hindi.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-deva",
});

export const metadata: Metadata = {
  title: "Vantage — Equity Research Terminal",
  description:
    "Personal Indian equity research terminal: fundamentals, technicals, F&O analytics, and news sentiment. Research and analytics only — not a brokerage.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Vantage", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0E1013",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} ${devanagari.variable}`}
    >
      <body>
        <AppProvider>
          {children}
          <PwaProvider />
        </AppProvider>
      </body>
    </html>
  );
}
