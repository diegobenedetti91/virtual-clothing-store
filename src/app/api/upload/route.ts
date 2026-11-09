import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, access } from "fs/promises";
import { randomBytes } from "crypto";
import path from "path";
import { auth } from "@/lib/auth";
import { getCustomerFromRequest } from "@/lib/customerAuth";

const MAX_SIZE_ADMIN = 10 * 1024 * 1024; // 10MB
const MAX_SIZE_CUSTOMER = 5 * 1024 * 1024; // 5MB (review photos)

// Real file type from the first bytes, never from the client's MIME type or filename.
function detectType(buf: Buffer): { ext: string; pdf: boolean } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", pdf: false };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", pdf: false };
  if (buf.length >= 6 && (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a")) return { ext: "gif", pdf: false };
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", pdf: false };
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", pdf: true };
  return null;
}

const UPLOAD_DIR = process.env.PERSISTENT_UPLOAD_DIR
  ? path.resolve(process.env.PERSISTENT_UPLOAD_DIR)
  : path.resolve(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  // Admins (product images, labels) or logged-in customers (review photos) only
  const isAdmin = !!(await auth())?.user;
  if (!isAdmin && !getCustomerFromRequest(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const maxSize = isAdmin ? MAX_SIZE_ADMIN : MAX_SIZE_CUSTOMER;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `Arquivo muito grande. Máximo ${maxSize / 1024 / 1024}MB.` }, { status: 400 });
    }

    // Save to local filesystem (Hostinger persistent storage)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const detected = detectType(buffer);
    if (!detected || (detected.pdf && !isAdmin)) {
      return NextResponse.json(
        { error: isAdmin ? "Tipo não permitido. Use JPG, PNG, WEBP, GIF ou PDF." : "Tipo não permitido. Use JPG, PNG, WEBP ou GIF." },
        { status: 400 }
      );
    }

    const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${detected.ext}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, filename);
    await writeFile(filePath, buffer);

    // Verify file was written successfully
    await access(filePath);

    const url = process.env.PERSISTENT_UPLOAD_DIR
      ? `/api/files/${filename}`
      : `/uploads/${filename}`;
    console.log(`[upload] saved: ${filePath} → ${url}`);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json({ error: "Erro ao fazer upload." }, { status: 500 });
  }
}
