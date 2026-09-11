import type { MetadataRoute } from "next";

// Site-wide web app manifest (buyers who add Hapnin to their home screen).
// The door scanner has its own manifest under /scan so it opens straight on
// the scanner as "Hapnin Door".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hapnin",
    short_name: "Hapnin",
    description: "African events in your city — tickets, RSVPs, and the door.",
    start_url: "/",
    display: "standalone",
    background_color: "#1B0A2A",
    theme_color: "#1B0A2A",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
