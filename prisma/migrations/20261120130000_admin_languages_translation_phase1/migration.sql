-- Phase 1 only: languages and manually approved entity display translations.
-- No original customer/worker/naka/mitra tables are modified.
CREATE TABLE IF NOT EXISTS `app_language` (
  `code` VARCHAR(12) NOT NULL,
  `name` VARCHAR(80) NOT NULL,
  `nativeName` VARCHAR(80) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT false,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `sortOrder` INTEGER NOT NULL DEFAULT 100,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `content_translation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `entityType` VARCHAR(32) NOT NULL,
  `entityId` INTEGER NOT NULL,
  `fieldKey` VARCHAR(48) NOT NULL,
  `languageCode` VARCHAR(12) NOT NULL,
  `translatedValue` TEXT NOT NULL,
  `sourceHash` VARCHAR(64) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  `updatedById` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `ct_entity_field_lang_uq` (`entityType`, `entityId`, `fieldKey`, `languageCode`),
  INDEX `content_translation_entityType_entityId_idx` (`entityType`, `entityId`),
  INDEX `content_translation_languageCode_status_idx` (`languageCode`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `content_translation`
ADD CONSTRAINT `content_translation_languageCode_fkey`
FOREIGN KEY (`languageCode`) REFERENCES `app_language`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed defaults once. Admin-edited existing rows are never overwritten on subsequent deploys.
INSERT IGNORE INTO `app_language` (`code`, `name`, `nativeName`, `isActive`, `isDefault`, `sortOrder`, `createdAt`, `updatedAt`) VALUES
('en', 'English', 'English', true, true, 1, NOW(3), NOW(3)),
('mr', 'Marathi', 'मराठी', true, false, 2, NOW(3), NOW(3)),
('hi', 'Hindi', 'हिंदी', true, false, 3, NOW(3), NOW(3));
