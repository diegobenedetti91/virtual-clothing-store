-- AlterTable: CompanySettings - add NuPay credentials fields
ALTER TABLE `CompanySettings` ADD COLUMN `nuPayClientId` VARCHAR(191) NULL;
ALTER TABLE `CompanySettings` ADD COLUMN `nuPayClientSecret` TEXT NULL;
