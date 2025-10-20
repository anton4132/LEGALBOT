/*
  Warnings:

  - The values [fee_psp] on the enum `tipo_detalle_pago` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `activo` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `correo_contacto` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `linea_exacta_direccion` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `nombre_comercial` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `telefono` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the `pasarela` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `pasarelametodo` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[referencia]` on the table `pago` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[voucher_archivo_id]` on the table `pago` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[servicio_id,plan_id,rol_aplica,ambito_region,metodo_pago,moneda,vigencia_desde,vigencia_hasta,activo]` on the table `tarifacomision` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `tipo` on the `tarifacomision` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "tipo_regla_tc" AS ENUM ('precio', 'comision');

-- AlterEnum
BEGIN;
CREATE TYPE "tipo_detalle_pago_new" AS ENUM ('subtotal', 'comision_plataforma', 'tarifa_ia', 'impuestos', 'total_cliente', 'neto_abogado');
ALTER TABLE "pagodetalle" ALTER COLUMN "tipo" TYPE "tipo_detalle_pago_new" USING ("tipo"::text::"tipo_detalle_pago_new");
ALTER TYPE "tipo_detalle_pago" RENAME TO "tipo_detalle_pago_old";
ALTER TYPE "tipo_detalle_pago_new" RENAME TO "tipo_detalle_pago";
DROP TYPE "tipo_detalle_pago_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "pasarelametodo" DROP CONSTRAINT "pasarelametodo_pasarela_id_fkey";

-- DropIndex
DROP INDEX "estudio_activo_idx";

-- DropIndex
DROP INDEX "tarifacomision_servicio_id_plan_id_rol_aplica_ambito_region_key";

-- AlterTable
ALTER TABLE "estudio" DROP COLUMN "activo",
DROP COLUMN "correo_contacto",
DROP COLUMN "linea_exacta_direccion",
DROP COLUMN "nombre_comercial",
DROP COLUMN "telefono",
ADD COLUMN     "condicion" TEXT,
ADD COLUMN     "direccion_exacta" TEXT,
ADD COLUMN     "es_agente_percepcion" BOOLEAN DEFAULT false,
ADD COLUMN     "es_agente_percepcion_combustible" BOOLEAN DEFAULT false,
ADD COLUMN     "es_agente_retencion" BOOLEAN DEFAULT false,
ADD COLUMN     "es_buen_contribuyente" BOOLEAN DEFAULT false,
ADD COLUMN     "estado" TEXT,
ADD COLUMN     "nombre_o_razon_social" TEXT;

-- AlterTable
ALTER TABLE "pago" ADD COLUMN     "referencia" TEXT,
ADD COLUMN     "voucher_archivo_id" INTEGER;

-- AlterTable
ALTER TABLE "tarifacomision" DROP COLUMN "tipo",
ADD COLUMN     "tipo" "tipo_regla_tc" NOT NULL;

-- DropTable
DROP TABLE "pasarela";

-- DropTable
DROP TABLE "pasarelametodo";

-- DropEnum
DROP TYPE "quien_absorbe_psp";

-- CreateIndex
CREATE INDEX "estudio_estado_idx" ON "estudio"("estado");

-- CreateIndex
CREATE INDEX "estudio_condicion_idx" ON "estudio"("condicion");

-- CreateIndex
CREATE UNIQUE INDEX "pago_referencia_key" ON "pago"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "pago_voucher_archivo_id_key" ON "pago"("voucher_archivo_id");

-- CreateIndex
CREATE INDEX "pago_voucher_archivo_id_idx" ON "pago"("voucher_archivo_id");

-- CreateIndex
CREATE UNIQUE INDEX "tarifacomision_servicio_id_plan_id_rol_aplica_ambito_region_key" ON "tarifacomision"("servicio_id", "plan_id", "rol_aplica", "ambito_region", "metodo_pago", "moneda", "vigencia_desde", "vigencia_hasta", "activo");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_voucher_archivo_id_fkey" FOREIGN KEY ("voucher_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
