-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `pos_order_id` VARCHAR(191) NOT NULL,
    `pos_device_id` VARCHAR(191) NOT NULL,
    `branch_id` VARCHAR(191) NOT NULL,
    `store_id` VARCHAR(191) NOT NULL,
    `order_number` VARCHAR(191) NOT NULL,
    `order_type` ENUM('DINE_IN', 'TAKEOUT', 'DELIVERY', 'DRIVE_THRU') NOT NULL DEFAULT 'DINE_IN',
    `status` ENUM('PENDING', 'COMPLETED', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `subtotal` DECIMAL(10, 2) NOT NULL,
    `discount_total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `tax_total` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `grand_total` DECIMAL(10, 2) NOT NULL,
    `customer_name` VARCHAR(191) NULL,
    `customer_phone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `pos_created_at` DATETIME(3) NOT NULL,
    `pos_closed_at` DATETIME(3) NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sync_batch_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `orders_branch_id_idx`(`branch_id`),
    INDEX `orders_store_id_idx`(`store_id`),
    INDEX `orders_pos_created_at_idx`(`pos_created_at`),
    INDEX `orders_sync_batch_id_idx`(`sync_batch_id`),
    INDEX `orders_status_idx`(`status`),
    UNIQUE INDEX `orders_pos_device_id_pos_order_id_key`(`pos_device_id`, `pos_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `pos_item_id` VARCHAR(191) NULL,
    `item_id` VARCHAR(191) NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `item_sku` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_price` DECIMAL(10, 2) NOT NULL,
    `notes` TEXT NULL,
    `is_voided` BOOLEAN NOT NULL DEFAULT false,
    `void_reason` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_discounts` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `order_item_id` VARCHAR(191) NULL,
    `discount_name` VARCHAR(191) NOT NULL,
    `discount_type` ENUM('PERCENTAGE', 'FIXED_AMOUNT') NOT NULL,
    `discount_scope` ENUM('ORDER', 'ITEM') NOT NULL,
    `discount_value` DECIMAL(10, 2) NOT NULL,
    `discount_amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `applied_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_discounts_order_id_idx`(`order_id`),
    INDEX `order_discounts_order_item_id_idx`(`order_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `pos_payment_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `payment_method` ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_PAYMENT', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'COMPLETED',
    `amount` DECIMAL(10, 2) NOT NULL,
    `tip_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `change_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `reference_number` VARCHAR(191) NULL,
    `processed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_order_id_idx`(`order_id`),
    INDEX `payments_payment_method_idx`(`payment_method`),
    UNIQUE INDEX `payments_order_id_pos_payment_id_key`(`order_id`, `pos_payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refunds` (
    `id` VARCHAR(191) NOT NULL,
    `pos_refund_id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `refund_method` ENUM('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'MOBILE_PAYMENT', 'GIFT_CARD', 'STORE_CREDIT', 'OTHER') NOT NULL,
    `processed_by` VARCHAR(191) NULL,
    `processed_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refunds_order_id_idx`(`order_id`),
    INDEX `refunds_payment_id_idx`(`payment_id`),
    UNIQUE INDEX `refunds_order_id_pos_refund_id_key`(`order_id`, `pos_refund_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_pos_device_id_fkey` FOREIGN KEY (`pos_device_id`) REFERENCES `pos_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_discounts` ADD CONSTRAINT `order_discounts_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_discounts` ADD CONSTRAINT `order_discounts_order_item_id_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refunds` ADD CONSTRAINT `refunds_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
