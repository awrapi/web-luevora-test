-- AlterTable: leads
-- Section 1: Identity & Contact
ALTER TABLE `leads` ADD COLUMN `first_name` VARCHAR(150) NULL;
ALTER TABLE `leads` ADD COLUMN `last_name` VARCHAR(150) NULL;
ALTER TABLE `leads` ADD COLUMN `position_title` VARCHAR(200) NULL;
ALTER TABLE `leads` ADD COLUMN `city` VARCHAR(100) NULL;
ALTER TABLE `leads` ADD COLUMN `country` VARCHAR(100) NULL;
ALTER TABLE `leads` ADD COLUMN `full_address` TEXT NULL;
ALTER TABLE `leads` ADD COLUMN `linkedin_url` VARCHAR(500) NULL;
ALTER TABLE `leads` ADD COLUMN `social_media` TEXT NULL;

-- Section 2: Profiling (Demographics & Firmographics)
ALTER TABLE `leads` ADD COLUMN `birth_date` DATE NULL;
ALTER TABLE `leads` ADD COLUMN `gender` VARCHAR(20) NULL;
ALTER TABLE `leads` ADD COLUMN `company_name` VARCHAR(255) NULL;
ALTER TABLE `leads` ADD COLUMN `industry` VARCHAR(150) NULL;
ALTER TABLE `leads` ADD COLUMN `company_size` VARCHAR(50) NULL;
ALTER TABLE `leads` ADD COLUMN `annual_revenue` VARCHAR(100) NULL;
ALTER TABLE `leads` ADD COLUMN `lead_source` VARCHAR(100) NULL;

-- Section 3: Sales / Transaction
ALTER TABLE `leads` ADD COLUMN `pipeline_status` VARCHAR(50) NULL;
ALTER TABLE `leads` ADD COLUMN `first_purchase_at` DATETIME(0) NULL;
ALTER TABLE `leads` ADD COLUMN `last_purchase_at` DATETIME(0) NULL;
ALTER TABLE `leads` ADD COLUMN `contract_renewal_at` DATETIME(0) NULL;
ALTER TABLE `leads` ADD COLUMN `total_spent` DECIMAL(14, 2) NULL DEFAULT 0;

-- Section 5: Preferences & Notes
ALTER TABLE `leads` ADD COLUMN `communication_preference` VARCHAR(50) NULL;
ALTER TABLE `leads` ADD COLUMN `personal_notes` TEXT NULL;
ALTER TABLE `leads` ADD COLUMN `nps_score` INT NULL;

-- CreateIndex: leads
CREATE INDEX `idx_pipeline` ON `leads`(`pipeline_status`);
CREATE INDEX `idx_lead_source` ON `leads`(`lead_source`);

-- CreateTable: customer_interaction_logs
CREATE TABLE `customer_interaction_logs` (
    `id` INTEGER UNSIGNED NOT NULL AUTO_INCREMENT,
    `tenant_id` INTEGER UNSIGNED NOT NULL,
    `phone` VARCHAR(50) NOT NULL,
    `interaction_type` VARCHAR(50) NOT NULL,
    `subject` VARCHAR(255) NULL,
    `detail` TEXT NULL,
    `channel` VARCHAR(50) NULL,
    `logged_by` VARCHAR(100) NULL,
    `created_at` DATETIME(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `customer_interaction_logs_tenant_id_phone_idx`(`tenant_id`, `phone`),
    INDEX `customer_interaction_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `customer_interaction_logs` ADD CONSTRAINT `customer_interaction_logs_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
