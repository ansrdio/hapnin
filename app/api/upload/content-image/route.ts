import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { getBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";

// Admin-only image upload for Places and Stories (Experiment 001). Same safe
// pattern as flyers: streamed into Storage by the Admin SDK with a download
// token, so the bucket itself stays closed.

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB — photography, not flyers
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(req: Request) {
  await requireAdmin();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind") === "stories" ? "stories" : "places";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 8 MB." }, { status: 413 });

  const path = `content/${kind}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const token = randomUUID();
  try {
    const bucket = getBucket();
    await bucket.file(path).save(Buffer.from(await file.arrayBuffer()), {
      resumable: false,
      contentType: file.type,
      metadata: { cacheControl: "public, max-age=31536000", metadata: { firebaseStorageDownloadTokens: token } },
    });
    return NextResponse.json({ url: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}` });
  } catch (err) {
    console.error("content image upload error", err);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
