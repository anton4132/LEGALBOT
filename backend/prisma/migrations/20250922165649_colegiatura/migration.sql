/*
  Warnings:

  - A unique constraint covering the columns `[telefono]` on the table `persona` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EstadoColegiatura" AS ENUM ('VIGENTE', 'SUSPENDIDA', 'CANCELADA');

-- AlterTable
ALTER TABLE "verificacionabogado" ADD COLUMN     "colegiatura_id" INTEGER;

-- CreateTable
CREATE TABLE "colegioabogado" (
    "id" SERIAL NOT NULL,
    "region" TEXT,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "colegioabogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colegiaturaabogado" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "colegio_id" INTEGER NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "estado" "EstadoColegiatura" NOT NULL DEFAULT 'VIGENTE',
    "comprobante_url" TEXT,
    "fecha_emision" TIMESTAMPTZ(6),
    "fecha_vigencia_hasta" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "colegiaturaabogado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "colegioabogado_activo_idx" ON "colegioabogado"("activo");

-- CreateIndex
CREATE INDEX "colegioabogado_region_idx" ON "colegioabogado"("region");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_persona_id_key" ON "colegiaturaabogado"("persona_id");

-- CreateIndex
CREATE INDEX "colegiaturaabogado_colegio_id_idx" ON "colegiaturaabogado"("colegio_id");

-- CreateIndex
CREATE INDEX "colegiaturaabogado_estado_idx" ON "colegiaturaabogado"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_colegio_id_numero_key" ON "colegiaturaabogado"("colegio_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_id_persona_id_key" ON "colegiaturaabogado"("id", "persona_id");

-- CreateIndex
CREATE UNIQUE INDEX "persona_telefono_key" ON "persona"("telefono");

-- CreateIndex
CREATE INDEX "verificacionabogado_colegiatura_id_idx" ON "verificacionabogado"("colegiatura_id");

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_colegiatura_id_fkey" FOREIGN KEY ("colegiatura_id") REFERENCES "colegiaturaabogado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_colegio_id_fkey" FOREIGN KEY ("colegio_id") REFERENCES "colegioabogado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
