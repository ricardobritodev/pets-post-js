-- Etapa 7b (specs/api/store.md): produtos da vitrine dos parceiros e as fotos deles.
-- Tabelas novas da v2. Preço em centavos (BR-STORE-003); parceiro com produtos não pode ser excluído (BR-STORE-008).

-- CreateTable
CREATE TABLE `products` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `category` ENUM('food', 'treats', 'toys', 'hygiene', 'health', 'accessories', 'beds') NOT NULL,
    `pet_type` ENUM('dog', 'cat', 'bird', 'other') NULL,
    `price_cents` INTEGER NOT NULL,
    `promo_price_cents` INTEGER NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL,
    `partner_id` INTEGER NOT NULL,

    INDEX `products_partner_id_idx`(`partner_id`),
    INDEX `products_is_active_category_idx`(`is_active`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(256) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `product_id` INTEGER NOT NULL,

    INDEX `product_photos_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_partner_id_fkey` FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_photos` ADD CONSTRAINT `product_photos_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

