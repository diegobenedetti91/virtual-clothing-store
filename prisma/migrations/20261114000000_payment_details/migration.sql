-- AlterTable
ALTER TABLE `Order` ADD COLUMN `paymentType` VARCHAR(191) NULL,
    ADD COLUMN `paymentInstallments` INTEGER NULL,
    ADD COLUMN `paymentNetAmount` DOUBLE NULL,
    ADD COLUMN `deliveredAt` DATETIME(3) NULL;

-- Backfill: pedidos já entregues/retirados usam a última atualização como data de entrega
UPDATE `Order` SET `deliveredAt` = `updatedAt`
WHERE `status` IN ('DELIVERED', 'RETIRADO') AND `deliveredAt` IS NULL;
