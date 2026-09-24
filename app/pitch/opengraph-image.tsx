import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { WordmarkOg } from "@/app/components/BrandOg";

export const runtime = "nodejs";
export const alt = "You fill the room. We’ll handle everything else.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PitchOgImage() {
  const clash = await readFile(join(process.cwd(), "assets/fonts/ClashDisplay-Bold.ttf"));
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
            "radial-gradient(70% 90% at 85% 15%, rgba(244,178,76,0.16), transparent 60%)",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#F4B24C",
            fontFamily: "Supreme",
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
          }}
        >
          For organizers
        </div>

        <div
          style={{
            display: "flex",
            fontFamily: "Clash Display",
            fontWeight: 700,
            fontSize: 82,
            lineHeight: 1.02,
            color: "#F6EEE1",
            maxWidth: 940,
            letterSpacing: "-0.01em",
          }}
        >
          Keep more of every ticket.
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "Supreme",
            fontSize: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              color: "#F4B24C",
              fontWeight: 500,
            }}
          >
            No cut of a room you filled yourself.
          </div>
          <WordmarkOg height={44} />
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
