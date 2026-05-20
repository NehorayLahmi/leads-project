-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'PRO') NOT NULL DEFAULT 'PRO',
    `resetToken` VARCHAR(191) NULL,
    `resetTokenExpiry` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `profession` VARCHAR(191) NOT NULL,
    `pricePerLead` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProProfile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `clientPhone` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `profession` VARCHAR(191) NOT NULL,
    `status` ENUM('NEW', 'ASSIGNED', 'NOTIFIED', 'CONVERTED') NOT NULL DEFAULT 'NEW',
    `proId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LandingPage` (
    `id` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `profession` VARCHAR(191) NOT NULL,
    `twilioNumber` VARCHAR(191) NOT NULL,
    `mainTitle` VARCHAR(191) NOT NULL,
    `subTitle` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `heroImage` VARCHAR(191) NOT NULL,
    `profileImage` VARCHAR(191) NULL,
    `galleryImages` TEXT NOT NULL,
    `proId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LandingPage_city_profession_key`(`city`, `profession`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Call` (
    `id` VARCHAR(191) NOT NULL,
    `callerPhone` VARCHAR(191) NOT NULL,
    `destinationPhone` VARCHAR(191) NOT NULL,
    `duration` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `recordingUrl` VARCHAR(191) NULL,
    `proId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProProfile` ADD CONSTRAINT `ProProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `ProProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LandingPage` ADD CONSTRAINT `LandingPage_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `ProProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `ProProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
