import type { Metadata, Viewport } from "next";
import "./globals.css";
import { sansFont, serifFont } from "./fonts";
import { CANONICAL_ORIGIN } from "@/lib/site";
import { VisitStart } from "./components/Track";


export const metadata: Metadata = {
  // Canonical host is www (the apex 308s there). Each public page declares its
  // own canonical path; the layout deliberately sets none, so no page can
  // inherit the homepage as its canonical again.
  metadataBase: new URL(CANONICAL_ORIGIN),
  title: "Hapnin — What's hapnin?",
  description:
    "Find culture-driven events in Phoenix — from Afrobeats and amapiano to Nollywood, comedy, festivals and more. Create an event, sell tickets and run the door with Hapnin.",
  applicationName: "Hapnin",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hapnin", statusBarStyle: "black-translucent" },
  // Older iPhones only honour the apple- prefixed tag; Next emits the modern one.
  other: { "apple-mobile-web-app-capable": "yes" },
  keywords: [
    "Hapnin",
    "African events",
    "diaspora events",
    "afrobeats",
    "amapiano",
    "Nollywood",
    "Phoenix",
    "diaspora",
    "event tickets",
  ],
  openGraph: {
    type: "website",
    siteName: "Hapnin",
    title: "What's hapnin?",
    description:
      "Plenty. You just never heard about it. Culture-driven events in Phoenix, in one place — starting with the African diaspora scene.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "What's hapnin?",
    description:
      "Plenty. You just never heard about it. Culture-driven events in Phoenix, in one place.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B0A2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sansFont.variable} ${serifFont.variable}`}>
      <body>
        <VisitStart />
        {children}
      </body>
    </html>
  );
}
