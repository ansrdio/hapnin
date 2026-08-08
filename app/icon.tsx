import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const clash = await readFile(
    join(process.cwd(), "assets/fonts/ClashDisplay-Bold.ttf")
  );

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
        <div
          style={{
            fontFamily: "Clash Display",
            fontWeight: 700,
            fontSize: 46,
            color: "#F4B24C",
            textShadow: "2px 2px 0 #F2593F",
            marginTop: -4,
          }}
        >
          h
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Clash Display", data: clash, weight: 700, style: "normal" }],
    }
  );
}
