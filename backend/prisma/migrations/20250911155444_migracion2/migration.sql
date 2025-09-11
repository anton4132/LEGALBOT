/*
  Warnings:

  - A unique constraint covering the columns `[persona_id,rol_id]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_rol_id_key" ON "usuario"("persona_id", "rol_id");
