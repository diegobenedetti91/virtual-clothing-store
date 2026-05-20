-- AlterTable: CompanySettings - add Melhor Envio and package dimension fields
ALTER TABLE `CompanySettings` ADD COLUMN `melhorEnvioToken` TEXT NULL;
ALTER TABLE `CompanySettings` ADD COLUMN `fretePacoteAltura` INTEGER NOT NULL DEFAULT 5;
ALTER TABLE `CompanySettings` ADD COLUMN `fretePacoteLargura` INTEGER NOT NULL DEFAULT 12;
ALTER TABLE `CompanySettings` ADD COLUMN `fretePacoteComprimento` INTEGER NOT NULL DEFAULT 17;
