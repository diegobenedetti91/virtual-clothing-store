-- AlterTable
ALTER TABLE `Order` ADD COLUMN `cashbackEarned` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `cashbackExpiryEmailAt` DATETIME(3) NULL,
    ADD COLUMN `cashbackReleaseEmailAt` DATETIME(3) NULL,
    ADD COLUMN `creditUsed` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `cashbackEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cashbackMaxUsePercent` DOUBLE NOT NULL DEFAULT 50,
    ADD COLUMN `cashbackMinOrder` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `cashbackPercent` DOUBLE NOT NULL DEFAULT 5,
    ADD COLUMN `cashbackReleaseDays` INTEGER NOT NULL DEFAULT 7,
    ADD COLUMN `cashbackStackCoupon` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `cashbackStackPix` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `cashbackValidityDays` INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE `CreditAdjustment` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CreditAdjustment_customerId_idx`(`customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Order_customerId_status_idx` ON `Order`(`customerId`, `status`);

-- AddForeignKey
ALTER TABLE `CreditAdjustment` ADD CONSTRAINT `CreditAdjustment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `CustomerUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

