-- Run this script once in the Neon SQL editor (or any PostgreSQL client)
-- to apply the dynamic attributes migration.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "attributes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "selectedAttributes" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN IF NOT EXISTS "variantKey" VARCHAR(512) NOT NULL DEFAULT '';

-- Drop old unique index (size+color) if it exists
DROP INDEX IF EXISTS "WaitlistEntry_productId_email_size_color_key";

-- New unique index on variantKey
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_productId_email_variantKey_key"
  ON "WaitlistEntry"("productId", "email", "variantKey");
