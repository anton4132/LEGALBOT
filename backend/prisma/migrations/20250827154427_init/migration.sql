-- CreateEnum
CREATE TYPE "est_cita" AS ENUM ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_show');

-- CreateEnum
CREATE TYPE "est_consulta" AS ENUM ('pendiente', 'respondida', 'cerrrada');

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

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
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
    "area_detectada" TEXT,
    "estado" "est_consulta" NOT NULL DEFAULT 'pendiente',
    "creada_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consulta_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "documento" (
    "id" SERIAL NOT NULL,
    "propietario_id" INTEGER NOT NULL,
    "tipo_documento" TEXT,
    "ruta_archivo" TEXT NOT NULL,
    "generado_ai" BOOLEAN NOT NULL DEFAULT false,
    "firmado" BOOLEAN NOT NULL DEFAULT false,
    "abogado_firma" INTEGER,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
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
    "estado_id" SMALLINT NOT NULL,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfilabogado" (
    "usuario_id" INTEGER NOT NULL,
    "especialidad" TEXT,
    "tarifa_base" DECIMAL,
    "direccion_atencion" TEXT,
    "place_id_api" TEXT,
    "bio" TEXT,
    "duracion_minutos" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "perfilabogado_pkey" PRIMARY KEY ("usuario_id")
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
    "direccion" TEXT,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" SMALLSERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "persona_id" INTEGER NOT NULL,
    "rol_id" SMALLINT NOT NULL,
    "clave" TEXT NOT NULL,
    "telefono_verificado" BOOLEAN NOT NULL DEFAULT false,
    "creado_el" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "disponibilidadabogado_abogado_id_dia_semana_hora_inicio_hor_key" ON "disponibilidadabogado"("abogado_id", "dia_semana", "hora_inicio", "hora_fin");

-- CreateIndex
CREATE UNIQUE INDEX "estadopago_codigo_key" ON "estadopago"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "persona_dni_key" ON "persona"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "persona_correo_key" ON "persona"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "role_codigo_key" ON "role"("codigo");

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
ALTER TABLE "clienteabogado" ADD CONSTRAINT "clienteabogado_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clienteabogado" ADD CONSTRAINT "clienteabogado_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consulta" ADD CONSTRAINT "consulta_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disponibilidadabogado" ADD CONSTRAINT "disponibilidadabogado_abogado_id_fkey" FOREIGN KEY ("abogado_id") REFERENCES "perfilabogado"("usuario_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_abogado_firma_fkey" FOREIGN KEY ("abogado_firma") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_propietario_id_fkey" FOREIGN KEY ("propietario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_estado_id_fkey" FOREIGN KEY ("estado_id") REFERENCES "estadopago"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "perfilabogado" ADD CONSTRAINT "perfilabogado_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
