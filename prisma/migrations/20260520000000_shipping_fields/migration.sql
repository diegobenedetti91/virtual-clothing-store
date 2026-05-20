-- AlterTable: Product - add pesoGramas
ALTER TABLE `Product` ADD COLUMN `pesoGramas` INTEGER NULL;

-- AlterTable: Order - add shippingCost and shippingMethod
ALTER TABLE `Order` ADD COLUMN `shippingCost` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `Order` ADD COLUMN `shippingMethod` VARCHAR(191) NULL;

-- AlterTable: CompanySettings - add frete fields
ALTER TABLE `CompanySettings` ADD COLUMN `freteAtivo` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `CompanySettings` ADD COLUMN `freteTipo` VARCHAR(191) NOT NULL DEFAULT 'fixo';
ALTER TABLE `CompanySettings` ADD COLUMN `freteValorFixo` DOUBLE NOT NULL DEFAULT 0;
ALTER TABLE `CompanySettings` ADD COLUMN `freteCEPOrigem` VARCHAR(191) NULL;
ALTER TABLE `CompanySettings` ADD COLUMN `fretePesoDefaultGramas` INTEGER NOT NULL DEFAULT 500;
