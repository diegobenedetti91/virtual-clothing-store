-- AlterTable
ALTER TABLE `Order` ADD COLUMN `opsAlert` TEXT NULL,
    ADD COLUMN `opsAlertAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Return` ADD COLUMN `refundCredit` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `refundError` TEXT NULL;

-- CreateIndex
CREATE INDEX `Order_opsAlertAt_idx` ON `Order`(`opsAlertAt`);

