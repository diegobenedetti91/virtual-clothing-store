-- AddColumn: dynamic attributes to Product (IF NOT EXISTS — idempotent)
ALTER TABLE `Product` ADD COLUMN IF NOT EXISTS `attributes` TEXT NOT NULL DEFAULT '[]';

-- AddColumn: selectedAttributes to OrderItem (IF NOT EXISTS — idempotent)
ALTER TABLE `OrderItem` ADD COLUMN IF NOT EXISTS `selectedAttributes` LONGTEXT NULL;

-- AddColumn: variantKey to WaitlistEntry (IF NOT EXISTS — idempotent)
ALTER TABLE `WaitlistEntry` ADD COLUMN IF NOT EXISTS `variantKey` VARCHAR(512) NOT NULL DEFAULT '';

-- CreateIndex: new variantKey unique (IF NOT EXISTS — idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS `WaitlistEntry_productId_email_variantKey_key` ON `WaitlistEntry`(`productId`, `email`, `variantKey`(512));
