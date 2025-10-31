/*
  Warnings:

  - The values [impuestos,comision_plataforma,tarifa_ia,retencion,total_cliente,neto_abogado] on the enum `tipo_detalle_pago` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[abogado_id,cliente_id]` on the table `clienteabogado` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "tipo_detalle_pago_new" AS ENUM ('subtotal', 'impuesto', 'comision_cliente', 'comision_abogado', 'descuento', 'redondeo');
ALTER TABLE "pagodetalle" ALTER COLUMN "tipo" TYPE "tipo_detalle_pago_new" USING ("tipo"::text::"tipo_detalle_pago_new");
ALTER TYPE "tipo_detalle_pago" RENAME TO "tipo_detalle_pago_old";
ALTER TYPE "tipo_detalle_pago_new" RENAME TO "tipo_detalle_pago";
DROP TYPE "public"."tipo_detalle_pago_old";
COMMIT;

-- DropIndex
DROP INDEX "public"."clienteabogado_abogado_id_cliente_id_idx";

-- DropIndex
DROP INDEX "public"."colegiaturaabogado_id_persona_id_key";

-- DropIndex
DROP INDEX "public"."direccion_ubigeo_codigo_idx";

-- CreateIndex
CREATE UNIQUE INDEX "clienteabogado_abogado_id_cliente_id_key" ON "clienteabogado"("abogado_id", "cliente_id");
