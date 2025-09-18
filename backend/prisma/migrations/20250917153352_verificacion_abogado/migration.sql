/*
  Warnings:

  - Made the column `ruc` on table `estudio` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "EstadoVerificacion" AS ENUM ('PENDIENTE', 'OBSERVADA', 'APROBADA', 'RECHAZADA');

-- AlterTable
ALTER TABLE "estudio" ALTER COLUMN "ruc" SET NOT NULL;

-- CreateTable
CREATE TABLE "verificacionabogado" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "linkedin_url" TEXT,
    "titulo_url" TEXT,
    "estado" "EstadoVerificacion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "aprobado_el" TIMESTAMP(3),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verificacionabogado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verificacionabogado_persona_id_key" ON "verificacionabogado"("persona_id");

-- CreateIndex
CREATE INDEX "verificacionabogado_estado_idx" ON "verificacionabogado"("estado");

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;
