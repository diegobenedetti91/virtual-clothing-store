-- Add size and color columns if they don't exist
ALTER TABLE `WaitlistEntry` ADD COLUMN `size` VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE `WaitlistEntry` ADD COLUMN `color` VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE `WaitlistEntry` ADD COLUMN `variantKey` VARCHAR(191) NOT NULL DEFAULT '';

-- Create new unique index with size and color
ALTER TABLE `WaitlistEntry` ADD UNIQUE INDEX `WaitlistEntry_productId_email_size_color_key` (`productId`, `email`, `size`, `color`);
ALTER TABLE `WaitlistEntry` DROP INDEX `WaitlistEntry_productId_email_key`;
ALTER TABLE `WaitlistEntry` ADD UNIQUE INDEX `WaitlistEntry_productId_email_variantKey_key` (`productId`, `email`, `variantKey`);
