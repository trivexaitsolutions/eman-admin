-- Store the worker's selected work-duration preference on each booking
-- and the exact time each worker's arrival is verified.
-- MariaDB/MySQL compatibility: TEXT columns cannot use DEFAULT '{}'.

ALTER TABLE `booking`
  ADD COLUMN `workerWorkDurations` TEXT NULL,
  ADD COLUMN `workerArrivalTimes` TEXT NULL;

-- Backfill existing bookings before making the columns required.
UPDATE `booking`
SET `workerWorkDurations` = '{}'
WHERE `workerWorkDurations` IS NULL;

UPDATE `booking`
SET `workerArrivalTimes` = '{}'
WHERE `workerArrivalTimes` IS NULL;

ALTER TABLE `booking`
  MODIFY COLUMN `workerWorkDurations` TEXT NOT NULL,
  MODIFY COLUMN `workerArrivalTimes` TEXT NOT NULL;
