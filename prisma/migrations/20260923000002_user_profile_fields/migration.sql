-- Profile fields ported from legacy `user` (tempat_lahir/tanggal_lahir/jenis_kelamin/alamat).
ALTER TABLE `users`
  ADD COLUMN `place_of_birth` VARCHAR(40) NULL,
  ADD COLUMN `date_of_birth` DATE NULL,
  ADD COLUMN `gender` VARCHAR(10) NULL,
  ADD COLUMN `address` TEXT NULL;
