/*
  Warnings:

  - You are about to drop the column `rol_id` on the `usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[persona_id,role_id]` on the table `usuario` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `role_id` to the `usuario` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."usuario_persona_id_rol_id_key";

-- DropIndex
DROP INDEX "public"."usuario_rol_id_idx";

-- AlterTable
ALTER TABLE "usuario" DROP COLUMN "rol_id",
ADD COLUMN     "role_id" SMALLINT NOT NULL;

-- DropEnum
DROP TYPE "public"."rol_usuario";

-- CreateTable
CREATE TABLE "role" (
    "id" SMALLSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_codigo_key" ON "role"("codigo");

-- CreateIndex
CREATE INDEX "usuario_role_id_idx" ON "usuario"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_role_id_key" ON "usuario"("persona_id", "role_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
