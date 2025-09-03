/*
  Warnings:

  - Added the required column `estudio_id` to the `perfilabogado` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "perfilabogado" ADD COLUMN     "estudio_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "estudio" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "ruc" TEXT,
    "razon_social" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "correo_contacto" TEXT,
    "telefono" TEXT,
    "direccion" TEXT,
    "ciudad" TEXT,
    "pais" TEXT,
    "logo_url" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estudio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "estudio_slug_key" ON "estudio"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "estudio_ruc_key" ON "estudio"("ruc");

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_estudio_id_fkey" FOREIGN KEY ("estudio_id") REFERENCES "estudio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
