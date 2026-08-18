ALTER TABLE `leaverequest`
    MODIFY `toDate` DATE NULL,
    ADD COLUMN `entrySource` VARCHAR(191) NOT NULL DEFAULT 'REQUEST',
    ADD COLUMN `workHandling` VARCHAR(191) NOT NULL DEFAULT 'KEEP',
    ADD COLUMN `workReassignedAt` DATETIME(3) NULL,
    ADD COLUMN `createdByEmployeeId` INTEGER NULL,
    ADD COLUMN `returnedAt` DATETIME(3) NULL,
    ADD COLUMN `returnedByEmployeeId` INTEGER NULL;

CREATE INDEX `leaverequest_createdByEmployeeId_idx` ON `leaverequest`(`createdByEmployeeId`);
CREATE INDEX `leaverequest_returnedByEmployeeId_idx` ON `leaverequest`(`returnedByEmployeeId`);
CREATE INDEX `leaverequest_workHandling_workReassignedAt_idx` ON `leaverequest`(`workHandling`, `workReassignedAt`);

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_createdByEmployeeId_fkey`
    FOREIGN KEY (`createdByEmployeeId`) REFERENCES `employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_returnedByEmployeeId_fkey`
    FOREIGN KEY (`returnedByEmployeeId`) REFERENCES `employee`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
