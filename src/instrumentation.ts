export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { prisma } = await import("./lib/prisma");
    await prisma.$connect().catch((e: unknown) => {
      console.error("[instrumentation] Prisma pre-connect failed:", e);
    });
  }
}
