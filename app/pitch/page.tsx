import type { Metadata } from "next";
import { PitchDeck } from "./components/PitchDeck";
import { copy } from "./content";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hapnin.now";

const ogTitle = "Your first event costs you nothing.";
const ogDesc =
  "Ticketing for African events in Phoenix — no cut of a room you filled yourself.";

export const metadata: Metadata = {
  title: "Run one event with Hapnin",
  description: copy.concedeDeck,
  robots: { index: false, follow: false },
  alternates: { canonical: `${siteUrl}/pitch` },
  openGraph: {
    type: "website",
    url: `${siteUrl}/pitch`,
    siteName: "Hapnin",
    title: ogTitle,
    description: ogDesc,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDesc,
  },
};

export default function PitchPage() {
  return <PitchDeck />;
}
