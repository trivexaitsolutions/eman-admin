ALTER TABLE `leaverequest`
    ADD COLUMN `reassignToMitraId` INTEGER NULL;

CREATE INDEX `leaverequest_reassignToMitraId_idx` ON `leaverequest`(`reassignToMitraId`);

ALTER TABLE `leaverequest`
    ADD CONSTRAINT `leaverequest_reassignToMitraId_fkey`
    FOREIGN KEY (`reassignToMitraId`) REFERENCES `mitra`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Old pending REASSIGN_ALL decisions did not contain an Admin-selected target.
-- Keep already-completed handovers as history, but stop any pending automatic redistribution.
UPDATE `leaverequest`
SET `workHandling` = 'KEEP'
WHERE `workHandling` = 'REASSIGN_ALL'
  AND `workReassignedAt` IS NULL;
