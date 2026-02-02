-- CreateTable
CREATE TABLE `alerts` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `type` ENUM('ZERO_SALES_BRANCH', 'EXCESSIVE_VOID_REFUND', 'INVENTORY_ANOMALY', 'POS_SYNC_FAILURE') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `metadata` JSON NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `acknowledged_by` VARCHAR(191) NULL,
    `dismissed_at` DATETIME(3) NULL,
    `dismissed_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `alerts_store_id_idx`(`store_id`),
    INDEX `alerts_type_idx`(`type`),
    INDEX `alerts_severity_idx`(`severity`),
    INDEX `alerts_created_at_idx`(`created_at`),
    INDEX `alerts_store_id_type_created_at_idx`(`store_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert_configs` (
    `id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `alert_type` ENUM('ZERO_SALES_BRANCH', 'EXCESSIVE_VOID_REFUND', 'INVENTORY_ANOMALY', 'POS_SYNC_FAILURE') NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `thresholds` JSON NULL,
    `cooldown_minutes` INTEGER NOT NULL DEFAULT 60,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `alert_configs_store_id_alert_type_key`(`store_id`, `alert_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
