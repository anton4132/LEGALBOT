-- AlterTable
ALTER TABLE "estudio" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ciudad" TEXT,
ADD COLUMN     "correo_contacto" TEXT,
ADD COLUMN     "linea_exacta_direccion" TEXT,
ADD COLUMN     "nombre_comercial" TEXT,
ADD COLUMN     "pais" TEXT,
ADD COLUMN     "telefono" TEXT;
