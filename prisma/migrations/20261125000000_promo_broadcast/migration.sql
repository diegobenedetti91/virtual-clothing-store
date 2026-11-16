-- AlterTable
ALTER TABLE `FlashSale` ADD COLUMN `notifyCustomers` BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE `Coupon` ADD COLUMN `notifyCustomers` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `notifySent` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `PromoCampaign` ADD COLUMN `audience` VARCHAR(191) NULL,
    ADD COLUMN `finishedAt` DATETIME(3) NULL,
    ADD COLUMN `cursor` VARCHAR(191) NULL,
    MODIFY `productId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `PromoEmail` MODIFY `productId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `PromoEmail_campaignId_customerId_idx` ON `PromoEmail`(`campaignId`, `customerId`);


-- O que já existe antes deste recurso NÃO dispara aviso (senão o primeiro deploy mandaria e-mail de todo cupom/promoção antiga)
UPDATE `Coupon` SET `notifySent` = true;
UPDATE `FlashSale` SET `notifySent` = true;
