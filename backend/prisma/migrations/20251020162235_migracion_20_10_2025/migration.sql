/*
  Warnings:

  - You are about to drop the column `ciudad` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `pais` on the `estudio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "estudio" DROP COLUMN "ciudad",
DROP COLUMN "pais";
