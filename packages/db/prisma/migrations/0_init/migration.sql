-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(120) NOT NULL,
    `password_hash` VARCHAR(256) NULL,
    `role` ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    `phone` VARCHAR(20) NULL,
    `avatar_url` VARCHAR(256) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pet_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('lost', 'found') NOT NULL DEFAULT 'lost',
    `pet_name` VARCHAR(100) NULL,
    `pet_type` ENUM('dog', 'cat', 'bird', 'other') NOT NULL,
    `pet_breed` VARCHAR(100) NULL,
    `pet_color` VARCHAR(100) NULL,
    `pet_size` ENUM('small', 'medium', 'large') NULL,
    `last_seen_location` VARCHAR(255) NOT NULL,
    `last_seen_lat` FLOAT NULL,
    `last_seen_lng` FLOAT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `contact_email` VARCHAR(120) NULL,
    `reward` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_resolved` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `pet_posts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(256) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `post_id` INTEGER NOT NULL,

    INDEX `photos_post_id_idx`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adoption_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(150) NOT NULL,
    `description` TEXT NOT NULL,
    `pet_name` VARCHAR(100) NULL,
    `pet_type` ENUM('dog', 'cat', 'bird', 'other') NOT NULL,
    `pet_breed` VARCHAR(100) NULL,
    `pet_color` VARCHAR(100) NULL,
    `pet_size` ENUM('small', 'medium', 'large') NULL,
    `is_neutered` BOOLEAN NOT NULL DEFAULT false,
    `is_vaccinated` BOOLEAN NOT NULL DEFAULT false,
    `adopter_requirements` TEXT NULL,
    `location` VARCHAR(255) NOT NULL,
    `location_lat` FLOAT NULL,
    `location_lng` FLOAT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `contact_email` VARCHAR(120) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_adopted` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NULL,
    `user_id` INTEGER NOT NULL,

    INDEX `adoption_posts_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adoption_photos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(256) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `adoption_post_id` INTEGER NOT NULL,

    INDEX `adoption_photos_adoption_post_id_idx`(`adoption_post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `partners` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `partner_type` ENUM('foster_home', 'petshop', 'vet_clinic') NOT NULL,
    `address` VARCHAR(255) NOT NULL,
    `lat` FLOAT NULL,
    `lng` FLOAT NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(120) NULL,
    `website` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pet_posts` ADD CONSTRAINT `pet_posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `photos` ADD CONSTRAINT `photos_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `pet_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_posts` ADD CONSTRAINT `adoption_posts_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adoption_photos` ADD CONSTRAINT `adoption_photos_adoption_post_id_fkey` FOREIGN KEY (`adoption_post_id`) REFERENCES `adoption_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

