ALTER TABLE `Product` ADD COLUMN `attributes` TEXT NOT NULL;
ALTER TABLE `OrderItem` ADD COLUMN `selectedAttributes` LONGTEXT NULL;
ALTER TABLE `WaitlistEntry` ADD COLUMN `variantKey` VARCHAR(191) NOT NULL DEFAULT '';
CREATE UNIQUE INDEX `WaitlistEntry_productId_email_variantKey_key` ON `WaitlistEntry`(`productId`, `email`, `variantKey`);
