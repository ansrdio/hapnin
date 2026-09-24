import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WordmarkOg } from "@/app/components/BrandOg";

export const runtime = "nodejs";
export const alt = "Hapnin — What's hapnin?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The share card: the logo, big, then the answer to its question.
export default async function OpengraphImage() {
  const supreme = await readFile(join(process.cwd(), "assets/fonts/Supreme-Medium.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1B0A2A",
          backgroundImage:
            "radial-gradient(60% 80% at 22% 42%, rgba(244,178,76,0.30), rgba(242,89,63,0.10) 55%, transparent 78%)",
          padding: "70px 80px",
        }}
      >
        <div style={{ display: "flex", color: "#F4B24C", fontFamily: "Supreme", fontSize: 28, fontWeight: 500, letterSpacing: "0.3em", textTransform: "uppercase" }}>
          Phoenix
        </div>

        <div style={{ display: "flex" }}>
          <WordmarkOg height={300} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", color: "#C9B2C4", fontFamily: "Supreme", fontSize: 30 }}>
          <div style={{ maxWidth: 700, color: "#F6EEE1" }}>Plenty. You just never heard about it.</div>
          <div>hapnin.now</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Supreme", data: supreme, weight: 500, style: "normal" }],
    }
  );
}
