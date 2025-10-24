-- CreateEnum
CREATE TYPE "est_cita" AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');

-- CreateEnum
CREATE TYPE "est_consulta" AS ENUM ('pendiente', 'respondida', 'cerrada');

-- CreateEnum
CREATE TYPE "resp_consulta" AS ENUM ('abogado', 'IA');

-- CreateEnum
CREATE TYPE "tipo_consulta" AS ENUM ('texto', 'audio');

-- CreateEnum
CREATE TYPE "est_doc_tramite" AS ENUM ('pendiente', 'enviado', 'recibido', 'observado');

-- CreateEnum
CREATE TYPE "tipo_detalle_pago" AS ENUM ('subtotal', 'descuento', 'impuestos', 'comision_plataforma', 'tarifa_ia', 'retencion', 'total_cliente', 'neto_abogado');

-- CreateEnum
CREATE TYPE "tipo_calculo_tc" AS ENUM ('fijo', 'consumo_ia');

-- CreateEnum
CREATE TYPE "rol_aplica_tc" AS ENUM ('cliente', 'abogado');

-- CreateEnum
CREATE TYPE "tipo_regla_tc" AS ENUM ('precio', 'comision');

-- CreateEnum
CREATE TYPE "regla_redondeo" AS ENUM ('dos_decimales', 'a_0_05', 'entero_superior');

-- CreateEnum
CREATE TYPE "EstadoVerificacion" AS ENUM ('PENDIENTE', 'OBSERVADA', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "EstadoRecuperacionClave" AS ENUM ('PENDIENTE', 'VERIFICADO', 'COMPLETADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ADMIN', 'ABOGADO', 'CLIENTE');

-- CreateTable
CREATE TABLE "auditoria" (
    "id" SERIAL NOT NULL,
    "tabla" TEXT NOT NULL,
    "registro_id" INTEGER NOT NULL,
    "usuario_id" INTEGER,
    "operacion" TEXT NOT NULL,
    "datos_previos" JSONB,
    "datos_nuevos" JSONB,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bitacorabusquedavh" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "placa" VARCHAR(10) NOT NULL,
    "tipo_busqueda" TEXT,
    "precio" DECIMAL,
    "respuesta_api" JSONB,
    "buscada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bitacorabusquedavh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "abogado_id" INTEGER NOT NULL,
    "consulta_id" INTEGER NOT NULL,
    "pago_id" INTEGER,
    "inicia_el" TIMESTAMPTZ(6) NOT NULL,
    "termina_el" TIMESTAMPTZ(6) NOT NULL,
    "estado" "est_cita" NOT NULL DEFAULT 'pendiente',
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resena" (
    "id" SERIAL NOT NULL,
    "cita_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comentario" TEXT,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "resena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clienteabogado" (
    "id" SERIAL NOT NULL,
    "abogado_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas_privadas" TEXT,

    CONSTRAINT "clienteabogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consulta" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "abogado_id" INTEGER NOT NULL,
    "pregunta" TEXT NOT NULL,
    "especialidad_id" INTEGER,
    "tipo" "tipo_consulta" NOT NULL DEFAULT 'texto',
    "audio_url" TEXT,
    "opcion_respuesta" "resp_consulta",
    "documento_id" INTEGER,
    "pago_id" INTEGER,
    "estado" "est_consulta" NOT NULL DEFAULT 'pendiente',
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consulta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" SERIAL NOT NULL,
    "propietario_id" INTEGER NOT NULL,
    "tipo_documento" TEXT,
    "ruta_archivo" TEXT NOT NULL,
    "generado_ai" BOOLEAN NOT NULL DEFAULT false,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "firma_url" TEXT,
    "abogado_firma" INTEGER,
    "formato_id" INTEGER,
    "institucion" TEXT,
    "enviado" BOOLEAN NOT NULL DEFAULT false,
    "estado_tramite" "est_doc_tramite" NOT NULL DEFAULT 'pendiente',
    "enviado_el" TIMESTAMPTZ(6),
    "pago_id" INTEGER,
    "tamano" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "estadopago" (
    "id" SMALLSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "estadopago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pago" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "monto" DECIMAL NOT NULL,
    "moneda" CHAR(3) NOT NULL,
    "concepto" TEXT,
    "proveedor_txn" TEXT,
    "referencia" TEXT,
    "voucher_archivo_id" INTEGER,
    "estado_id" SMALLINT NOT NULL,
    "metodo_pago" TEXT,
    "servicio_id" INTEGER,
    "plan_id" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "tarifa" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT,
    "valor" DECIMAL NOT NULL,
    "incluye_impuesto" BOOLEAN NOT NULL DEFAULT false,
    "tipo_calculo" "tipo_calculo_tc",
    "parametros" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "servicio_id" INTEGER,
    "plan_id" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tarifa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comision" (
    "id" SERIAL NOT NULL,
    "descripcion" TEXT,
    "rol_aplica" "rol_aplica_tc" NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "servicio_id" INTEGER,
    "plan_id" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "comision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impuesto" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "econconfig" (
    "id" SERIAL NOT NULL,
    "moneda_defecto" CHAR(3) NOT NULL,
    "regla_redondeo" "regla_redondeo" NOT NULL DEFAULT 'dos_decimales',
    "decimales" INTEGER NOT NULL DEFAULT 2,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "econconfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificacionabogado" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "linkedin_url" TEXT,
    "titulo_archivo_id" INTEGER,
    "estado" "EstadoVerificacion" NOT NULL DEFAULT 'PENDIENTE',
    "observaciones" TEXT,
    "aprobado_el" TIMESTAMP(3),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,
    "colegiatura_id" INTEGER,

    CONSTRAINT "verificacionabogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colegioabogado" (
    "id" SERIAL NOT NULL,
    "region" TEXT,
    "nombre" TEXT NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "colegioabogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colegiaturaabogado" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "colegio_id" INTEGER NOT NULL,
    "carnet_archivo_id" INTEGER,
    "numero" VARCHAR(30) NOT NULL,
    "fecha_emision" TIMESTAMPTZ(6),
    "fecha_vigencia_hasta" TIMESTAMPTZ(6),
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "colegiaturaabogado_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "persona" (
    "id" SERIAL NOT NULL,
    "dni" CHAR(8) NOT NULL,
    "telefono" VARCHAR(15),
    "primer_nombre" VARCHAR(100) NOT NULL,
    "segundo_nombre" VARCHAR(100),
    "apellido_paterno" VARCHAR(100) NOT NULL,
    "apellido_materno" VARCHAR(100),
    "correo" TEXT NOT NULL,
    "direccion_id" CHAR(6),
    "linea_exacta_direccion" TEXT,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direccion" (
    "ubigeo_codigo" CHAR(6) NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,

    CONSTRAINT "direccion_pkey" PRIMARY KEY ("ubigeo_codigo")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "rol_id" "rol_usuario" NOT NULL,
    "clave" TEXT NOT NULL,
    "telefono_verificado" BOOLEAN NOT NULL DEFAULT false,
    "plan_id" INTEGER,
    "almacenamiento_usado" INTEGER NOT NULL DEFAULT 0,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disponibilidadabogado" (
    "id" SERIAL NOT NULL,
    "abogado_id" INTEGER NOT NULL,
    "dia_semana" SMALLINT NOT NULL,
    "hora_inicio" TIME(6) NOT NULL,
    "hora_fin" TIME(6) NOT NULL,

    CONSTRAINT "disponibilidadabogado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfilabogado_especialidad" (
    "id" SERIAL NOT NULL,
    "perfilabogado_id" INTEGER NOT NULL,
    "especialidad_id" INTEGER NOT NULL,

    CONSTRAINT "perfilabogado_especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "especialidad" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "especialidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estudio" (
    "id" SERIAL NOT NULL,
    "ruc" TEXT NOT NULL,
    "nombre_comercial" TEXT,
    "nombre_o_razon_social" TEXT,
    "correo_contacto" TEXT,
    "telefono" TEXT,
    "direccion_id" CHAR(6),
    "direccion_exacta" TEXT,
    "linea_exacta_direccion" TEXT,
    "estado" TEXT,
    "condicion" TEXT,
    "es_agente_retencion" BOOLEAN DEFAULT false,
    "es_agente_percepcion" BOOLEAN DEFAULT false,
    "es_agente_percepcion_combustible" BOOLEAN DEFAULT false,
    "es_buen_contribuyente" BOOLEAN DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "estudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abogadoestudio" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "estudio_id" INTEGER NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "rol_en_estudio" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "abogadoestudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfilabogado" (
    "usuario_id" INTEGER NOT NULL,
    "avatar_archivo_id" INTEGER,
    "tarifa_base" DECIMAL,
    "direccion_atencion" TEXT,
    "bio" TEXT,
    "rating_promedio" DECIMAL,
    "rating_cantidad" INTEGER NOT NULL DEFAULT 0,
    "place_id_api" TEXT,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "perfilabogado_pkey" PRIMARY KEY ("usuario_id")
);

-- CreateTable
CREATE TABLE "plan" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "almacenamiento_maximo" INTEGER,
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicio" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_creada" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_modificada" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planservicio" (
    "id" SERIAL NOT NULL,
    "servicio_id" INTEGER NOT NULL,
    "plan_id" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "vigencia_desde" TIMESTAMPTZ(6),
    "vigencia_hasta" TIMESTAMPTZ(6),

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
    "actualizado_el" TIMESTAMPTZ(6) NOT NULL,

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
CREATE INDEX "auditoria_usuario_id_idx" ON "auditoria"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_fecha_idx" ON "auditoria"("fecha");

-- CreateIndex
CREATE INDEX "auditoria_tabla_registro_id_idx" ON "auditoria"("tabla", "registro_id");

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
CREATE UNIQUE INDEX "resena_cita_id_key" ON "resena"("cita_id");

-- CreateIndex
CREATE INDEX "resena_creado_el_idx" ON "resena"("creado_el");

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
CREATE INDEX "documento_propietario_id_idx" ON "documento"("propietario_id");

-- CreateIndex
CREATE INDEX "documento_pago_id_idx" ON "documento"("pago_id");

-- CreateIndex
CREATE INDEX "documento_abogado_firma_idx" ON "documento"("abogado_firma");

-- CreateIndex
CREATE INDEX "documento_estado_tramite_idx" ON "documento"("estado_tramite");

-- CreateIndex
CREATE INDEX "documento_creado_el_idx" ON "documento"("creado_el");

-- CreateIndex
CREATE INDEX "archivo_usuario_id_idx" ON "archivo"("usuario_id");

-- CreateIndex
CREATE INDEX "archivo_creado_el_idx" ON "archivo"("creado_el");

-- CreateIndex
CREATE UNIQUE INDEX "estadopago_codigo_key" ON "estadopago"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "pago_referencia_key" ON "pago"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "pago_voucher_archivo_id_key" ON "pago"("voucher_archivo_id");

-- CreateIndex
CREATE INDEX "pago_estado_id_idx" ON "pago"("estado_id");

-- CreateIndex
CREATE INDEX "pago_usuario_id_idx" ON "pago"("usuario_id");

-- CreateIndex
CREATE INDEX "pago_creado_el_idx" ON "pago"("creado_el");

-- CreateIndex
CREATE INDEX "pago_metodo_pago_idx" ON "pago"("metodo_pago");

-- CreateIndex
CREATE INDEX "pago_plan_id_idx" ON "pago"("plan_id");

-- CreateIndex
CREATE INDEX "pago_servicio_id_idx" ON "pago"("servicio_id");

-- CreateIndex
CREATE INDEX "pagodetalle_pago_id_idx" ON "pagodetalle"("pago_id");

-- CreateIndex
CREATE UNIQUE INDEX "pagodetalle_pago_id_tipo_key" ON "pagodetalle"("pago_id", "tipo");

-- CreateIndex
CREATE INDEX "tarifa_servicio_id_idx" ON "tarifa"("servicio_id");

-- CreateIndex
CREATE INDEX "tarifa_plan_id_idx" ON "tarifa"("plan_id");

-- CreateIndex
CREATE INDEX "tarifa_vigencia_desde_vigencia_hasta_idx" ON "tarifa"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE INDEX "comision_servicio_id_idx" ON "comision"("servicio_id");

-- CreateIndex
CREATE INDEX "comision_plan_id_idx" ON "comision"("plan_id");

-- CreateIndex
CREATE INDEX "comision_rol_aplica_idx" ON "comision"("rol_aplica");

-- CreateIndex
CREATE INDEX "comision_vigencia_desde_vigencia_hasta_idx" ON "comision"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "impuesto_codigo_key" ON "impuesto"("codigo");

-- CreateIndex
CREATE INDEX "impuesto_activo_idx" ON "impuesto"("activo");

-- CreateIndex
CREATE INDEX "impuesto_vigencia_desde_vigencia_hasta_idx" ON "impuesto"("vigencia_desde", "vigencia_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "verificacionabogado_persona_id_key" ON "verificacionabogado"("persona_id");

-- CreateIndex
CREATE INDEX "verificacionabogado_colegiatura_id_idx" ON "verificacionabogado"("colegiatura_id");

-- CreateIndex
CREATE INDEX "verificacionabogado_estado_idx" ON "verificacionabogado"("estado");

-- CreateIndex
CREATE INDEX "colegioabogado_region_idx" ON "colegioabogado"("region");

-- CreateIndex
CREATE UNIQUE INDEX "colegioabogado_nombre_region_key" ON "colegioabogado"("nombre", "region");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_persona_id_key" ON "colegiaturaabogado"("persona_id");

-- CreateIndex
CREATE INDEX "colegiaturaabogado_colegio_id_idx" ON "colegiaturaabogado"("colegio_id");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_colegio_id_numero_key" ON "colegiaturaabogado"("colegio_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "colegiaturaabogado_id_persona_id_key" ON "colegiaturaabogado"("id", "persona_id");

-- CreateIndex
CREATE INDEX "recuperacionclave_persona_id_idx" ON "recuperacionclave"("persona_id");

-- CreateIndex
CREATE INDEX "recuperacionclave_usuario_id_idx" ON "recuperacionclave"("usuario_id");

-- CreateIndex
CREATE INDEX "recuperacionclave_by_user_status_exp_idx" ON "recuperacionclave"("usuario_id", "estado", "expiracion");

-- CreateIndex
CREATE UNIQUE INDEX "persona_dni_key" ON "persona"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "persona_telefono_key" ON "persona"("telefono");

-- CreateIndex
CREATE UNIQUE INDEX "persona_correo_key" ON "persona"("correo");

-- CreateIndex
CREATE INDEX "persona_apellido_paterno_idx" ON "persona"("apellido_paterno");

-- CreateIndex
CREATE INDEX "persona_correo_idx" ON "persona"("correo");

-- CreateIndex
CREATE INDEX "direccion_ubigeo_codigo_idx" ON "direccion"("ubigeo_codigo");

-- CreateIndex
CREATE INDEX "direccion_departamento_provincia_distrito_idx" ON "direccion"("departamento", "provincia", "distrito");

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

-- CreateIndex
CREATE UNIQUE INDEX "usuario_persona_id_rol_id_key" ON "usuario"("persona_id", "rol_id");

-- CreateIndex
CREATE INDEX "disponibilidadabogado_abogado_id_dia_semana_idx" ON "disponibilidadabogado"("abogado_id", "dia_semana");

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidadabogado_abogado_id_dia_semana_hora_inicio_hor_key" ON "disponibilidadabogado"("abogado_id", "dia_semana", "hora_inicio", "hora_fin");

-- CreateIndex
CREATE INDEX "perfilabogado_especialidad_perfilabogado_id_idx" ON "perfilabogado_especialidad"("perfilabogado_id");

-- CreateIndex
CREATE INDEX "perfilabogado_especialidad_especialidad_id_idx" ON "perfilabogado_especialidad"("especialidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "perfilabogado_especialidad_perfilabogado_id_especialidad_id_key" ON "perfilabogado_especialidad"("perfilabogado_id", "especialidad_id");

-- CreateIndex
CREATE UNIQUE INDEX "especialidad_nombre_key" ON "especialidad"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "estudio_ruc_key" ON "estudio"("ruc");

-- CreateIndex
CREATE INDEX "estudio_estado_idx" ON "estudio"("estado");

-- CreateIndex
CREATE INDEX "estudio_condicion_idx" ON "estudio"("condicion");

-- CreateIndex
CREATE INDEX "abogadoestudio_activo_idx" ON "abogadoestudio"("activo");

-- CreateIndex
CREATE INDEX "abogadoestudio_usuario_id_idx" ON "abogadoestudio"("usuario_id");

-- CreateIndex
CREATE INDEX "abogadoestudio_estudio_id_idx" ON "abogadoestudio"("estudio_id");

-- CreateIndex
CREATE UNIQUE INDEX "abogadoestudio_usuario_id_estudio_id_key" ON "abogadoestudio"("usuario_id", "estudio_id");

-- CreateIndex
CREATE INDEX "plan_nombre_idx" ON "plan"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "servicio_codigo_key" ON "servicio"("codigo");

-- CreateIndex
CREATE INDEX "servicio_activo_idx" ON "servicio"("activo");

-- CreateIndex
CREATE INDEX "servicio_codigo_idx" ON "servicio"("codigo");

-- CreateIndex
CREATE INDEX "planservicio_servicio_id_idx" ON "planservicio"("servicio_id");

-- CreateIndex
CREATE INDEX "planservicio_plan_id_idx" ON "planservicio"("plan_id");

-- CreateIndex
CREATE INDEX "planservicio_activo_idx" ON "planservicio"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "planservicio_plan_id_servicio_id_key" ON "planservicio"("plan_id", "servicio_id");

-- CreateIndex
CREATE INDEX "formato_especialidad_id_idx" ON "formato"("especialidad_id");

-- CreateIndex
CREATE INDEX "formato_es_premium_idx" ON "formato"("es_premium");

-- CreateIndex
CREATE INDEX "formato_institucion_idx" ON "formato"("institucion");

-- CreateIndex
CREATE INDEX "formato_tipo_documento_idx" ON "formato"("tipo_documento");

-- CreateIndex
CREATE INDEX "bibliotecaitem_tipo_idx" ON "bibliotecaitem"("tipo");

-- CreateIndex
CREATE INDEX "bibliotecaitem_creado_el_idx" ON "bibliotecaitem"("creado_el");

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bitacorabusquedavh" ADD CONSTRAINT "bitacorabusquedavh_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_consulta_id_fkey" FOREIGN KEY ("consulta_id") REFERENCES "consulta"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resena" ADD CONSTRAINT "resena_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clienteabogado" ADD CONSTRAINT "clienteabogado_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteabogado" ADD CONSTRAINT "clienteabogado_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_formato_id_fkey" FOREIGN KEY ("formato_id") REFERENCES "formato"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_abogado_firma_fkey" FOREIGN KEY ("abogado_firma") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "archivo" ADD CONSTRAINT "archivo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estadopago"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_voucher_archivo_id_fkey" FOREIGN KEY ("voucher_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagodetalle" ADD CONSTRAINT "pagodetalle_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tarifa" ADD CONSTRAINT "tarifa_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comision" ADD CONSTRAINT "comision_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_titulo_archivo_id_fkey" FOREIGN KEY ("titulo_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificacionabogado" ADD CONSTRAINT "verificacionabogado_colegiatura_id_fkey" FOREIGN KEY ("colegiatura_id") REFERENCES "colegiaturaabogado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_carnet_archivo_id_fkey" FOREIGN KEY ("carnet_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colegiaturaabogado" ADD CONSTRAINT "colegiaturaabogado_colegio_id_fkey" FOREIGN KEY ("colegio_id") REFERENCES "colegioabogado"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "recuperacionclave" ADD CONSTRAINT "recuperacionclave_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recuperacionclave" ADD CONSTRAINT "recuperacionclave_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persona" ADD CONSTRAINT "persona_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direccion"("ubigeo_codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disponibilidadabogado" ADD CONSTRAINT "disponibilidadabogado_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "perfilabogado"("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado_especialidad" ADD CONSTRAINT "perfilabogado_especialidad_perfilabogado_id_fkey" FOREIGN KEY ("perfilabogado_id") REFERENCES "perfilabogado"("usuario_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado_especialidad" ADD CONSTRAINT "perfilabogado_especialidad_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "estudio" ADD CONSTRAINT "estudio_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "direccion"("ubigeo_codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abogadoestudio" ADD CONSTRAINT "abogadoestudio_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "abogadoestudio" ADD CONSTRAINT "abogadoestudio_estudio_id_fkey" FOREIGN KEY ("estudio_id") REFERENCES "estudio"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_avatar_archivo_id_fkey" FOREIGN KEY ("avatar_archivo_id") REFERENCES "archivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "planservicio" ADD CONSTRAINT "planservicio_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "formato" ADD CONSTRAINT "formato_especialidad_id_fkey" FOREIGN KEY ("especialidad_id") REFERENCES "especialidad"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
