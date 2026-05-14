-- AddColumn: dynamic attributes to Product
ALTER TABLE `Product` ADD COLUMN `attributes` TEXT NOT NULL DEFAULT '[]';

-- AddColumn: selectedAttributes to OrderItem
ALTER TABLE `OrderItem` ADD COLUMN `selectedAttributes` LONGTEXT NULL;

-- AddColumn: variantKey to WaitlistEntry
ALTER TABLE `WaitlistEntry` ADD COLUMN `variantKey` VARCHAR(512) NOT NULL DEFAULT '';

-- CreateIndex: new variantKey unique (old size+color index kept — MySQL FK constraint)
CREATE UNIQUE INDEX `WaitlistEntry_productId_email_variantKey_key` ON `WaitlistEntry`(`productId`, `email`, `variantKey`(512));
