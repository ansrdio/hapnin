import { ImageResponse } from "next/og";
import { MarkOg } from "@/app/components/BrandOg";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon: iOS rounds the corners itself, so the tile is square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1B0A2A",
          backgroundImage: "radial-gradient(70% 70% at 50% 40%, rgba(244,178,76,0.22), transparent 75%)",
        }}
      >
        <MarkOg size={132} />
      </div>
    ),
    size
  );
}
