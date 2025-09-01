/*
  Warnings:

  - A unique constraint covering the columns `[servicio_id,plan_id,rol_aplica,ambito_region,metodo_pago,vigencia_desde,vigencia_hasta,activo]` on the table `tarifacomision` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "tipo_calculo_tc" AS ENUM ('fijo', 'paquete', 'consumo_ia', 'minimo_mas_variable', 'estacional');

-- CreateEnum
CREATE TYPE "rol_aplica_tc" AS ENUM ('cliente', 'abogado', 'ambos');

-- CreateEnum
CREATE TYPE "quien_absorbe_psp" AS ENUM ('cliente', 'plataforma', 'abogado', 'mixto');

-- CreateEnum
CREATE TYPE "regla_redondeo" AS ENUM ('dos_decimales', 'a_0_05', 'entero_superior');

-- AlterTable
ALTER TABLE "tarifacomision" ADD COLUMN     "ambito_region" TEXT,
ADD COLUMN     "incluye_impuesto" BOOLEAN DEFAULT false,
ADD COLUMN     "metodo_pago" TEXT,
ADD COLUMN     "moneda" CHAR(3),
ADD COLUMN     "parametros" JSONB,
ADD COLUMN     "plan_id" INTEGER,
ADD COLUMN     "prioridad" SMALLINT,
ADD COLUMN     "rol_aplica" "rol_aplica_tc" DEFAULT 'ambos',
ADD COLUMN     "servicio_id" INTEGER,
ADD COLUMN     "tipo_calculo" "tipo_calculo_tc",
ADD COLUMN     "vigencia_desde" TIMESTAMPTZ(6),
ADD COLUMN     "vigencia_hasta" TIMESTAMPTZ(6),
ALTER COLUMN "valor" DROP NOT NULL;

-- CreateTable
CREATE TABLE "impuesto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    "incluido_en_precio" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "econconfig" (
    "id" SERIAL NOT NULL,
    "moneda_defecto" CHAR(3) NOT NULL,
    "regla_redondeo" "regla_redondeo" NOT NULL DEFAULT 'dos_decimales',
    "decimales" INTEGER NOT NULL DEFAULT 2,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "econconfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasarela" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL,
    "fijo" DECIMAL,
    "quien_absorbe" "quien_absorbe_psp" NOT NULL DEFAULT 'plataforma',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pasarela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pasarelametodo" (
    "id" SERIAL NOT NULL,
    "pasarela_id" INTEGER NOT NULL,
    "metodo_pago" TEXT NOT NULL,
    "porcentaje" DECIMAL,
    "fijo" DECIMAL,
    "quien_absorbe" "quien_absorbe_psp",
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pasarelametodo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "impuesto_codigo_key" ON "impuesto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "econconfig_activo_key" ON "econconfig"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "pasarela_nombre_key" ON "pasarela"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "pasarelametodo_pasarela_id_metodo_pago_key" ON "pasarelametodo"("pasarela_id", "metodo_pago");

-- CreateIndex
CREATE INDEX "tarifacomision_servicio_id_idx" ON "tarifacomision"("servicio_id");

-- CreateIndex
CREATE INDEX "tarifacomision_plan_id_idx" ON "tarifacomision"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "tarifacomision_servicio_id_plan_id_rol_aplica_ambito_region_key" ON "tarifacomision"("servicio_id", "plan_id", "rol_aplica", "ambito_region", "metodo_pago", "vigencia_desde", "vigencia_hasta", "activo");

-- AddForeignKey
ALTER TABLE "tarifacomision" ADD CONSTRAINT "tarifacomision_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tarifacomision" ADD CONSTRAINT "tarifacomision_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pasarelametodo" ADD CONSTRAINT "pasarelametodo_pasarela_id_fkey" FOREIGN KEY ("pasarela_id") REFERENCES "pasarela"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
