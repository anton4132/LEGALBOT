/*
  Warnings:

  - You are about to drop the column `carnet` on the `colegiaturaabogado` table. All the data in the column will be lost.
  - You are about to drop the column `duracion_minutos` on the `perfilabogado` table. All the data in the column will be lost.
  - You are about to drop the column `titulo_url` on the `verificacionabogado` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[persona_id,rol_id]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "colegiaturaabogado" DROP COLUMN "carnet",
ADD COLUMN     "carnet_archivo_id" INTEGER;

-- AlterTable
ALTER TABLE "perfilabogado" DROP COLUMN "duracion_minutos",
ADD COLUMN     "avatar_archivo_id" INTEGER,
ADD COLUMN     "rating_cantidad" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating_promedio" DECIMAL;

-- AlterTable
ALTER TABLE "verificacionabogado" DROP COLUMN "titulo_url",
ADD COLUMN     "titulo_archivo_id" INTEGER;

-- CreateTable
CREATE TABLE "resena" (
    "id" SERIAL NOT NULL,
    "cita_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comentario" TEXT,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resena_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resena_cita_id_key" ON "resena"("cita_id");

-- CreateIndex
CREATE INDEX "resena_creado_el_idx" ON "resena"("creado_el");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_rol_id_key" ON "usuario"("persona_id", "rol_id");

-- AddForeignKey
ALTER TABLE "resena" ADD CONSTRAINT "resena_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_titulo_archivo_id_fkey" FOREIGN KEY ("titulo_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_carnet_archivo_id_fkey" FOREIGN KEY ("carnet_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_avatar_archivo_id_fkey" FOREIGN KEY ("avatar_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
