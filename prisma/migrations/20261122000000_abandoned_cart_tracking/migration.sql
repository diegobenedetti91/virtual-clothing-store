-- AlterTable
ALTER TABLE `AbandonedCart` ADD COLUMN `closedAt` DATETIME(3) NULL,
    ADD COLUMN `reminderSentAt` DATETIME(3) NULL;

