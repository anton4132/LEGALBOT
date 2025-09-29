/*
  Warnings:

  - You are about to drop the column `ciudad` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `direccion` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `pais` on the `estudio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "estudio" DROP COLUMN "ciudad",
DROP COLUMN "direccion",
DROP COLUMN "pais",
ADD COLUMN     "direccion_id" CHAR(6),
ADD COLUMN     "linea_exacta_direccion" TEXT;

-- AddForeignKey
ALTER TABLE "estudio" ADD CONSTRAINT "estudio_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direccion"("ubigeo_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
