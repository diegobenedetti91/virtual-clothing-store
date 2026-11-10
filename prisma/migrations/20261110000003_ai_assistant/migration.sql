-- AlterTable
ALTER TABLE `CompanySettings` ADD COLUMN `aiAssistantEnabled` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `aiApiKey` TEXT NULL,
ADD COLUMN `aiModel` VARCHAR(191) NOT NULL DEFAULT 'claude-opus-5-5',
ADD COLUMN `aiPolicies` TEXT NULL,
ADD COLUMN `aiDailyMessageLimit` INTEGER NOT NULL DEFAULT 300;

-- CreateTable
CREATE TABLE `AiConversation` (
    `id` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `model` VARCHAR(191) NOT NULL,
    `system` LONGTEXT NOT NULL,
    `messages` JSON NOT NULL,
    `userMessages` INTEGER NOT NULL DEFAULT 0,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `cacheReadTokens` INTEGER NOT NULL DEFAULT 0,
    `handedOff` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiConversation_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsageDay` (
    `day` VARCHAR(191) NOT NULL,
    `messages` INTEGER NOT NULL DEFAULT 0,
    `inputTokens` INTEGER NOT NULL DEFAULT 0,
    `outputTokens` INTEGER NOT NULL DEFAULT 0,
    `cacheReadTokens` INTEGER NOT NULL DEFAULT 0,
    `cacheWriteTokens` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
