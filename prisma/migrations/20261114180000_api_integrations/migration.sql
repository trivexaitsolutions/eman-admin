CREATE TABLE `api_integration_setting` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `encryptedPayload` LONGTEXT NOT NULL,
  `updatedById` INTEGER NULL,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
