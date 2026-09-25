-- Drop the old table with incorrect ID size
DROP TABLE IF EXISTS `ProductVariantBlingMap`;

-- Recreate with correct VARCHAR(100) for IDs
CREATE TABLE `ProductVariantBlingMap` (
    `id` VARCHAR(100) NOT NULL,
    `productId` VARCHAR(100) NOT NULL,
    `size` VARCHAR(191) NOT NULL,
    `blingProdutoId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductVariantBlingMap_productId_size_key`(`productId`, `size`),
    INDEX `ProductVariantBlingMap_productId_idx`(`productId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductVariantBlingMap` ADD CONSTRAINT `ProductVariantBlingMap_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
