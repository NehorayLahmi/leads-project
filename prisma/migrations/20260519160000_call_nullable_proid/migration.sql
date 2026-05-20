-- DropForeignKey
ALTER TABLE `call` DROP FOREIGN KEY `Call_proId_fkey`;

-- DropIndex
DROP INDEX `Call_proId_fkey` ON `call`;

-- AlterTable
ALTER TABLE `call` MODIFY `duration` INTEGER NOT NULL DEFAULT 0,
    MODIFY `proId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `Call` ADD CONSTRAINT `Call_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `ProProfile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
