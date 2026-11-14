-- AlterTable
ALTER TABLE `CustomerUser` ADD COLUMN `marketingOptOut` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `promoAutoNotify` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `PromoCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `couponCode` VARCHAR(191) NULL,
    `flashSaleId` VARCHAR(191) NULL,
    `priceBefore` DOUBLE NULL,
    `priceAfter` DOUBLE NULL,
    `trigger` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `sent` INTEGER NOT NULL DEFAULT 0,
    `skipped` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PromoCampaign_productId_idx`(`productId`),
    INDEX `PromoCampaign_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PromoEmail` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `clickedAt` DATETIME(3) NULL,

    INDEX `PromoEmail_customerId_sentAt_idx`(`customerId`, `sentAt`),
    INDEX `PromoEmail_productId_customerId_idx`(`productId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `AnalyticsEvent_customerId_type_idx` ON `AnalyticsEvent`(`customerId`, `type`);

-- AddForeignKey
ALTER TABLE `PromoCampaign` ADD CONSTRAINT `PromoCampaign_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoEmail` ADD CONSTRAINT `PromoEmail_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `PromoCampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PromoEmail` ADD CONSTRAINT `PromoEmail_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `CustomerUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

