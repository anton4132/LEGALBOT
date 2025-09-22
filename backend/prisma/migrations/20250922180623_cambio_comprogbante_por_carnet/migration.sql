/*
  Warnings:

  - You are about to drop the column `comprobante_url` on the `colegiaturaabogado` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "colegiaturaabogado" DROP COLUMN "comprobante_url",
ADD COLUMN     "carnet" TEXT;
