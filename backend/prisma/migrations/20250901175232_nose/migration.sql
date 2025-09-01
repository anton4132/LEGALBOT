/*
  Warnings:

  - Made the column `rol_aplica` on table `tarifacomision` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "econconfig_activo_key";

-- AlterTable
ALTER TABLE "tarifacomision" ALTER COLUMN "rol_aplica" SET NOT NULL;
