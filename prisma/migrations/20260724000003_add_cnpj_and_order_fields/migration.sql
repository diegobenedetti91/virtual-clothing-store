-- AddColumn cnpj to CompanySettings
ALTER TABLE `CompanySettings` ADD COLUMN `cnpj` VARCHAR(191);

-- AddColumn streetNumber to Order
ALTER TABLE `Order` ADD COLUMN `streetNumber` VARCHAR(191);

-- AddColumn neighborhood to Order
ALTER TABLE `Order` ADD COLUMN `neighborhood` VARCHAR(191);

-- AddColumn cpfCnpj to Order
ALTER TABLE `Order` ADD COLUMN `cpfCnpj` VARCHAR(191);
