-- Presence marker is nullable: existing customers begin Offline until the app reports activity.
-- MySQL 8 and MariaDB compatible; no TEXT/JSON defaults.
ALTER TABLE `customer` ADD COLUMN `lastSeenAt` DATETIME(3) NULL;
