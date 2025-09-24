/*
  Warnings:

  - A unique constraint covering the columns `[nombre,region]` on the table `colegioabogado` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "usuario_persona_id_rol_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "colegioabogado_nombre_region_key" ON "colegioabogado"("nombre", "region");
