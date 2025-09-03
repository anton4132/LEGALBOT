/*
  Warnings:

  - You are about to drop the column `planId` on the `planservicio` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[plan_id,servicio_id]` on the table `planservicio` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "planservicio" DROP CONSTRAINT "planservicio_planId_fkey";

-- AlterTable
ALTER TABLE "planservicio" DROP COLUMN "planId";

-- CreateIndex
CREATE UNIQUE INDEX "planservicio_plan_id_servicio_id_key" ON "planservicio"("plan_id", "servicio_id");

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
