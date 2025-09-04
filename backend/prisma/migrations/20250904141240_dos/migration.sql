/*
  Warnings:

  - You are about to drop the `codigoverificacion` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[pago_id,tipo]` on the table `pagodetalle` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `actualizado_el` to the `cita` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `consulta` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `documento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `estudio` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `formato` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `pago` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `perfilabogado` table without a default value. This is not possible if the table is not empty.
  - Added the required column `actualizado_el` to the `plan` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "codigoverificacion" DROP CONSTRAINT "codigoverificacion_usuario_id_fkey";

-- AlterTable
ALTER TABLE "cita" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "consulta" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "documento" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "econconfig" ALTER COLUMN "actualizado_el" DROP DEFAULT;

-- AlterTable
ALTER TABLE "estudio" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "formato" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "pago" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "perfilabogado" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "plan" ADD COLUMN     "actualizado_el" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "planservicio" ALTER COLUMN "vigencia_desde" SET DATA TYPE TIMESTAMPTZ(6),
ALTER COLUMN "vigencia_hasta" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- DropTable
DROP TABLE "codigoverificacion";

-- CreateIndex
CREATE INDEX "archivo_creado_el_idx" ON "archivo"("creado_el");

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_fecha_idx" ON "auditoria"("fecha");

-- CreateIndex
CREATE INDEX "auditoria_tabla_registro_id_idx" ON "auditoria"("tabla", "registro_id");

-- CreateIndex
CREATE INDEX "bibliotecaitem_tipo_idx" ON "bibliotecaitem"("tipo");

-- CreateIndex
CREATE INDEX "bibliotecaitem_creado_el_idx" ON "bibliotecaitem"("creado_el");

-- CreateIndex
CREATE INDEX "bitacorabusquedavh_usuario_id_idx" ON "bitacorabusquedavh"("usuario_id");

-- CreateIndex
CREATE INDEX "bitacorabusquedavh_placa_idx" ON "bitacorabusquedavh"("placa");

-- CreateIndex
CREATE INDEX "bitacorabusquedavh_buscada_el_idx" ON "bitacorabusquedavh"("buscada_el");

-- CreateIndex
CREATE INDEX "bitacorabusquedavh_usuario_id_buscada_el_idx" ON "bitacorabusquedavh"("usuario_id", "buscada_el");

-- CreateIndex
CREATE INDEX "cita_cliente_id_idx" ON "cita"("cliente_id");

-- CreateIndex
CREATE INDEX "cita_abogado_id_idx" ON "cita"("abogado_id");

-- CreateIndex
CREATE INDEX "cita_consulta_id_idx" ON "cita"("consulta_id");

-- CreateIndex
CREATE INDEX "cita_pago_id_idx" ON "cita"("pago_id");

-- CreateIndex
CREATE INDEX "cita_estado_idx" ON "cita"("estado");

-- CreateIndex
CREATE INDEX "cita_inicia_el_idx" ON "cita"("inicia_el");

-- CreateIndex
CREATE INDEX "cita_termina_el_idx" ON "cita"("termina_el");

-- CreateIndex
CREATE INDEX "cita_abogado_id_inicia_el_idx" ON "cita"("abogado_id", "inicia_el");

-- CreateIndex
CREATE INDEX "clienteabogado_abogado_id_cliente_id_idx" ON "clienteabogado"("abogado_id", "cliente_id");

-- CreateIndex
CREATE INDEX "clienteabogado_creado_el_idx" ON "clienteabogado"("creado_el");

-- CreateIndex
CREATE INDEX "consulta_cliente_id_idx" ON "consulta"("cliente_id");

-- CreateIndex
CREATE INDEX "consulta_abogado_id_idx" ON "consulta"("abogado_id");

-- CreateIndex
CREATE INDEX "consulta_especialidad_id_idx" ON "consulta"("especialidad_id");

-- CreateIndex
CREATE INDEX "consulta_pago_id_idx" ON "consulta"("pago_id");

-- CreateIndex
CREATE INDEX "consulta_estado_idx" ON "consulta"("estado");

-- CreateIndex
CREATE INDEX "consulta_creada_el_idx" ON "consulta"("creada_el");

-- CreateIndex
CREATE INDEX "consulta_tipo_idx" ON "consulta"("tipo");

-- CreateIndex
CREATE INDEX "disponibilidadabogado_abogado_id_dia_semana_idx" ON "disponibilidadabogado"("abogado_id", "dia_semana");

-- CreateIndex
CREATE INDEX "documento_pago_id_idx" ON "documento"("pago_id");

-- CreateIndex
CREATE INDEX "documento_abogado_firma_idx" ON "documento"("abogado_firma");

-- CreateIndex
CREATE INDEX "documento_estado_tramite_idx" ON "documento"("estado_tramite");

-- CreateIndex
CREATE INDEX "documento_creado_el_idx" ON "documento"("creado_el");

-- CreateIndex
CREATE INDEX "estudio_activo_idx" ON "estudio"("activo");

-- CreateIndex
CREATE INDEX "formato_especialidad_id_idx" ON "formato"("especialidad_id");

-- CreateIndex
CREATE INDEX "formato_es_premium_idx" ON "formato"("es_premium");

-- CreateIndex
CREATE INDEX "formato_institucion_idx" ON "formato"("institucion");

-- CreateIndex
CREATE INDEX "formato_tipo_documento_idx" ON "formato"("tipo_documento");

-- CreateIndex
CREATE INDEX "impuesto_activo_idx" ON "impuesto"("activo");

-- CreateIndex
CREATE INDEX "impuesto_vigencia_desde_vigencia_hasta_idx" ON "impuesto"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE INDEX "pago_usuario_id_idx" ON "pago"("usuario_id");

-- CreateIndex
CREATE INDEX "pago_creado_el_idx" ON "pago"("creado_el");

-- CreateIndex
CREATE INDEX "pago_metodo_pago_idx" ON "pago"("metodo_pago");

-- CreateIndex
CREATE INDEX "pago_tipo_servicio_idx" ON "pago"("tipo_servicio");

-- CreateIndex
CREATE INDEX "pagodetalle_pago_id_idx" ON "pagodetalle"("pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagodetalle_pago_id_tipo_key" ON "pagodetalle"("pago_id", "tipo");

-- CreateIndex
CREATE INDEX "pasarela_activo_idx" ON "pasarela"("activo");

-- CreateIndex
CREATE INDEX "pasarelametodo_pasarela_id_idx" ON "pasarelametodo"("pasarela_id");

-- CreateIndex
CREATE INDEX "pasarelametodo_metodo_pago_idx" ON "pasarelametodo"("metodo_pago");

-- CreateIndex
CREATE INDEX "perfilabogado_estudio_id_idx" ON "perfilabogado"("estudio_id");

-- CreateIndex
CREATE INDEX "perfilabogado_especialidad_id_idx" ON "perfilabogado"("especialidad_id");

-- CreateIndex
CREATE INDEX "persona_apellido_paterno_idx" ON "persona"("apellido_paterno");

-- CreateIndex
CREATE INDEX "persona_correo_idx" ON "persona"("correo");

-- CreateIndex
CREATE INDEX "plan_nombre_idx" ON "plan"("nombre");

-- CreateIndex
CREATE INDEX "planservicio_servicio_id_idx" ON "planservicio"("servicio_id");

-- CreateIndex
CREATE INDEX "planservicio_plan_id_idx" ON "planservicio"("plan_id");

-- CreateIndex
CREATE INDEX "planservicio_activo_idx" ON "planservicio"("activo");

-- CreateIndex
CREATE INDEX "servicio_activo_idx" ON "servicio"("activo");

-- CreateIndex
CREATE INDEX "servicio_codigo_idx" ON "servicio"("codigo");

-- CreateIndex
CREATE INDEX "tarifacomision_rol_aplica_idx" ON "tarifacomision"("rol_aplica");

-- CreateIndex
CREATE INDEX "tarifacomision_moneda_idx" ON "tarifacomision"("moneda");

-- CreateIndex
CREATE INDEX "tarifacomision_metodo_pago_idx" ON "tarifacomision"("metodo_pago");

-- CreateIndex
CREATE INDEX "usuario_persona_id_idx" ON "usuario"("persona_id");

-- CreateIndex
CREATE INDEX "usuario_rol_id_idx" ON "usuario"("rol_id");

-- CreateIndex
CREATE INDEX "usuario_plan_id_idx" ON "usuario"("plan_id");

-- CreateIndex
CREATE INDEX "usuario_creado_el_idx" ON "usuario"("creado_el");

-- CreateIndex
CREATE INDEX "usuario_activo_idx" ON "usuario"("activo");
