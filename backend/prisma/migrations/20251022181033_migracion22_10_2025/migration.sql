/*
  Warnings:

  - The values [ambos] on the enum `rol_aplica_tc` will be removed. If these variants are still used in the database, this will fail.
  - The values [paquete,minimo_mas_variable,estacional] on the enum `tipo_calculo_tc` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `tipo_servicio` on the `pago` table. All the data in the column will be lost.
  - You are about to drop the `tarifacomision` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "rol_aplica_tc_new" AS ENUM ('cliente', 'abogado');
ALTER TABLE "tarifacomision" ALTER COLUMN "rol_aplica" DROP DEFAULT;
ALTER TABLE "comision" ALTER COLUMN "rol_aplica" TYPE "rol_aplica_tc_new" USING ("rol_aplica"::text::"rol_aplica_tc_new");
ALTER TYPE "rol_aplica_tc" RENAME TO "rol_aplica_tc_old";
ALTER TYPE "rol_aplica_tc_new" RENAME TO "rol_aplica_tc";
DROP TYPE "rol_aplica_tc_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "tipo_calculo_tc_new" AS ENUM ('fijo', 'consumo_ia');
ALTER TABLE "tarifa" ALTER COLUMN "tipo_calculo" TYPE "tipo_calculo_tc_new" USING ("tipo_calculo"::text::"tipo_calculo_tc_new");
ALTER TYPE "tipo_calculo_tc" RENAME TO "tipo_calculo_tc_old";
ALTER TYPE "tipo_calculo_tc_new" RENAME TO "tipo_calculo_tc";
DROP TYPE "tipo_calculo_tc_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "tipo_detalle_pago" ADD VALUE 'descuento';
ALTER TYPE "tipo_detalle_pago" ADD VALUE 'retencion';

-- DropForeignKey
ALTER TABLE "pago" DROP CONSTRAINT "pago_estado_id_fkey";

-- DropForeignKey
ALTER TABLE "pago" DROP CONSTRAINT "pago_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "tarifacomision" DROP CONSTRAINT "tarifacomision_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "tarifacomision" DROP CONSTRAINT "tarifacomision_servicio_id_fkey";

-- DropIndex
DROP INDEX "pago_tipo_servicio_idx";

-- DropIndex
DROP INDEX "pago_voucher_archivo_id_idx";

-- AlterTable
ALTER TABLE "pago" DROP COLUMN "tipo_servicio",
ADD COLUMN     "plan_id" INTEGER,
ADD COLUMN     "servicio_id" INTEGER;

-- DropTable
DROP TABLE "tarifacomision";

-- CreateTable
CREATE TABLE "tarifa" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT,
    "valor" DECIMAL NOT NULL,
    "incluye_impuesto" BOOLEAN NOT NULL DEFAULT false,
    "tipo_calculo" "tipo_calculo_tc",
    "parametros" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "servicio_id" INTEGER,
    "plan_id" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comision" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT,
    "rol_aplica" "rol_aplica_tc" NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "servicio_id" INTEGER,
    "plan_id" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tarifa_servicio_id_idx" ON "tarifa"("servicio_id");

-- CreateIndex
CREATE INDEX "tarifa_plan_id_idx" ON "tarifa"("plan_id");

-- CreateIndex
CREATE INDEX "tarifa_vigencia_desde_vigencia_hasta_idx" ON "tarifa"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE INDEX "comision_servicio_id_idx" ON "comision"("servicio_id");

-- CreateIndex
CREATE INDEX "comision_plan_id_idx" ON "comision"("plan_id");

-- CreateIndex
CREATE INDEX "comision_rol_aplica_idx" ON "comision"("rol_aplica");

-- CreateIndex
CREATE INDEX "comision_vigencia_desde_vigencia_hasta_idx" ON "comision"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE INDEX "pago_plan_id_idx" ON "pago"("plan_id");

-- CreateIndex
CREATE INDEX "pago_servicio_id_idx" ON "pago"("servicio_id");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estadopago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
