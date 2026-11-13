-- AlterTable
ALTER TABLE `Coupon` ADD COLUMN `showInChat` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `Order` ADD COLUMN `shippingLabelCost` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `measurements` TEXT NULL;

-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `monthlyRevenueGoal` DOUBLE NULL;
