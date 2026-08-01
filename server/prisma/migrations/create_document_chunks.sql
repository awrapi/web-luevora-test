CREATE TABLE IF NOT EXISTS `document_chunks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenant_id` INT UNSIGNED NOT NULL,
  `source_type` VARCHAR(30) NOT NULL COMMENT 'package_media, kb_media, main_package, sub_item, addon',
  `source_id` INT UNSIGNED NOT NULL,
  `chunk_index` INT NOT NULL DEFAULT 0,
  `chunk_text` TEXT NOT NULL,
  `embedding` JSON NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_tenant_source` (`tenant_id`, `source_type`, `source_id`),
  CONSTRAINT `fk_docchunk_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
