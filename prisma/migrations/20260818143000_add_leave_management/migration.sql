CREATE TABLE `leaverequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectType` VARCHAR(191) NOT NULL,
    `employeeId` INTEGER NULL,
    `mitraId` INTEGER NULL,
    `leaveType` VARCHAR(191) NOT NULL,
    `dayType` VARCHAR(191) NOT NULL DEFAULT 'FULL_DAY',
    `fromDate` DATE NOT NULL,
    `toDate` DATE NOT NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decisionNote` TEXT NULL,
    `decidedByEmployeeId` INTEGER NULL,
    `decidedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leaverequest_subjectType_status_fromDate_toDate_idx`(`subjectType`, `status`, `fromDate`, `toDate`),
    INDEX `leaverequest_employeeId_idx`(`employeeId`),
    INDEX `leaverequest_mitraId_idx`(`mitraId`),
    INDEX `leaverequest_decidedByEmployeeId_idx`(`decidedByEmployeeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_employeeId_fkey`
    FOREIGN KEY (`employeeId`) REFERENCES `employee`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_mitraId_fkey`
    FOREIGN KEY (`mitraId`) REFERENCES `mitra`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_decidedByEmployeeId_fkey`
    FOREIGN KEY (`decidedByEmployeeId`) REFERENCES `employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
