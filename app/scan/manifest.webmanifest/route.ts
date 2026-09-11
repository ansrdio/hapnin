import { NextResponse } from "next/server";

// The door crew's home-screen app: opens on the scanner, full screen.
export function GET() {
  return NextResponse.json(
    {
      name: "Hapnin Door",
      short_name: "Door",
      description: "Scan tickets at the door — works offline.",
      start_url: "/scan",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#1B0A2A",
      theme_color: "#1B0A2A",
      icons: [
        { src: "/icons/192?door=1", sizes: "192x192", type: "image/png" },
        { src: "/icons/512?door=1", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/512?door=1&maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } }
  );
}
