-- AlterTable: CompanySettings - add local pickup (retirada) option
ALTER TABLE `CompanySettings` ADD COLUMN `freteLocalRetirada` BOOLEAN NOT NULL DEFAULT false;
