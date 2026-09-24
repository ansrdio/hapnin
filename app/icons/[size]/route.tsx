import { ImageResponse } from "next/og";
import { MarkOg } from "@/app/components/BrandOg";

export const runtime = "nodejs";

// PNG app icons at any size, rendered from the same mark as app/icon.tsx.
//   /icons/512              — plain
//   /icons/512?maskable=1   — extra safe-zone padding for Android adaptive icons
//   /icons/512?door=1       — the door-scanner variant (gold ring around the mark)
export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = Math.max(48, Math.min(1024, parseInt(raw, 10) || 512));
  const url = new URL(req.url);
  const maskable = url.searchParams.get("maskable") === "1";
  const door = url.searchParams.get("door") === "1";
  const glyph = size * (maskable ? 0.52 : 0.76);

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
          border: door ? `${Math.max(3, size * 0.04)}px solid #F4B24C` : undefined,
        }}
      >
        <MarkOg size={glyph} />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "cache-control": "public, max-age=86400, immutable" },
    }
  );
}
