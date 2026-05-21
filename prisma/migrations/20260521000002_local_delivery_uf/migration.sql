-- AlterTable: CompanySettings - add local delivery state (UF) field
ALTER TABLE `CompanySettings` ADD COLUMN `freteLocalUF` VARCHAR(191) NULL;
