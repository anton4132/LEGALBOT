generator erd {
  provider = "prisma-erd-generator"
}

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

/// This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
model auditoria {
  id            Int      @id @default(autoincrement())
  tabla         String
  registro_id   Int
  usuario_id    Int?
  operacion     String
  datos_previos Json?
  datos_nuevos  Json?
  fecha         DateTime @default(now()) @db.Timestamptz(6)
  usuario       usuario? @relation(fields: [usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model bitacorabusquedavh {
  id            Int      @id @default(autoincrement())
  usuario_id    Int
  placa         String   @db.VarChar(10)
  tipo_busqueda String?
  precio        Decimal? @db.Decimal
  respuesta_api Json?
  buscada_el    DateTime @default(now()) @db.Timestamptz(6)
  usuario       usuario  @relation(fields: [usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model codigoverificacion {
  id         Int       @id @default(autoincrement())
  usuario_id Int
  codigo     String
  motivo     String?
  enviado_el DateTime  @default(now()) @db.Timestamptz(6)
  expira_el  DateTime  @db.Timestamptz(6)
  usado      Boolean   @default(false)
  usado_el   DateTime? @db.Timestamptz(6)
  usuario    usuario   @relation(fields: [usuario_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@index([usuario_id])
}

model cita {
  id                               Int      @id @default(autoincrement())
  cliente_id                       Int
  abogado_id                       Int
  consulta_id                      Int
  pago_id                          Int?
  inicia_el                        DateTime @db.Timestamptz(6)
  termina_el                       DateTime @db.Timestamptz(6)
  estado                           est_cita @default(pendiente)
  usuario_cita_abogado_idTousuario usuario  @relation("cita_abogado_idTousuario", fields: [abogado_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario_cita_cliente_idTousuario usuario  @relation("cita_cliente_idTousuario", fields: [cliente_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  consulta                         consulta @relation(fields: [consulta_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pago                             pago?    @relation(fields: [pago_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model clienteabogado {
  id                                         Int      @id @default(autoincrement())
  abogado_id                                 Int
  cliente_id                                 Int
  creado_el                                  DateTime @default(now()) @db.Timestamptz(6)
  notas_privadas                             String?
  usuario_clienteabogado_abogado_idTousuario usuario  @relation("clienteabogado_abogado_idTousuario", fields: [abogado_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario_clienteabogado_cliente_idTousuario usuario  @relation("clienteabogado_cliente_idTousuario", fields: [cliente_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model consulta {
  id                                   Int            @id @default(autoincrement())
  cliente_id                           Int
  abogado_id                           Int
  pregunta                             String
  especialidad_id                      Int?
  tipo                                 tipo_consulta  @default(texto)
  audio_url                            String?
  opcion_respuesta                     resp_consulta?
  documento_id                         Int?
  pago_id                              Int?
  estado                               est_consulta   @default(pendiente)
  creada_el                            DateTime       @default(now()) @db.Timestamptz(6)
  cita                                 cita[]
  documento                            documento?     @relation(fields: [documento_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
  pago                                 pago?          @relation(fields: [pago_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
  especialidad                         especialidad?  @relation(fields: [especialidad_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario_consulta_abogado_idTousuario usuario        @relation("consulta_abogado_idTousuario", fields: [abogado_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario_consulta_cliente_idTousuario usuario        @relation("consulta_cliente_idTousuario", fields: [cliente_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

enum tipo_consulta {
  texto
  audio
}

/// This table contains check constraints and requires additional setup for migrations. Visit https://pris.ly/d/check-constraints for more info.
model disponibilidadabogado {
  id            Int           @id @default(autoincrement())
  abogado_id    Int
  dia_semana    Int           @db.SmallInt
  hora_inicio   DateTime      @db.Time(6)
  hora_fin      DateTime      @db.Time(6)
  perfilabogado perfilabogado @relation(fields: [abogado_id], references: [usuario_id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([abogado_id, dia_semana, hora_inicio, hora_fin])
}

model documento {
  id                                        Int             @id @default(autoincrement())
  propietario_id                            Int
  tipo_documento                            String?
  ruta_archivo                              String
  generado_ai                               Boolean         @default(false)
  firmado                                   Boolean         @default(false)
  firma_url                                 String?
  abogado_firma                             Int?
  formato_id                                Int?
  institucion                               String?
  enviado                                   Boolean         @default(false)
  estado_tramite                            est_doc_tramite @default(pendiente)
  enviado_el                                DateTime?       @db.Timestamptz(6)
  pago_id                                   Int?
  tamano                                    Int?
  creado_el                                 DateTime        @default(now()) @db.Timestamptz(6)
  formato                                   formato?        @relation(fields: [formato_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  pago                                      pago?           @relation(fields: [pago_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
  usuario_documento_abogado_firmaTousuario  usuario?        @relation("documento_abogado_firmaTousuario", fields: [abogado_firma], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario_documento_propietario_idTousuario usuario         @relation("documento_propietario_idTousuario", fields: [propietario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  consulta                                  consulta[]

  @@index([propietario_id])
}

model archivo {
  id         Int      @id @default(autoincrement())
  usuario_id Int
  ruta       String
  tamano     Int
  tipo       String?
  creado_el  DateTime @default(now()) @db.Timestamptz(6)
  usuario    usuario  @relation(fields: [usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([usuario_id])
}

model estadopago {
  id     Int    @id @default(autoincrement()) @db.SmallInt
  codigo String @unique
  nombre String
  pago   pago[]
}

model especialidad {
  id            Int             @id @default(autoincrement())
  nombre        String          @unique
  perfilabogado perfilabogado[]
  consulta      consulta[]
  formatos      formato[]
}

model pago {
  id            Int           @id @default(autoincrement())
  usuario_id    Int
  monto         Decimal       @db.Decimal
  moneda        String        @db.Char(3)
  concepto      String?
  proveedor_txn String?
  estado_id     Int           @db.SmallInt
  metodo_pago   String?
  tipo_servicio String?
  creado_el     DateTime      @default(now()) @db.Timestamptz(6)
  cita          cita[]
  documentos    documento[]
  consultas     consulta[]
  pagodetalle   pagodetalle[]
  estadopago    estadopago    @relation(fields: [estado_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  usuario       usuario       @relation(fields: [usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([estado_id])
}

model pagodetalle {
  id      Int               @id @default(autoincrement())
  pago_id Int
  tipo    tipo_detalle_pago
  monto   Decimal           @db.Decimal
  pago    pago              @relation(fields: [pago_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}

enum tipo_detalle_pago {
  subtotal
  comision_plataforma
  tarifa_ia
  fee_psp
  total_cliente
  neto_abogado
}

enum tipo_calculo_tc {
  fijo
  paquete
  consumo_ia
  minimo_mas_variable
  estacional
}

/// A qué rol aplica la regla
enum rol_aplica_tc {
  cliente
  abogado
  ambos
}

/// Quién absorbe el fee de pasarela
enum quien_absorbe_psp {
  cliente
  plataforma
  abogado
  mixto
}

/// Reglas de redondeo para presentación/precio final
enum regla_redondeo {
  dos_decimales
  a_0_05
  entero_superior
}

model tarifacomision {
  id          Int      @id @default(autoincrement())
  codigo      String   @unique
  descripcion String?
  valor       Decimal? @db.Decimal
  tipo        String
  activo      Boolean  @default(true)

  // NUEVOS CAMPOS (versionado, ámbitos y cálculo)
  servicio_id      Int?
  plan_id          Int?
  rol_aplica       rol_aplica_tc    @default(ambos)
  moneda           String?          @db.Char(3)
  tipo_calculo     tipo_calculo_tc?
  parametros       Json?
  incluye_impuesto Boolean?         @default(false)
  vigencia_desde   DateTime?        @db.Timestamptz(6)
  vigencia_hasta   DateTime?        @db.Timestamptz(6)
  prioridad        Int?             @db.SmallInt
  ambito_region    String?
  metodo_pago      String?

  plan     plan?     @relation("PlanTarifa", fields: [plan_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
  servicio servicio? @relation("ServicioTarifa", fields: [servicio_id], references: [id], onDelete: SetNull, onUpdate: NoAction)

  @@unique([servicio_id, plan_id, rol_aplica, ambito_region, metodo_pago, vigencia_desde, vigencia_hasta, activo])
  @@index([servicio_id])
  @@index([plan_id])
  @@index([servicio_id, plan_id, activo])
  @@index([vigencia_desde, vigencia_hasta])
}

model impuesto {
  id                 Int       @id @default(autoincrement())
  codigo             String    @unique
  nombre             String
  porcentaje         Decimal   @db.Decimal
  incluido_en_precio Boolean   @default(false)
  activo             Boolean   @default(true)
  vigencia_desde     DateTime? @db.Timestamptz(6)
  vigencia_hasta     DateTime? @db.Timestamptz(6)
  creado_el          DateTime  @default(now()) @db.Timestamptz(6)
}

/// Configuración económica global (1 fila activa)
model econconfig {
  id             Int            @id @default(autoincrement())
  moneda_defecto String         @db.Char(3)
  regla_redondeo regla_redondeo @default(dos_decimales)
  decimales      Int            @default(2)
  activo         Boolean        @default(true)
  actualizado_el DateTime       @default(now()) @db.Timestamptz(6)
}

model pasarela {
  id            Int               @id @default(autoincrement())
  nombre        String            @unique
  porcentaje    Decimal?          @db.Decimal // % base PSP
  fijo          Decimal?          @db.Decimal // fijo por transacción
  quien_absorbe quien_absorbe_psp @default(plataforma)
  activo        Boolean           @default(true)
  creado_el     DateTime          @default(now()) @db.Timestamptz(6)
  reglas_metodo pasarelametodo[]
}

model pasarelametodo {
  id            Int                @id @default(autoincrement())
  pasarela_id   Int
  metodo_pago   String
  porcentaje    Decimal?           @db.Decimal
  fijo          Decimal?           @db.Decimal
  quien_absorbe quien_absorbe_psp?
  activo        Boolean            @default(true)
  pasarela      pasarela           @relation(fields: [pasarela_id], references: [id], onDelete: Cascade, onUpdate: NoAction)

  @@unique([pasarela_id, metodo_pago], name: "pasarela_id_metodo_pago")
}

model estudio {
  id               Int             @id @default(autoincrement())
  slug             String          @unique
  ruc              String?         @unique
  razon_social     String
  nombre_comercial String?
  correo_contacto  String?
  telefono         String?
  direccion        String?
  ciudad           String?
  pais             String?
  logo_url         String?
  activo           Boolean         @default(true)
  creado_el        DateTime        @default(now()) @db.Timestamptz(6)
  perfiles         perfilabogado[]
}

model perfilabogado {
  usuario_id            Int                     @id
  estudio_id            Int
  especialidad_id       Int?
  tarifa_base           Decimal?                @db.Decimal
  direccion_atencion    String?
  place_id_api          String?
  bio                   String?
  duracion_minutos      Int                     @default(60)
  latitud               Float?
  longitud              Float?
  disponibilidadabogado disponibilidadabogado[]
  usuario               usuario                 @relation(fields: [usuario_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  especialidad          especialidad?           @relation(fields: [especialidad_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  estudio               estudio                 @relation(fields: [estudio_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model persona {
  id               Int       @id @default(autoincrement())
  dni              String    @unique @db.Char(8)
  telefono         String?   @db.VarChar(15)
  primer_nombre    String    @db.VarChar(100)
  segundo_nombre   String?   @db.VarChar(100)
  apellido_paterno String    @db.VarChar(100)
  apellido_materno String?   @db.VarChar(100)
  correo           String    @unique
  direccion        String?
  usuario          usuario[]
}

model role {
  id      Int       @id @default(autoincrement()) @db.SmallInt
  codigo  String    @unique
  nombre  String
  usuario usuario[]
}

model plan {
  id                    Int              @id @default(autoincrement())
  nombre                String
  almacenamiento_maximo Int?
  usuarios              usuario[]
  planservicios         planservicio[]
  tarifas               tarifacomision[] @relation("PlanTarifa")
}

model servicio {
  id               Int              @id @default(autoincrement())
  codigo           String           @unique
  nombre           String
  descripcion      String?
  activo           Boolean          @default(true)
  fecha_creada     DateTime         @default(dbgenerated("now() AT TIME ZONE 'America/Lima'")) @db.Timestamp(6) 
  fecha_modificada DateTime         @updatedAt @db.Timestamp(6)
  planservicios    planservicio[]
  tarifas          tarifacomision[] @relation("ServicioTarifa")
}

model planservicio {
  id             Int       @id @default(autoincrement())
  servicio_id    Int
  plan_id        Int
  activo         Boolean   @default(true)
  vigencia_desde DateTime? @db.Timestamptz(6)
  vigencia_hasta DateTime? @db.Timestamptz(6)
  servicio       servicio  @relation(fields: [servicio_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  plan           plan      @relation(fields: [plan_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@unique([plan_id, servicio_id])
}

model usuario {
  id                                                Int                  @id @default(autoincrement())
  persona_id                                        Int
  rol_id                                            Int                  @db.SmallInt
  clave                                             String
  telefono_verificado                               Boolean              @default(false)
  plan_id                                           Int?
  almacenamiento_usado                              Int                  @default(0)
  creado_el                                         DateTime             @default(now()) @db.Timestamptz(6)
  auditoria                                         auditoria[]
  bitacorabusquedavh                                bitacorabusquedavh[]
  cita_cita_abogado_idTousuario                     cita[]               @relation("cita_abogado_idTousuario")
  cita_cita_cliente_idTousuario                     cita[]               @relation("cita_cliente_idTousuario")
  clienteabogado_clienteabogado_abogado_idTousuario clienteabogado[]     @relation("clienteabogado_abogado_idTousuario")
  clienteabogado_clienteabogado_cliente_idTousuario clienteabogado[]     @relation("clienteabogado_cliente_idTousuario")
  consulta_consulta_abogado_idTousuario             consulta[]           @relation("consulta_abogado_idTousuario")
  consulta_consulta_cliente_idTousuario             consulta[]           @relation("consulta_cliente_idTousuario")
  documento_documento_abogado_firmaTousuario        documento[]          @relation("documento_abogado_firmaTousuario")
  documento_documento_propietario_idTousuario       documento[]          @relation("documento_propietario_idTousuario")
  pago                                              pago[]
  codigoverificacion                                codigoverificacion[]
  archivos                                          archivo[]
  perfilabogado                                     perfilabogado?
  plan                                              plan?                @relation(fields: [plan_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  persona                                           persona              @relation(fields: [persona_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  role                                              role                 @relation(fields: [rol_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

enum est_cita {
  pendiente
  confirmada
  cancelada
  completada
  no_show
}

enum est_consulta {
  pendiente
  respondida
  cerrada
}

enum resp_consulta {
  abogado
  documento
}

enum est_doc_tramite {
  pendiente
  enviado
  recibido
  observado
}

model formato {
  id              Int           @id @default(autoincrement())
  nombre          String
  descripcion     String?
  especialidad_id Int?
  institucion     String?
  tipo_documento  String?
  ruta_archivo    String
  es_premium      Boolean       @default(false)
  costo           Decimal?      @db.Decimal
  creado_el       DateTime      @default(now()) @db.Timestamptz(6)
  documentos      documento[]
  especialidad    especialidad? @relation(fields: [especialidad_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
}

model bibliotecaitem {
  id           Int      @id @default(autoincrement())
  titulo       String
  descripcion  String?
  tipo         String
  ruta_archivo String
  costo        Decimal? @db.Decimal
  creado_el    DateTime @default(now()) @db.Timestamptz(6)
}
