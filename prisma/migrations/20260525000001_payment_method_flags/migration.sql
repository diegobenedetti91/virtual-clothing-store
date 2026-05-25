-- AlterTable: CompanySettings - add individual payment method active flags
ALTER TABLE `CompanySettings` ADD COLUMN `mercadoPagoAtivo` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `CompanySettings` ADD COLUMN `nuPayAtivo` BOOLEAN NOT NULL DEFAULT false;
