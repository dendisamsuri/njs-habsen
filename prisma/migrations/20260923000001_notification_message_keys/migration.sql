-- Notification copy lives in the i18n registry: store keys + params, render at read.
ALTER TABLE `notifications`
  ADD COLUMN `title_key` VARCHAR(120) NULL,
  ADD COLUMN `body_key` VARCHAR(120) NULL,
  ADD COLUMN `body_params` JSON NULL;
