import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const UPLOAD_DIR = process.env.PERSISTENT_UPLOAD_DIR
  ? path.resolve(process.env.PERSISTENT_UPLOAD_DIR)
  : path.resolve(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "Tipo não permitido. Use JPG, PNG, WEBP ou PDF." }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "Arquivo muito grande. Máximo 10MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Save to local filesystem (Hostinger persistent storage)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

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

export async function GET() {
  // Health check: confirms uploads directory is writable
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    return NextResponse.json({ ok: true, uploadDir: UPLOAD_DIR });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
