import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const alt = "Why Hapnin exists";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function WhyOgImage() {
  const clash = await readFile(join(process.cwd(), "assets/fonts/ClashDisplay-Bold.ttf"));
  const supreme = await readFile(join(process.cwd(), "assets/fonts/Supreme-Regular.ttf"));

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
            "radial-gradient(60% 80% at 20% 20%, rgba(244,178,76,0.14), transparent 60%)",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#F4B24C",
            fontFamily: "Supreme",
            fontSize: 27,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          The argument
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Clash Display",
              fontWeight: 700,
              fontSize: 96,
              lineHeight: 1.02,
              color: "#F6EEE1",
              letterSpacing: "-0.02em",
            }}
          >
            Why Hapnin exists.
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 28,
              maxWidth: 900,
              fontFamily: "Supreme",
              fontSize: 32,
              lineHeight: 1.35,
              color: "#C9B2C4",
            }}
          >
            Ticketing is solved. This is about the one audience the solution was never shaped to fit.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "Supreme",
            fontSize: 28,
            color: "#C9B2C4",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 14, height: 14, background: "#F2593F", transform: "rotate(45deg)" }} />
            <span style={{ color: "#F6EEE1" }}>Hapnin</span>
          </div>
          <div>hapnin.now</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Clash Display", data: clash, weight: 700, style: "normal" },
        { name: "Supreme", data: supreme, weight: 400, style: "normal" },
      ],
    }
  );
}
