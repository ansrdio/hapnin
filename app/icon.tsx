import { ImageResponse } from "next/og";
import { MarkOg } from "@/app/components/BrandOg";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Favicon: the ? mark on an ink tile.
export default function Icon() {
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
          borderRadius: 14,
        }}
      >
        <MarkOg size={50} />
      </div>
    ),
    size
  );
}
