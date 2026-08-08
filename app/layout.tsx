import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Hapnin — What's hapnin?",
  description:
    "African events in your city — the afrobeats night, the amapiano set, the Nollywood screening, the comedy show, the culture festival — in one place. Phoenix first. Then wherever you are.",
  applicationName: "Hapnin",
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
      "Plenty. You just never heard about it. African events in your city, in one place. Phoenix first.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "What's hapnin?",
    description:
      "Plenty. You just never heard about it. African events in your city, in one place.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B0A2A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
