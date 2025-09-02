/*
  Warnings:

  - You are about to drop the column `habilitado` on the `planservicio` table. All the data in the column will be lost.
  - Added the required column `fecha_modificada` to the `servicio` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "planservicio" DROP CONSTRAINT "planservicio_plan_id_fkey";

-- DropForeignKey
ALTER TABLE "planservicio" DROP CONSTRAINT "planservicio_servicio_id_fkey";

-- DropIndex
DROP INDEX "planservicio_plan_id_servicio_id_key";

-- AlterTable
ALTER TABLE "planservicio" DROP COLUMN "habilitado",
ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "planId" INTEGER,
ADD COLUMN     "vigencia_desde" TIMESTAMP(3),
ADD COLUMN     "vigencia_hasta" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "servicio" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "fecha_creada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fecha_modificada" TIMESTAMPTZ(6) NOT NULL;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
