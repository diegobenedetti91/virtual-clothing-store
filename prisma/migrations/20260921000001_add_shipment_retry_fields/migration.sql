-- AlterTable
ALTER TABLE `Order` ADD COLUMN `shipmentAttempts` INT NOT NULL DEFAULT 0,
ADD COLUMN `lastShipmentAttempt` DATETIME(3) NULL,
ADD COLUMN `shipmentRetryError` LONGTEXT NULL,
ADD COLUMN `shipmentRetryableError` BOOLEAN NULL DEFAULT false;
