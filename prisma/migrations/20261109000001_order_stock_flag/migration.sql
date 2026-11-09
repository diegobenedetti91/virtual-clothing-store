-- AlterTable
ALTER TABLE `Order` ADD COLUMN `stockDecrementedAt` DATETIME(3) NULL;

-- Backfill: mark orders whose stock was already taken under the old rules,
-- so cancelling them gives the stock back exactly once.
-- Gateway orders that were paid (stock taken at checkout and/or webhook):
UPDATE `Order` SET `stockDecrementedAt` = `updatedAt`
WHERE `paymentMethod` IN ('Mercado Pago', 'NuPay', 'Infinity Pay')
  AND `status` IN ('CONFIRMED', 'SHIPPED', 'PRONTO_PARA_RETIRADA', 'RETIRADO', 'DELIVERED');

-- Mercado Pago / NuPay orders still awaiting payment: stock was taken at checkout
-- since commit 6f626f9 (2026-09-18 16:48 -03:00).
UPDATE `Order` SET `stockDecrementedAt` = `createdAt`
WHERE `paymentMethod` IN ('Mercado Pago', 'NuPay')
  AND `status` = 'PENDING'
  AND `createdAt` >= '2026-09-18 19:48:32';
