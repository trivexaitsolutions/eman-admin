CREATE TABLE `field_officer_draft` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `mitraId` INTEGER NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `step` INTEGER NOT NULL DEFAULT 1,
  `label` VARCHAR(120) NULL,
  `payload` LONGTEXT NOT NULL,
  `videoUrl` VARCHAR(255) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `field_officer_draft_mitraId_kind_updatedAt_idx`(`mitraId`, `kind`, `updatedAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `field_officer_draft_mitraId_fkey` FOREIGN KEY (`mitraId`)
      REFERENCES `mitra`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
