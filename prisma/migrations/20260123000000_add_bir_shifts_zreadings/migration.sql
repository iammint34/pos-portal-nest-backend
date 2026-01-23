-- Add BIR fields to stores table
ALTER TABLE `stores` ADD COLUMN `registered_name` VARCHAR(255) NULL;
ALTER TABLE `stores` ADD COLUMN `registered_address` TEXT NULL;
ALTER TABLE `stores` ADD COLUMN `vat_tin` VARCHAR(20) NULL;
ALTER TABLE `stores` ADD COLUMN `is_vat_registered` BOOLEAN NOT NULL DEFAULT true;

-- Add BIR fields to branches table
ALTER TABLE `branches` ADD COLUMN `ptu_no` VARCHAR(50) NULL;
ALTER TABLE `branches` ADD COLUMN `ptu_date_issued` VARCHAR(50) NULL;
ALTER TABLE `branches` ADD COLUMN `ptu_valid_until` VARCHAR(50) NULL;
ALTER TABLE `branches` ADD COLUMN `accreditation_no` VARCHAR(50) NULL;

-- Add BIR fields to pos_devices table
ALTER TABLE `pos_devices` ADD COLUMN `min` VARCHAR(50) NULL;
ALTER TABLE `pos_devices` ADD COLUMN `serial_number` VARCHAR(50) NULL;
ALTER TABLE `pos_devices` ADD COLUMN `permit_number` VARCHAR(50) NULL;

-- Add BIR and shift fields to orders table
ALTER TABLE `orders` ADD COLUMN `shift_id` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `operator_id` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `pos_operator_id` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `invoice_number` VARCHAR(191) NULL;
ALTER TABLE `orders` ADD COLUMN `vatable_sales` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `vat_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `vat_exempt_sales` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `zero_rated_sales` DECIMAL(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN `customer_tin` VARCHAR(20) NULL;
ALTER TABLE `orders` ADD COLUMN `customer_business_name` VARCHAR(255) NULL;
ALTER TABLE `orders` ADD COLUMN `customer_business_address` TEXT NULL;

-- Create index on orders for shift_id and invoice_number
CREATE INDEX `orders_shift_id_idx` ON `orders`(`shift_id`);
CREATE INDEX `orders_invoice_number_idx` ON `orders`(`invoice_number`);

-- Create ShiftStatus enum type (MySQL uses ENUM inline)
-- Create shifts table
CREATE TABLE `shifts` (
    `id` VARCHAR(191) NOT NULL,
    `pos_shift_id` VARCHAR(191) NOT NULL,
    `pos_device_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `operator_id` VARCHAR(191) NULL,
    `pos_operator_id` VARCHAR(191) NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `opened_at` DATETIME(3) NOT NULL,
    `closed_at` DATETIME(3) NULL,
    `opening_cash` DECIMAL(10, 2) NOT NULL,
    `closing_cash` DECIMAL(10, 2) NULL,
    `expected_cash` DECIMAL(10, 2) NULL,
    `variance` DECIMAL(10, 2) NULL,
    `notes` TEXT NULL,
    `order_count` INTEGER NOT NULL DEFAULT 0,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `shifts_pos_device_id_pos_shift_id_key`(`pos_device_id`, `pos_shift_id`),
    INDEX `shifts_branch_id_idx`(`branch_id`),
    INDEX `shifts_store_id_idx`(`store_id`),
    INDEX `shifts_operator_id_idx`(`operator_id`),
    INDEX `shifts_pos_operator_id_idx`(`pos_operator_id`),
    INDEX `shifts_status_idx`(`status`),
    INDEX `shifts_opened_at_idx`(`opened_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create CashMovementType enum and cash_movements table
CREATE TABLE `cash_movements` (
    `id` VARCHAR(191) NOT NULL,
    `shift_id` VARCHAR(191) NOT NULL,
    `movement_type` ENUM('OPENING_FLOAT', 'CASH_SALE', 'CHANGE_GIVEN', 'TIP_CASH', 'PAID_OUT', 'DROP', 'CASH_IN', 'REFUND', 'CLOSING_COUNT') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reference_type` VARCHAR(191) NULL,
    `reference_id` VARCHAR(191) NULL,
    `reason` TEXT NULL,
    `performed_by` VARCHAR(191) NOT NULL,
    `performed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `cash_movements_shift_id_idx`(`shift_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create z_readings table
CREATE TABLE `z_readings` (
    `id` VARCHAR(191) NOT NULL,
    `pos_device_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `pos_z_reading_id` VARCHAR(191) NULL,
    `z_counter_no` INTEGER NOT NULL,
    `beginning_invoice_no` VARCHAR(20) NOT NULL,
    `ending_invoice_no` VARCHAR(20) NOT NULL,
    `beginning_grand_total` DECIMAL(15, 2) NOT NULL,
    `ending_grand_total` DECIMAL(15, 2) NOT NULL,
    `gross_sales` DECIMAL(15, 2) NOT NULL,
    `net_sales` DECIMAL(15, 2) NOT NULL,
    `vatable_sales` DECIMAL(15, 2) NOT NULL,
    `vat_amount` DECIMAL(15, 2) NOT NULL,
    `vat_exempt_sales` DECIMAL(15, 2) NOT NULL,
    `zero_rated_sales` DECIMAL(15, 2) NOT NULL,
    `discount_total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `refund_total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `void_total` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `transaction_count` INTEGER NOT NULL,
    `void_count` INTEGER NOT NULL DEFAULT 0,
    `refund_count` INTEGER NOT NULL DEFAULT 0,
    `closed_by` VARCHAR(191) NOT NULL,
    `closed_at` DATETIME(3) NOT NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `z_readings_pos_device_id_pos_z_reading_id_key`(`pos_device_id`, `pos_z_reading_id`),
    UNIQUE INDEX `z_readings_pos_device_id_z_counter_no_key`(`pos_device_id`, `z_counter_no`),
    INDEX `z_readings_branch_id_idx`(`branch_id`),
    INDEX `z_readings_store_id_idx`(`store_id`),
    INDEX `z_readings_closed_at_idx`(`closed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create electronic_journal table
CREATE TABLE `electronic_journal` (
    `id` VARCHAR(191) NOT NULL,
    `pos_device_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NULL,
    `invoice_number` VARCHAR(20) NOT NULL,
    `transaction_type` VARCHAR(20) NOT NULL,
    `receipt_content` TEXT NOT NULL,
    `receipt_hash` VARCHAR(64) NOT NULL,
    `grand_total` DECIMAL(10, 2) NOT NULL,
    `vat_amount` DECIMAL(10, 2) NOT NULL,
    `operator_id` VARCHAR(191) NOT NULL,
    `operator_name` VARCHAR(100) NOT NULL,
    `transaction_date` DATETIME(3) NOT NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `electronic_journal_pos_device_id_idx`(`pos_device_id`),
    INDEX `electronic_journal_branch_id_idx`(`branch_id`),
    INDEX `electronic_journal_store_id_idx`(`store_id`),
    INDEX `electronic_journal_invoice_number_idx`(`invoice_number`),
    INDEX `electronic_journal_transaction_date_idx`(`transaction_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign keys
ALTER TABLE `orders` ADD CONSTRAINT `orders_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `shifts` ADD CONSTRAINT `shifts_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_pos_operator_id_fkey` FOREIGN KEY (`pos_operator_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `cash_movements` ADD CONSTRAINT `cash_movements_shift_id_fkey` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `z_readings` ADD CONSTRAINT `z_readings_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
