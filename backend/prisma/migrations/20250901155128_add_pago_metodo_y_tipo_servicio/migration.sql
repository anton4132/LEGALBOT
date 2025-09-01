/*
  Warnings:

  - The values [cerrrada] on the enum `est_consulta` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `area_detectada` on the `consulta` table. All the data in the column will be lost.
  - You are about to drop the column `especialidad` on the `perfilabogado` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "tipo_consulta" AS ENUM ('texto', 'audio');

-- CreateEnum
CREATE TYPE "tipo_detalle_pago" AS ENUM ('subtotal', 'comision_plataforma', 'tarifa_ia', 'fee_psp', 'total_cliente', 'neto_abogado');

-- CreateEnum
CREATE TYPE "resp_consulta" AS ENUM ('abogado', 'documento');

-- CreateEnum
CREATE TYPE "est_doc_tramite" AS ENUM ('pendiente', 'enviado', 'recibido', 'observado');

-- AlterEnum
BEGIN;
CREATE TYPE "est_consulta_new" AS ENUM ('pendiente', 'respondida', 'cerrada');
ALTER TABLE "consulta" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "consulta" ALTER COLUMN "estado" TYPE "est_consulta_new" USING ("estado"::text::"est_consulta_new");
ALTER TYPE "est_consulta" RENAME TO "est_consulta_old";
ALTER TYPE "est_consulta_new" RENAME TO "est_consulta";
DROP TYPE "est_consulta_old";
ALTER TABLE "consulta" ALTER COLUMN "estado" SET DEFAULT 'pendiente';
COMMIT;

-- AlterTable
ALTER TABLE "consulta" DROP COLUMN "area_detectada",
ADD COLUMN     "audio_url" TEXT,
ADD COLUMN     "documento_id" INTEGER,
ADD COLUMN     "especialidad_id" INTEGER,
ADD COLUMN     "opcion_respuesta" "resp_consulta",
ADD COLUMN     "pago_id" INTEGER,
ADD COLUMN     "tipo" "tipo_consulta" NOT NULL DEFAULT 'texto';

-- AlterTable
ALTER TABLE "documento" ADD COLUMN     "enviado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "enviado_el" TIMESTAMPTZ(6),
ADD COLUMN     "estado_tramite" "est_doc_tramite" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "firma_url" TEXT,
ADD COLUMN     "formato_id" INTEGER,
ADD COLUMN     "institucion" TEXT,
ADD COLUMN     "pago_id" INTEGER,
ADD COLUMN     "tamano" INTEGER;

-- AlterTable
ALTER TABLE "pago" ADD COLUMN     "metodo_pago" TEXT,
ADD COLUMN     "tipo_servicio" TEXT;

-- AlterTable
ALTER TABLE "perfilabogado" DROP COLUMN "especialidad",
ADD COLUMN     "especialidad_id" INTEGER,
ADD COLUMN     "latitud" DOUBLE PRECISION,
ADD COLUMN     "longitud" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "almacenamiento_usado" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "plan_id" INTEGER;

-- CreateTable
CREATE TABLE "codigoverificacion" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "motivo" TEXT,
    "enviado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_el" TIMESTAMPTZ(6) NOT NULL,
    "usado" BOOLEAN NOT NULL DEFAULT false,
    "usado_el" TIMESTAMPTZ(6),

    CONSTRAINT "codigoverificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archivo" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "ruta" TEXT NOT NULL,
    "tamano" INTEGER NOT NULL,
    "tipo" TEXT,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagodetalle" (
    "id" SERIAL NOT NULL,
    "pago_id" INTEGER NOT NULL,
    "tipo" "tipo_detalle_pago" NOT NULL,
    "monto" DECIMAL NOT NULL,

    CONSTRAINT "pagodetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifacomision" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "valor" DECIMAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tarifacomision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenamiento_maximo" INTEGER,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planservicio" (
    "id" SERIAL NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "habilitado" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "planservicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "formato" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "especialidad_id" INTEGER,
    "institucion" TEXT,
    "tipo_documento" TEXT,
    "ruta_archivo" TEXT NOT NULL,
    "es_premium" BOOLEAN NOT NULL DEFAULT false,
    "costo" DECIMAL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bibliotecaitem" (
    "id" SERIAL NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "tipo" TEXT NOT NULL,
    "ruta_archivo" TEXT NOT NULL,
    "costo" DECIMAL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bibliotecaitem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigoverificacion_usuario_id_idx" ON "codigoverificacion"("usuario_id");

-- CreateIndex
CREATE INDEX "archivo_usuario_id_idx" ON "archivo"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "especialidad_nombre_key" ON "especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tarifacomision_codigo_key" ON "tarifacomision"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "servicio_codigo_key" ON "servicio"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "planservicio_plan_id_servicio_id_key" ON "planservicio"("plan_id", "servicio_id");

-- CreateIndex
CREATE INDEX "documento_propietario_id_idx" ON "documento"("propietario_id");

-- CreateIndex
CREATE INDEX "pago_estado_id_idx" ON "pago"("estado_id");

-- AddForeignKey
ALTER TABLE "codigoverificacion" ADD CONSTRAINT "codigoverificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_formato_id_fkey" FOREIGN KEY ("formato_id") REFERENCES "formato"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "archivo" ADD CONSTRAINT "archivo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pagodetalle" ADD CONSTRAINT "pagodetalle_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formato" ADD CONSTRAINT "formato_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
