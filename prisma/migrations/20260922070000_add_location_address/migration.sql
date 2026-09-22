-- AlterTable: port legacy `lokasi_alamat` (TEXT NOT NULL).
-- MySQL forbids DEFAULT on TEXT, so: add nullable -> backfill -> enforce NOT NULL.
ALTER TABLE `locations` ADD COLUMN `address` TEXT NULL;
UPDATE `locations` SET `address` = '' WHERE `address` IS NULL;
ALTER TABLE `locations` MODIFY COLUMN `address` TEXT NOT NULL;
