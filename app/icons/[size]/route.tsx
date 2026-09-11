import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

// PNG app icons at any size, rendered from the same mark as app/icon.tsx.
//   /icons/512              — plain
//   /icons/512?maskable=1   — extra safe-zone padding for Android adaptive icons
//   /icons/512?door=1       — the door-scanner variant (coral mark)
export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Math.max(48, Math.min(1024, parseInt(raw, 10) || 512));
  const url = new URL(req.url);
  const maskable = url.searchParams.get("maskable") === "1";
  const door = url.searchParams.get("door") === "1";
  const clash = await readFile(join(process.cwd(), "assets/fonts/ClashDisplay-Bold.ttf"));
  const pad = maskable ? size * 0.18 : 0;
  const glyph = size * (maskable ? 0.5 : 0.72);

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
          borderRadius: maskable ? 0 : size * 0.22,
          padding: pad,
        }}
      >
        <div
          style={{
            fontFamily: "Clash Display",
            fontWeight: 700,
            fontSize: glyph,
            color: door ? "#F2593F" : "#F4B24C",
            textShadow: door ? `${size * 0.03}px ${size * 0.03}px 0 #F4B24C` : `${size * 0.03}px ${size * 0.03}px 0 #F2593F`,
            marginTop: -size * 0.06,
          }}
        >
          h
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: [{ name: "Clash Display", data: clash, weight: 700, style: "normal" }],
      headers: { "cache-control": "public, max-age=86400, immutable" },
    }
  );
}
