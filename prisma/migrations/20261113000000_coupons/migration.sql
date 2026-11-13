-- AlterTable
ALTER TABLE `Order` ADD COLUMN `couponCode` VARCHAR(191) NULL,
    ADD COLUMN `couponDiscount` DOUBLE NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Order_couponCode_idx` ON `Order`(`couponCode`);

-- CreateTable
CREATE TABLE `Coupon` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'PERCENT',
    `value` DOUBLE NOT NULL DEFAULT 0,
    `maxDiscount` DOUBLE NULL,
    `minOrderValue` DOUBLE NULL,
    `startsAt` DATETIME(3) NULL,
    `endsAt` DATETIME(3) NULL,
    `usageLimit` INTEGER NULL,
    `perCustomerLimit` INTEGER NULL DEFAULT 1,
    `firstPurchaseOnly` BOOLEAN NOT NULL DEFAULT false,
    `stackWithPix` BOOLEAN NOT NULL DEFAULT false,
    `productIds` TEXT NULL,
    `categoryIds` TEXT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Coupon_code_key`(`code`),
    INDEX `Coupon_active_idx`(`active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
