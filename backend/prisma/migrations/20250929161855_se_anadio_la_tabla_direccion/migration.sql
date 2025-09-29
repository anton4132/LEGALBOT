/*
  Warnings:

  - You are about to drop the column `direccion` on the `persona` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "persona" DROP COLUMN "direccion",
ADD COLUMN     "direccion_id" CHAR(6),
ADD COLUMN     "linea_exacta_direccion" TEXT;

-- CreateTable
CREATE TABLE "direccion" (
    "ubigeo_codigo" CHAR(6) NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,

    CONSTRAINT "direccion_pkey" PRIMARY KEY ("ubigeo_codigo")
);

-- CreateIndex
CREATE INDEX "direccion_ubigeo_codigo_idx" ON "direccion"("ubigeo_codigo");

-- CreateIndex
CREATE INDEX "direccion_departamento_provincia_distrito_idx" ON "direccion"("departamento", "provincia", "distrito");

-- AddForeignKey
ALTER TABLE "persona" ADD CONSTRAINT "persona_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direccion"("ubigeo_codigo") ON DELETE SET NULL ON UPDATE CASCADE;
