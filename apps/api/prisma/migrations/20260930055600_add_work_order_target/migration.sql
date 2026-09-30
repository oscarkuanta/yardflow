/*
  Warnings:

  - Added the required column `targetContainerId` to the `WorkOrder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `WorkOrder` ADD COLUMN `targetContainerId` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `WorkOrder_targetContainerId_status_idx` ON `WorkOrder`(`targetContainerId`, `status`);

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_targetContainerId_fkey` FOREIGN KEY (`targetContainerId`) REFERENCES `Container`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
