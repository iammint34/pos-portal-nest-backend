-- =============================================
-- Add cost_price to items
-- =============================================
ALTER TABLE `items` ADD COLUMN `cost_price` DECIMAL(10, 2) NULL;

-- =============================================
-- Cleanup: drop any partially-created tables from prior failed run
-- =============================================
DROP TABLE IF EXISTS `job_schedules`;
DROP TABLE IF EXISTS `background_jobs`;
DROP TABLE IF EXISTS `clone_jobs`;
DROP TABLE IF EXISTS `loss_prevention_incidents`;
DROP TABLE IF EXISTS `loss_prevention_thresholds`;
DROP TABLE IF EXISTS `notification_schedules`;
DROP TABLE IF EXISTS `notification_logs`;
DROP TABLE IF EXISTS `notification_preferences`;
DROP TABLE IF EXISTS `store_features`;

-- =============================================
-- Notifications: preferences, logs, schedules
-- =============================================
CREATE TABLE `notification_preferences` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `email_enabled` BOOLEAN NOT NULL DEFAULT true,
    `sms_enabled` BOOLEAN NOT NULL DEFAULT false,
    `daily_digest` BOOLEAN NOT NULL DEFAULT true,
    `weekly_summary` BOOLEAN NOT NULL DEFAULT false,
    `alerts_enabled` BOOLEAN NOT NULL DEFAULT true,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notification_preferences_store_id_idx`(`store_id`),
    INDEX `notification_preferences_user_id_idx`(`user_id`),
    UNIQUE INDEX `notification_preferences_store_id_user_id_key`(`store_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `notification_logs` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `type` ENUM('DAILY_DIGEST', 'WEEKLY_SUMMARY', 'LOSS_PREVENTION_ALERT', 'DEVICE_OFFLINE', 'SYNC_FAILURE', 'SYSTEM_ALERT') NOT NULL,
    `channel` ENUM('EMAIL', 'SMS') NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED', 'BOUNCED') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_logs_store_id_idx`(`store_id`),
    INDEX `notification_logs_user_id_idx`(`user_id`),
    INDEX `notification_logs_type_idx`(`type`),
    INDEX `notification_logs_status_idx`(`status`),
    INDEX `notification_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `notification_logs` ADD CONSTRAINT `notification_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `notification_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `type` ENUM('DAILY_DIGEST', 'WEEKLY_SUMMARY', 'LOSS_PREVENTION_ALERT', 'DEVICE_OFFLINE', 'SYNC_FAILURE', 'SYSTEM_ALERT') NOT NULL,
    `schedule` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Manila',
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notification_schedules_store_id_idx`(`store_id`),
    INDEX `notification_schedules_enabled_next_run_at_idx`(`enabled`, `next_run_at`),
    UNIQUE INDEX `notification_schedules_store_id_type_key`(`store_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notification_schedules` ADD CONSTRAINT `notification_schedules_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================
-- Loss Prevention: thresholds & incidents
-- =============================================
CREATE TABLE `loss_prevention_thresholds` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `metric_type` ENUM('VOID_COUNT', 'VOID_AMOUNT', 'REFUND_COUNT', 'REFUND_AMOUNT', 'DISCOUNT_PERCENTAGE', 'CONSECUTIVE_VOIDS') NOT NULL,
    `threshold` DECIMAL(10, 2) NOT NULL,
    `time_window` ENUM('SHIFT', 'DAY', 'WEEK') NOT NULL,
    `scope` ENUM('STAFF', 'BRANCH', 'DEVICE') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `loss_prevention_thresholds_store_id_idx`(`store_id`),
    INDEX `loss_prevention_thresholds_enabled_idx`(`enabled`),
    UNIQUE INDEX `loss_prevention_thresholds_store_id_metric_type_scope_key`(`store_id`, `metric_type`, `scope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loss_prevention_thresholds` ADD CONSTRAINT `loss_prevention_thresholds_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `loss_prevention_incidents` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `staff_id` VARCHAR(191) NULL,
    `pos_device_id` VARCHAR(191) NULL,
    `metric_type` ENUM('VOID_COUNT', 'VOID_AMOUNT', 'REFUND_COUNT', 'REFUND_AMOUNT', 'DISCOUNT_PERCENTAGE', 'CONSECUTIVE_VOIDS') NOT NULL,
    `actual_value` DECIMAL(10, 2) NOT NULL,
    `threshold_value` DECIMAL(10, 2) NOT NULL,
    `time_window` ENUM('SHIFT', 'DAY', 'WEEK') NOT NULL,
    `transactions` JSON NOT NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED') NOT NULL DEFAULT 'OPEN',
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'WARNING',
    `resolution` TEXT NULL,
    `resolved_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `acknowledged_by` VARCHAR(191) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `loss_prevention_incidents_store_id_idx`(`store_id`),
    INDEX `loss_prevention_incidents_branch_id_idx`(`branch_id`),
    INDEX `loss_prevention_incidents_staff_id_idx`(`staff_id`),
    INDEX `loss_prevention_incidents_status_idx`(`status`),
    INDEX `loss_prevention_incidents_metric_type_idx`(`metric_type`),
    INDEX `loss_prevention_incidents_created_at_idx`(`created_at`),
    INDEX `loss_prevention_incidents_store_id_status_created_at_idx`(`store_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `loss_prevention_incidents` ADD CONSTRAINT `loss_prevention_incidents_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loss_prevention_incidents` ADD CONSTRAINT `loss_prevention_incidents_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `loss_prevention_incidents` ADD CONSTRAINT `loss_prevention_incidents_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `loss_prevention_incidents` ADD CONSTRAINT `loss_prevention_incidents_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `loss_prevention_incidents` ADD CONSTRAINT `loss_prevention_incidents_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================
-- Cloning: clone_jobs
-- =============================================
CREATE TABLE `clone_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `type` ENUM('STORE', 'BRANCH') NOT NULL,
    `source_id` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NULL,
    `target_name` VARCHAR(191) NOT NULL,
    `config` JSON NOT NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK') NOT NULL DEFAULT 'PENDING',
    `error_message` TEXT NULL,
    `created_by` VARCHAR(191) NOT NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clone_jobs_store_id_idx`(`store_id`),
    INDEX `clone_jobs_status_idx`(`status`),
    INDEX `clone_jobs_created_by_idx`(`created_by`),
    INDEX `clone_jobs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `clone_jobs` ADD CONSTRAINT `clone_jobs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clone_jobs` ADD CONSTRAINT `clone_jobs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================
-- Background Jobs: background_jobs & job_schedules
-- =============================================
CREATE TABLE `background_jobs` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NULL,
    `type` ENUM('DAILY_DIGEST', 'WEEKLY_SUMMARY', 'ALERT_NOTIFICATION', 'CLONE_STORE', 'CLONE_BRANCH', 'REPORT_GENERATION', 'DATA_EXPORT', 'SYNC_CLEANUP', 'CUSTOM') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `result` JSON NULL,
    `status` ENUM('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING') NOT NULL DEFAULT 'PENDING',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'NORMAL',
    `progress` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `error_stack` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_attempts` INTEGER NOT NULL DEFAULT 3,
    `scheduled_for` DATETIME(3) NULL,
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `background_jobs_store_id_idx`(`store_id`),
    INDEX `background_jobs_type_idx`(`type`),
    INDEX `background_jobs_status_idx`(`status`),
    INDEX `background_jobs_priority_idx`(`priority`),
    INDEX `background_jobs_scheduled_for_idx`(`scheduled_for`),
    INDEX `background_jobs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `background_jobs` ADD CONSTRAINT `background_jobs_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `background_jobs` ADD CONSTRAINT `background_jobs_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `job_schedules` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NULL,
    `type` ENUM('DAILY_DIGEST', 'WEEKLY_SUMMARY', 'ALERT_NOTIFICATION', 'CLONE_STORE', 'CLONE_BRANCH', 'REPORT_GENERATION', 'DATA_EXPORT', 'SYNC_CLEANUP', 'CUSTOM') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `cron_expr` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Manila',
    `payload` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `created_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_schedules_store_id_idx`(`store_id`),
    INDEX `job_schedules_type_idx`(`type`),
    INDEX `job_schedules_is_active_idx`(`is_active`),
    INDEX `job_schedules_next_run_at_idx`(`next_run_at`),
    UNIQUE INDEX `job_schedules_store_id_type_name_key`(`store_id`, `type`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `job_schedules` ADD CONSTRAINT `job_schedules_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `job_schedules` ADD CONSTRAINT `job_schedules_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
