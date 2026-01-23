/*
  Warnings:

  - A unique constraint covering the columns `[registration_code]` on the table `pos_devices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `audit_logs` MODIFY `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SYNC', 'REGISTER') NOT NULL;

-- AlterTable
ALTER TABLE `pos_devices` ADD COLUMN `is_registered` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `registered_at` DATETIME(3) NULL,
    ADD COLUMN `registration_code` VARCHAR(191) NULL,
    ADD COLUMN `registration_code_expires_at` DATETIME(3) NULL,
    MODIFY `device_identifier` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `pos_devices_registration_code_key` ON `pos_devices`(`registration_code`);

-- CreateIndex
CREATE INDEX `pos_devices_registration_code_idx` ON `pos_devices`(`registration_code`);
