import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "crypto";
import { getBucket } from "@/lib/firebase-admin";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Public flyer upload for the no-login /create flow. Same as the authed route but
// rate-limited and written to a pending/ prefix (the event that references it is
// created in the same flow). Type + size are validated.
export async function POST(req: Request) {
  const h = await headers();
  const rl = rateLimit(`flyer-public:${clientIpFrom(h)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: "Too many uploads. Wait a moment." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 6 MB." }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `flyers/pending/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const token = randomUUID();

  try {
    const bucket = getBucket();
    await bucket.file(path).save(buffer, {
      resumable: false,
      contentType: file.type,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    return NextResponse.json({ url });
  } catch (err) {
    console.error("public flyer upload error", err);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
