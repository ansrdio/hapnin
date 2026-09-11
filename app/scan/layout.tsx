import type { Metadata } from "next";

// Everything under /scan is the door crew's app: its own manifest (opens on
// the scanner, named "Hapnin Door") and full-screen when added to a home screen.
export const metadata: Metadata = {
  manifest: "/scan/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Hapnin Door", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
