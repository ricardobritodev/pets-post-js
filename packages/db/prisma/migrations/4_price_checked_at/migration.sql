-- BR-STORE-011: data em que o preço do produto foi conferido.

-- AlterTable
ALTER TABLE `products` ADD COLUMN `price_checked_at` DATETIME(0) NULL;


-- Produtos que já existiam: a data conhecida é a da última alteração.
UPDATE `products` SET `price_checked_at` = COALESCE(`updated_at`, `created_at`) WHERE `price_checked_at` IS NULL;
