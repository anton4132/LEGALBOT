/*
  Warnings:

  - You are about to drop the column `especialidad_id` on the `perfilabogado` table. All the data in the column will be lost.
  - You are about to drop the column `estudio_id` on the `perfilabogado` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "disponibilidadabogado" DROP CONSTRAINT "disponibilidadabogado_abogado_id_fkey";

-- DropForeignKey
ALTER TABLE "perfilabogado" DROP CONSTRAINT "perfilabogado_especialidad_id_fkey";

-- DropForeignKey
ALTER TABLE "perfilabogado" DROP CONSTRAINT "perfilabogado_estudio_id_fkey";

-- DropForeignKey
ALTER TABLE "perfilabogado" DROP CONSTRAINT "perfilabogado_usuario_id_fkey";

-- DropIndex
DROP INDEX "perfilabogado_especialidad_id_idx";

-- DropIndex
DROP INDEX "perfilabogado_estudio_id_idx";

-- AlterTable
ALTER TABLE "perfilabogado" DROP COLUMN "especialidad_id",
DROP COLUMN "estudio_id";

-- CreateTable
CREATE TABLE "abogadoestudio" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "estudio_id" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "rol_en_estudio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "abogadoestudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfilabogado_especialidad" (
    "id" SERIAL NOT NULL,
    "perfilabogado_id" INTEGER NOT NULL,
    "especialidad_id" INTEGER NOT NULL,

    CONSTRAINT "perfilabogado_especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "abogadoestudio_activo_idx" ON "abogadoestudio"("activo");

-- CreateIndex
CREATE INDEX "abogadoestudio_usuario_id_idx" ON "abogadoestudio"("usuario_id");

-- CreateIndex
CREATE INDEX "abogadoestudio_estudio_id_idx" ON "abogadoestudio"("estudio_id");

-- CreateIndex
CREATE UNIQUE INDEX "abogadoestudio_usuario_id_estudio_id_key" ON "abogadoestudio"("usuario_id", "estudio_id");

-- CreateIndex
CREATE INDEX "perfilabogado_especialidad_perfilabogado_id_idx" ON "perfilabogado_especialidad"("perfilabogado_id");

-- CreateIndex
CREATE INDEX "perfilabogado_especialidad_especialidad_id_idx" ON "perfilabogado_especialidad"("especialidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfilabogado_especialidad_perfilabogado_id_especialidad_id_key" ON "perfilabogado_especialidad"("perfilabogado_id", "especialidad_id");

-- AddForeignKey
ALTER TABLE "abogadoestudio" ADD CONSTRAINT "abogadoestudio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abogadoestudio" ADD CONSTRAINT "abogadoestudio_estudio_id_fkey" FOREIGN KEY ("estudio_id") REFERENCES "estudio"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disponibilidadabogado" ADD CONSTRAINT "disponibilidadabogado_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "perfilabogado"("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado_especialidad" ADD CONSTRAINT "perfilabogado_especialidad_perfilabogado_id_fkey" FOREIGN KEY ("perfilabogado_id") REFERENCES "perfilabogado"("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado_especialidad" ADD CONSTRAINT "perfilabogado_especialidad_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
