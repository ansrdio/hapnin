import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "Hapnin — Wetin dey hapnin?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const clash = await readFile(
    join(process.cwd(), "assets/fonts/ClashDisplay-Bold.ttf")
  );
  const supreme = await readFile(
    join(process.cwd(), "assets/fonts/Supreme-Medium.ttf")
  );

  const line = {
    fontFamily: "Clash Display",
    fontWeight: 700,
    fontSize: 150,
    lineHeight: 0.86,
    letterSpacing: "-0.02em",
    textShadow: "5px 6px 0 #F2593F",
  } as const;

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
            "radial-gradient(60% 80% at 22% 42%, rgba(244,178,76,0.42), rgba(242,89,63,0.12) 55%, transparent 78%)",
          padding: "70px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "#F4B24C",
            fontFamily: "Supreme",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              background: "#F2593F",
              transform: "rotate(45deg)",
            }}
          />
          Hapnin
        </div>

        <div style={{ display: "flex", flexDirection: "column", color: "#F6EEE1" }}>
          <div style={line}>Wetin</div>
          <div style={line}>dey</div>
          <div style={{ ...line, color: "#F4B24C" }}>hapnin?</div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#C9B2C4",
            fontFamily: "Supreme",
            fontSize: 30,
          }}
        >
          <div style={{ maxWidth: 620, color: "#F6EEE1" }}>
            Plenty. You just never heard about it.
          </div>
          <div>hapnin.now</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Clash Display", data: clash, weight: 700, style: "normal" },
        { name: "Supreme", data: supreme, weight: 500, style: "normal" },
      ],
    }
  );
}
