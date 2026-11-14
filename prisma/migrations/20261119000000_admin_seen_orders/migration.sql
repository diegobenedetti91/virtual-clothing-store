-- AlterTable
ALTER TABLE `Order` ADD COLUMN `adminSeenAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_adminSeenAt_status_idx` ON `Order`(`adminSeenAt`, `status`);


-- Pedidos que já existiam contam como vistos (o aviso começa só com os próximos)
UPDATE `Order` SET `adminSeenAt` = CURRENT_TIMESTAMP(3) WHERE `adminSeenAt` IS NULL;
