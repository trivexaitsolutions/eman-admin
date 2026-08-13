ALTER TABLE `bookingsetting`
    ADD COLUMN `showMapToCustomer` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `nearbyNakaRadiusMeters` INTEGER NOT NULL DEFAULT 5000,
    ADD COLUMN `mapApiKey` TEXT NULL;
