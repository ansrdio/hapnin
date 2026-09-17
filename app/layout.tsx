import type { Metadata, Viewport } from "next";
import "./globals.css";
import { sansFont, serifFont } from "./fonts";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
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
      <body>{children}</body>
    </html>
  );
}
