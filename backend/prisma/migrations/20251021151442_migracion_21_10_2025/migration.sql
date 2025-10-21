-- CreateEnum
CREATE TYPE "EstadoRecuperacionClave" AS ENUM ('PENDIENTE', 'VERIFICADO', 'COMPLETADO', 'EXPIRADO');

-- CreateTable
CREATE TABLE "recuperacionclave" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo" TEXT NOT NULL,
    "expiracion" TIMESTAMPTZ(6) NOT NULL,
    "estado" "EstadoRecuperacionClave" NOT NULL DEFAULT 'PENDIENTE',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "recuperacionclave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recuperacionclave_persona_id_idx" ON "recuperacionclave"("persona_id");

-- CreateIndex
CREATE INDEX "recuperacionclave_usuario_id_idx" ON "recuperacionclave"("usuario_id");

-- CreateIndex
CREATE INDEX "recuperacionclave_by_user_status_exp_idx" ON "recuperacionclave"("usuario_id", "estado", "expiracion");

-- AddForeignKey
ALTER TABLE "recuperacionclave" ADD CONSTRAINT "recuperacionclave_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuperacionclave" ADD CONSTRAINT "recuperacionclave_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
