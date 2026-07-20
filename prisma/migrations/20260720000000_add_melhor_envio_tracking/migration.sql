-- AlterTable
ALTER TABLE `Order` ADD COLUMN `melhorEnvioShipmentId` VARCHAR(191) NULL,
ADD COLUMN `trackingUrl` VARCHAR(191) NULL,
ADD COLUMN `shipmentStatus` VARCHAR(191) NULL DEFAULT 'pending',
ADD COLUMN `lastTrackingUpdate` DATETIME(3) NULL,
ADD COLUMN `etiquetaUrl` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `TrackingEvent` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `details` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TrackingEvent_orderId_timestamp_idx`(`orderId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TrackingEvent` ADD CONSTRAINT `TrackingEvent_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
