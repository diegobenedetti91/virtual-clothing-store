-- CreateTable: PackagePreset
CREATE TABLE `PackagePreset` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `comprimento` INTEGER NOT NULL,
    `largura` INTEGER NOT NULL,
    `altura` INTEGER NOT NULL,
    `pesoGramas` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable: Product - add embalagemId
ALTER TABLE `Product` ADD COLUMN `embalagemId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_embalagemId_fkey` FOREIGN KEY (`embalagemId`) REFERENCES `PackagePreset`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
