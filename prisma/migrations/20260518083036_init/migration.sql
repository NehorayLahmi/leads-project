-- CreateTable
CREATE TABLE `Pro` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `city` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `pricePerLead` INTEGER NOT NULL,

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

-- CreateTable
CREATE TABLE `FormLead` (
    `id` VARCHAR(191) NOT NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `clientPhone` VARCHAR(191) NOT NULL,
    `issueType` VARCHAR(191) NOT NULL,
    `isSentToPro` BOOLEAN NOT NULL DEFAULT false,
    `proId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `Pro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormLead` ADD CONSTRAINT `FormLead_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `Pro`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
