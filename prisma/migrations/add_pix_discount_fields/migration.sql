-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `pixDiscountEnabled` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `pixDiscountPercent` DOUBLE NOT NULL DEFAULT 0;
