-- BR-STORE-013: quem vende e entrega o produto ("Vendido e entregue por").

-- AlterTable
ALTER TABLE `products` ADD COLUMN `seller_name` VARCHAR(120) NULL;
