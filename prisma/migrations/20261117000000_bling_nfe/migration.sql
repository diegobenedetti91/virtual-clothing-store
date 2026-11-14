-- AlterTable
ALTER TABLE `Order` ADD COLUMN `nfeAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `nfeAuthorizedAt` DATETIME(3) NULL,
    ADD COLUMN `nfeChave` VARCHAR(191) NULL,
    ADD COLUMN `nfeEmailSentAt` DATETIME(3) NULL,
    ADD COLUMN `nfeError` TEXT NULL,
    ADD COLUMN `nfeId` VARCHAR(191) NULL,
    ADD COLUMN `nfeLastCheckAt` DATETIME(3) NULL,
    ADD COLUMN `nfeNumero` VARCHAR(191) NULL,
    ADD COLUMN `nfeSerie` VARCHAR(191) NULL,
    ADD COLUMN `nfeSituacao` INTEGER NULL,
    ADD COLUMN `nfeStatus` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `blingNfeAuto` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `Order_nfeStatus_idx` ON `Order`(`nfeStatus`);

