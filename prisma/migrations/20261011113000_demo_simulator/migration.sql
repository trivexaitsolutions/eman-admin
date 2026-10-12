-- E-MAN admin simulator. MySQL 8 / MariaDB safe; no TEXT/JSON defaults.
ALTER TABLE `worker` ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `mitra` ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `customer` ADD COLUMN `isDemo` BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX `worker_isDemo_idx` ON `worker`(`isDemo`);
CREATE INDEX `customer_isDemo_idx` ON `customer`(`isDemo`);

CREATE TABLE `simulatorcampaign` (
 `id` INTEGER NOT NULL AUTO_INCREMENT,
 `name` VARCHAR(191) NOT NULL,
 `mode` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
 `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
 `maxWorkers` INTEGER NOT NULL DEFAULT 200,
 `pollSeconds` INTEGER NOT NULL DEFAULT 20,
 `createdById` INTEGER NULL,
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `simulatorinstance` (
 `id` INTEGER NOT NULL AUTO_INCREMENT,
 `campaignId` INTEGER NOT NULL,
 `workerId` INTEGER NOT NULL,
 `deviceId` VARCHAR(64) NOT NULL,
 `slotIndex` INTEGER NOT NULL,
 `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 PRIMARY KEY (`id`),
 UNIQUE INDEX `simulatorinstance_campaignId_workerId_key` (`campaignId`, `workerId`),
 UNIQUE INDEX `simulatorinstance_campaignId_deviceId_slotIndex_key` (`campaignId`, `deviceId`, `slotIndex`),
 INDEX `simulatorinstance_workerId_idx` (`workerId`),
 INDEX `simulatorinstance_campaignId_deviceId_idx` (`campaignId`, `deviceId`),
 CONSTRAINT `simulatorinstance_campaignId_fkey`
   FOREIGN KEY (`campaignId`) REFERENCES `simulatorcampaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
