-- CreateTable
CREATE TABLE `companies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    `settings` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `companies_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NULL,
    `email` VARCHAR(190) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `nama_lengkap` VARCHAR(160) NOT NULL,
    `nip` VARCHAR(64) NULL,
    `role` ENUM('PLATFORM_ADMIN', 'COMPANY_ADMIN', 'SUPERVISOR', 'EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
    `direct_lead_id` INTEGER NULL,
    `position_id` INTEGER NULL,
    `location_id` INTEGER NULL,
    `schedule_id` INTEGER NULL,
    `phone` VARCHAR(32) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `lang_pref` VARCHAR(5) NOT NULL DEFAULT 'id',
    `jwt_version` INTEGER NOT NULL DEFAULT 1,
    `face_registered` BOOLEAN NOT NULL DEFAULT false,
    `is_flexible_location` BOOLEAN NOT NULL DEFAULT false,
    `allow_replacement_off` BOOLEAN NOT NULL DEFAULT true,
    `allow_schedule_selection` BOOLEAN NOT NULL DEFAULT false,
    `allow_multiple_checkout` BOOLEAN NOT NULL DEFAULT false,
    `allow_half_day` BOOLEAN NOT NULL DEFAULT true,
    `allow_joint_leave` BOOLEAN NOT NULL DEFAULT true,
    `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_company_id_idx`(`company_id`),
    INDEX `users_direct_lead_id_idx`(`direct_lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(128) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_hash_key`(`token_hash`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_attempts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(190) NOT NULL,
    `ip` VARCHAR(64) NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_attempts_email_created_at_idx`(`email`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `positions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `positions_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `latitude` DECIMAL(10, 7) NOT NULL,
    `longitude` DECIMAL(10, 7) NOT NULL,
    `radius_meters` INTEGER NOT NULL DEFAULT 100,
    `status` VARCHAR(1) NOT NULL DEFAULT 'Y',
    `is_flexible` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `locations_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `holidays` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `holidays_company_id_date_key`(`company_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `schedules_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `schedule_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `schedule_id` INTEGER NOT NULL,
    `day_of_week` ENUM('SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY') NOT NULL,
    `time_in` VARCHAR(8) NOT NULL,
    `time_out` VARCHAR(8) NOT NULL,
    `tolerance_minutes` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `schedule_details_schedule_id_day_of_week_key`(`schedule_id`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_types` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `code` VARCHAR(32) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `category` ENUM('LEAVE', 'PERMIT', 'SICK') NOT NULL DEFAULT 'LEAVE',
    `is_deductible` BOOLEAN NOT NULL DEFAULT true,
    `requires_attachment` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_types_company_id_code_key`(`company_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    `tipe_absen` VARCHAR(20) NOT NULL DEFAULT 'selfie',
    `require_hr_final` BOOLEAN NOT NULL DEFAULT true,
    `date_format` VARCHAR(20) NOT NULL DEFAULT 'YYYY-MM-DD',
    `extra` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `company_settings_company_id_key`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `tanggal` DATE NOT NULL,
    `schedule_id` INTEGER NULL,
    `schedule_time_in` VARCHAR(8) NULL,
    `schedule_time_out` VARCHAR(8) NULL,
    `tolerance_minutes` INTEGER NULL,
    `check_in` VARCHAR(8) NULL,
    `check_out` VARCHAR(8) NULL,
    `status_masuk` VARCHAR(20) NULL,
    `status_pulang` VARCHAR(20) NULL,
    `kehadiran` VARCHAR(20) NOT NULL DEFAULT 'HADIR',
    `latitude_in` DECIMAL(10, 7) NULL,
    `longitude_in` DECIMAL(10, 7) NULL,
    `latitude_out` DECIMAL(10, 7) NULL,
    `longitude_out` DECIMAL(10, 7) NULL,
    `location_id_in` INTEGER NULL,
    `location_id_out` INTEGER NULL,
    `photo_in` VARCHAR(500) NULL,
    `photo_out` VARCHAR(500) NULL,
    `tipe` VARCHAR(20) NULL,
    `replacement_off_id` INTEGER NULL,
    `is_flexible` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendances_company_id_tanggal_idx`(`company_id`, `tanggal`),
    INDEX `attendances_company_id_kehadiran_idx`(`company_id`, `kehadiran`),
    UNIQUE INDEX `attendances_company_id_user_id_tanggal_key`(`company_id`, `user_id`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_process_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `flow_id` VARCHAR(64) NOT NULL,
    `user_id` INTEGER NULL,
    `attendance_id` INTEGER NULL,
    `stage` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `attendancesId` INTEGER NULL,

    UNIQUE INDEX `attendance_process_logs_flow_id_key`(`flow_id`),
    INDEX `attendance_process_logs_company_id_created_at_idx`(`company_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_process_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `flow_id` VARCHAR(64) NOT NULL,
    `stage` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `message` VARCHAR(500) NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_process_events_flow_id_idx`(`flow_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance_correction_audits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `attendance_id` INTEGER NOT NULL,
    `actor_id` INTEGER NOT NULL,
    `before` JSON NOT NULL,
    `after` JSON NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attendance_correction_audits_company_id_created_at_idx`(`company_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `total_days` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `is_half_day` BOOLEAN NOT NULL DEFAULT false,
    `reason` TEXT NOT NULL,
    `attachment` VARCHAR(500) NULL,
    `status` ENUM('pending', 'waiting_hr', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `leave_requests_company_id_status_idx`(`company_id`, `status`),
    INDEX `leave_requests_company_id_user_id_idx`(`company_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `replacement_off` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `schedule_id` INTEGER NULL,
    `original_date` DATE NOT NULL,
    `is_half_day` BOOLEAN NOT NULL DEFAULT false,
    `replacement_date` DATE NULL,
    `expires_at` DATE NULL,
    `status` ENUM('draft', 'pending', 'waiting_hr', 'approved', 'rejected', 'cancelled', 'expired', 'used') NOT NULL DEFAULT 'draft',
    `employee_note` TEXT NULL,
    `reason` TEXT NULL,
    `created_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `replacement_off_company_id_status_idx`(`company_id`, `status`),
    INDEX `replacement_off_company_id_user_id_idx`(`company_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `request_approvals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `request_type` ENUM('LEAVE', 'REPLACEMENT_OFF') NOT NULL,
    `request_id` INTEGER NOT NULL,
    `event_type` ENUM('SUBMIT', 'APPROVAL', 'EDIT', 'DELETE') NOT NULL,
    `actor_id` INTEGER NOT NULL,
    `level` INTEGER NOT NULL DEFAULT 1,
    `status` VARCHAR(20) NOT NULL,
    `comment` VARCHAR(500) NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `request_approvals_company_id_request_type_request_id_idx`(`company_id`, `request_type`, `request_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `leave_type_id` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `entitlement` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taken` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `remaining` DECIMAL(5, 2) NULL DEFAULT (`entitlement` - `taken`),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_balances_company_id_user_id_leave_type_id_year_key`(`company_id`, `user_id`, `leave_type_id`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `recipient_type` VARCHAR(20) NOT NULL,
    `recipient_id` INTEGER NULL,
    `role` VARCHAR(20) NULL,
    `category` ENUM('APPROVAL', 'LEAVE', 'REPLACEMENT_OFF', 'ATTENDANCE', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `event_key` VARCHAR(160) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `body` TEXT NULL,
    `link` VARCHAR(500) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_company_id_recipient_id_is_read_idx`(`company_id`, `recipient_id`, `is_read`),
    UNIQUE INDEX `notifications_company_id_event_key_key`(`company_id`, `event_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `face_recognitions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `company_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `photo_path` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `face_recognitions_company_id_user_id_key`(`company_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_direct_lead_id_fkey` FOREIGN KEY (`direct_lead_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_position_id_fkey` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_location_id_fkey` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `positions` ADD CONSTRAINT `positions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locations` ADD CONSTRAINT `locations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `holidays` ADD CONSTRAINT `holidays_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedules` ADD CONSTRAINT `schedules_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `schedule_details` ADD CONSTRAINT `schedule_details_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_types` ADD CONSTRAINT `leave_types_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_settings` ADD CONSTRAINT `company_settings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_location_id_in_fkey` FOREIGN KEY (`location_id_in`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_location_id_out_fkey` FOREIGN KEY (`location_id_out`) REFERENCES `locations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendances` ADD CONSTRAINT `attendances_replacement_off_id_fkey` FOREIGN KEY (`replacement_off_id`) REFERENCES `replacement_off`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_process_logs` ADD CONSTRAINT `attendance_process_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_process_logs` ADD CONSTRAINT `attendance_process_logs_attendancesId_fkey` FOREIGN KEY (`attendancesId`) REFERENCES `attendances`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_process_events` ADD CONSTRAINT `attendance_process_events_flow_id_fkey` FOREIGN KEY (`flow_id`) REFERENCES `attendance_process_logs`(`flow_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_correction_audits` ADD CONSTRAINT `attendance_correction_audits_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_correction_audits` ADD CONSTRAINT `attendance_correction_audits_attendance_id_fkey` FOREIGN KEY (`attendance_id`) REFERENCES `attendances`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_correction_audits` ADD CONSTRAINT `attendance_correction_audits_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replacement_off` ADD CONSTRAINT `replacement_off_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replacement_off` ADD CONSTRAINT `replacement_off_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `replacement_off` ADD CONSTRAINT `replacement_off_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_approvals` ADD CONSTRAINT `request_approvals_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `request_approvals` ADD CONSTRAINT `request_approvals_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_leave_type_id_fkey` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_recipient_id_fkey` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_recognitions` ADD CONSTRAINT `face_recognitions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `face_recognitions` ADD CONSTRAINT `face_recognitions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

