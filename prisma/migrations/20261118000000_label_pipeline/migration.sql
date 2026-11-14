-- AlterTable
ALTER TABLE `Order` ADD COLUMN `labelFile` VARCHAR(191) NULL,
    ADD COLUMN `labelGeneratedAt` DATETIME(3) NULL,
    ADD COLUMN `labelLastAttemptAt` DATETIME(3) NULL,
    ADD COLUMN `labelPrintUrl` TEXT NULL,
    ADD COLUMN `labelPrintedAt` DATETIME(3) NULL,
    ADD COLUMN `labelStepAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `labelStepError` TEXT NULL,
    ADD COLUMN `nfeImportedAt` DATETIME(3) NULL;

