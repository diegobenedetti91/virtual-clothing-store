import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = process.env.PERSISTENT_UPLOAD_DIR
  ? path.resolve(process.env.PERSISTENT_UPLOAD_DIR)
  : path.resolve(process.cwd(), "public", "uploads");

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  if (!existsSync(filePath)) {
    // Versão redimensionada pedida pela primeira vez (ex.: foto.jpg.w480.webp): gera e guarda
    const variant = filename.match(/^(.+)\.w(\d+)\.webp$/);
    if (variant && ALLOWED_WIDTHS.has(Number(variant[2]))) {
      const original = path.join(UPLOAD_DIR, variant[1]);
      if (existsSync(original)) {
        const generated = await generateVariant(original, filePath, Number(variant[2]));
        if (generated) return imageResponse(generated, "image/webp");
        // Sem sharp ou falhou: serve a original (o navegador mostra igual)
        const ext = variant[1].split(".").pop()?.toLowerCase() || "jpg";
        return imageResponse(await readFile(original), MIME_TYPES[ext] || "application/octet-stream", false);
      }
    }
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  return imageResponse(await readFile(filePath), contentType);
}

function imageResponse(buffer: Buffer, contentType: string, cacheForever = true) {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      // A original servida no lugar de uma versão que falhou não é cacheada para sempre,
      // assim a versão otimizada pode ser gerada numa próxima tentativa
      "Cache-Control": cacheForever ? "public, max-age=31536000, immutable" : "public, max-age=3600",
    },
  });
}

const ALLOWED_WIDTHS = new Set([160, 320, 480, 800, 1200, 1920]);
const generating = new Map<string, Promise<Buffer | null>>();

/**
 * Redimensiona com sharp (1 thread, sem cache em memória — o servidor tem
 * limite de processos) e grava ao lado da original. Pedidos simultâneos da
 * mesma versão esperam a mesma geração.
 */
function generateVariant(original: string, target: string, width: number): Promise<Buffer | null> {
  const running = generating.get(target);
  if (running) return running;
  const job = (async () => {
    try {
      const sharp = (await import("sharp")).default;
      sharp.concurrency(1);
      sharp.cache(false);
      const out = await sharp(original, { failOn: "none" })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: width >= 1200 ? 82 : 78 })
        .toBuffer();
      await writeFile(target, out);
      return out;
    } catch (err) {
      console.error("[files] falha ao gerar versão", target, err);
      return null;
    } finally {
      generating.delete(target);
    }
  })();
  generating.set(target, job);
  return job;
}
