/*
  Warnings:

  - You are about to drop the column `estado` on the `colegiaturaabogado` table. All the data in the column will be lost.
  - You are about to drop the column `activo` on the `colegioabogado` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "colegiaturaabogado_estado_idx";

-- DropIndex
DROP INDEX "colegioabogado_activo_idx";

-- AlterTable
ALTER TABLE "colegiaturaabogado" DROP COLUMN "estado";

-- AlterTable
ALTER TABLE "colegioabogado" DROP COLUMN "activo";

-- DropEnum
DROP TYPE "EstadoColegiatura";
