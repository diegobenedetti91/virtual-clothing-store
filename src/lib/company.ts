import { cache } from "react";
import { prisma } from "./prisma";

export const getCompanySettings = cache(async () => {
  try {
    return await prisma.companySettings.findFirst({ orderBy: { updatedAt: "desc" } });
  } catch (e) {
    console.error("[getCompanySettings] failed:", e);
    return null;
  }
});
