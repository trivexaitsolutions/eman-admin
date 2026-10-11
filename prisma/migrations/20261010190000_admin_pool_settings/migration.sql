-- Admin-managed pool schedule and pool-wise pricing settings.
ALTER TABLE `bookingsetting`
    ADD COLUMN `poolDayStart` VARCHAR(5) NOT NULL DEFAULT '08:00',
    ADD COLUMN `poolDayEnd` VARCHAR(5) NOT NULL DEFAULT '20:00',
    ADD COLUMN `poolReductionType` VARCHAR(20) NOT NULL DEFAULT 'FIXED',
    ADD COLUMN `poolReductionValue` DOUBLE NOT NULL DEFAULT 100;

CREATE TABLE `poolslot` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingSettingId` INTEGER NOT NULL DEFAULT 1,
    `startTime` VARCHAR(5) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `poolslot_bookingSettingId_startTime_key`(`bookingSettingId`, `startTime`),
    INDEX `poolslot_bookingSettingId_sortOrder_idx`(`bookingSettingId`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `worker`
    ADD COLUMN `availabilityPoolSlotId` INTEGER NULL,
    ADD INDEX `worker_availabilityPoolSlotId_idx` (`availabilityPoolSlotId`);

ALTER TABLE `booking`
    ADD COLUMN `workerPriceSnapshot` TEXT NULL;

UPDATE `booking`
SET `workerPriceSnapshot` = '{}'
WHERE `workerPriceSnapshot` IS NULL;

ALTER TABLE `booking`
    MODIFY `workerPriceSnapshot` TEXT NOT NULL;

ALTER TABLE `poolslot`
    ADD CONSTRAINT `poolslot_bookingSettingId_fkey`
    FOREIGN KEY (`bookingSettingId`) REFERENCES `bookingsetting`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `worker`
    ADD CONSTRAINT `worker_availabilityPoolSlotId_fkey`
    FOREIGN KEY (`availabilityPoolSlotId`) REFERENCES `poolslot`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing installations get one default Pool 1 at the day start.
INSERT INTO `poolslot`
    (`bookingSettingId`, `startTime`, `sortOrder`, `isActive`, `createdAt`, `updatedAt`)
SELECT 1, '08:00', 0, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
WHERE EXISTS (SELECT 1 FROM `bookingsetting` WHERE `id` = 1)
  AND NOT EXISTS (
      SELECT 1 FROM `poolslot`
      WHERE `bookingSettingId` = 1 AND `startTime` = '08:00'
  );
