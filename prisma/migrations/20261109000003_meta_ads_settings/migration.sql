-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `metaPixelId` VARCHAR(191) NULL,
ADD COLUMN `metaCapiAccessToken` TEXT NULL,
ADD COLUMN `metaTestEventCode` VARCHAR(191) NULL;
