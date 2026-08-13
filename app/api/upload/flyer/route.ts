import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireOrganizer } from "@/lib/auth";
import { getBucket } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Organizer-authed flyer upload. The file is streamed straight into Firebase
// Storage via the Admin SDK; we attach a Firebase download token so the returned
// URL is publicly readable without opening the bucket up.
export async function POST(req: Request) {
  const { organizer } = await requireOrganizer();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });

  const ext = EXT[file.type];
  if (!ext) return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 415 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image must be under 6 MB." }, { status: 413 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = `flyers/${organizer.id}/${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
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
    console.error("flyer upload error", err);
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }
}
