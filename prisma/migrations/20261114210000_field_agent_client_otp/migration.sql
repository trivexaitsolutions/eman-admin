-- Independent Field Agent client OTP challenges; existing mitra/customer records unchanged.
CREATE TABLE `field_agent_client_otp` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `mitraId` INTEGER NOT NULL,
  `draftId` INTEGER NOT NULL,
  `phone` VARCHAR(20) NOT NULL,
  `email` VARCHAR(191) NULL,
  `channel` VARCHAR(20) NOT NULL,
  `codeHash` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `verifiedAt` DATETIME(3) NULL,
  `consumedAt` DATETIME(3) NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `field_agent_client_otp_mitraId_draftId_createdAt_idx`(`mitraId`,`draftId`,`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
