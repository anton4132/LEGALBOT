/*
  Warnings:

  - You are about to drop the column `logo_url` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `razon_social` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `estudio` table. All the data in the column will be lost.
  - You are about to drop the column `latitud` on the `perfilabogado` table. All the data in the column will be lost.
  - You are about to drop the column `longitud` on the `perfilabogado` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "estudio_slug_key";

-- AlterTable
ALTER TABLE "estudio" DROP COLUMN "logo_url",
DROP COLUMN "razon_social",
DROP COLUMN "slug";

-- AlterTable
ALTER TABLE "perfilabogado" DROP COLUMN "latitud",
DROP COLUMN "longitud",
ADD COLUMN     "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
