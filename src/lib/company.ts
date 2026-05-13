import { cache } from "react";
import { prisma } from "./prisma";

export const getCompanySettings = cache(async () => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
    } catch (e) {
      if (attempt === 2) {
        console.error("[getCompanySettings] failed after 3 attempts:", e);
        return null;
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return null;
});
