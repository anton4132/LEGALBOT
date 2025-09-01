-- CreateIndex
CREATE INDEX "tarifacomision_servicio_id_plan_id_activo_idx" ON "tarifacomision"("servicio_id", "plan_id", "activo");

-- CreateIndex
CREATE INDEX "tarifacomision_vigencia_desde_vigencia_hasta_idx" ON "tarifacomision"("vigencia_desde", "vigencia_hasta");
