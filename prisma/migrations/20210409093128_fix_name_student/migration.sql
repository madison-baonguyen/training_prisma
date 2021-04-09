/*
  Warnings:

  - You are about to drop the column `studenId` on the `testresult` table. All the data in the column will be lost.
  - Added the required column `studentId` to the `TestResult` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `testresult` DROP FOREIGN KEY `testresult_ibfk_2`;

-- AlterTable
ALTER TABLE `testresult` DROP COLUMN `studenId`,
    ADD COLUMN     `studentId` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `TestResult` ADD FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
