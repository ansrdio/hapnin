import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
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
          backgroundImage:
            "radial-gradient(70% 70% at 50% 40%, rgba(244,178,76,0.35), transparent 75%)",
        }}
      >
        <div
          style={{
            fontFamily: "Clash Display",
            fontWeight: 700,
            fontSize: 128,
            color: "#F4B24C",
            textShadow: "5px 6px 0 #F2593F",
            marginTop: -10,
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
