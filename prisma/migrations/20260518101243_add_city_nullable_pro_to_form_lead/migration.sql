/*
  Warnings:

  - Added the required column `city` to the `FormLead` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `formlead` DROP FOREIGN KEY `FormLead_proId_fkey`;

-- DropIndex
DROP INDEX `FormLead_proId_fkey` ON `formlead`;

-- AlterTable
ALTER TABLE `formlead` ADD COLUMN `city` VARCHAR(191) NOT NULL,
    MODIFY `proId` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `FormLead` ADD CONSTRAINT `FormLead_proId_fkey` FOREIGN KEY (`proId`) REFERENCES `Pro`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
