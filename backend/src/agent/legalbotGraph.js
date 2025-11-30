

// backend/src/controllers/legalbotAgent.controller.js
const axios = require("axios");
const { z } = require("zod");
const { randomUUID } = require("crypto");
const {
  StateGraph,
  START,
  END,
  MemorySaver,
  MessagesZodMeta,
} = require("@langchain/langgraph");
const { withLangGraph } = require("@langchain/langgraph/zod");
const { HumanMessage, AIMessage } = require("@langchain/core/messages");

// =======================
// 1) Definir esquemas extra (intención y datos de caso)
// =======================

const DocumentIntentSchema = z.object({
  wantsDocument: z.boolean(),
  tipoDocumento: z.string().optional(), // p.ej. "carta_de_renuncia"
});

const CaseDataSchema = z.object({
  // Genéricos
  descripcionLibre: z.string().optional(),
  hechosRelevantes: z.string().optional(),
  fechaHechos: z.string().optional(),
  lugarHechos: z.string().optional(),
  contraparte: z.string().optional(),
  tipoRelacion: z.string().optional(), // empleador, entidad pública, banco, etc.
  // Datos laborales típicos (se irán usando más adelante)
  datosTrabajador: z
    .object({
      nombreCompleto: z.string().optional(),
      dni: z.string().optional(),
      puesto: z.string().optional(),
      empresa: z.string().optional(),
    })
    .optional(),
  datosEmpresa: z
    .object({
      razonSocial: z.string().optional(),
      ruc: z.string().optional(),
      direccion: z.string().optional(),
    })
    .optional(),
});

// =======================
// 1) Definir el STATE
// =======================

const LegalBotState = z.object({
  // Historial de mensajes (usuario + IA)
  messages: withLangGraph(z.array(z.custom()), MessagesZodMeta),

  // Chunks recuperados de Qdrant
  contextDocs: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string(),
        source: z.string().optional(),
        score: z.number().optional(),
      })
    )
    .default([]),

  // Métrica simple del número de llamadas al LLM
  llmCalls: z.number().optional(),

  // Identificador de request para trazabilidad
  requestId: z.string().optional(),

  // Log de errores a nivel de conversación
  errors: z
    .array(
      z.object({
        step: z.string(),
        message: z.string(),
        requestId: z.string().optional(),
        attempt: z.number().optional(),
        latencyMs: z.number().optional(),
        endpoint: z.string().optional(),
        payloadSize: z.number().optional(),
        detail: z.any().optional(),
      })
    )
    .default([]),

  // Resultado de clasificación de especialidad
  classifiedSpecialty: z
    .object({
      id: z.number(),
      nombre: z.string(),
      confidence: z.number(), // 0–1
      justificacion: z.string().optional(),
    })
    .optional(),

  // Nodo actual (útil para debug / trazabilidad)
  currentNode: z.string().optional(),

  // Métricas de latencia por etapa
  latencies: z
    .object({
      classifyMs: z.number().optional(),
      embedMs: z.number().optional(),
      qdrantMs: z.number().optional(),
      llmMs: z.number().optional(),
    })
    .optional(),

  // Último error “fuerte” de la conversación (si aplica)
  lastError: z.any().optional(),

  // Nueva capa: intención de documento
  documentIntent: DocumentIntentSchema.optional(),

  // Datos estructurados del caso (intake)
  caseData: CaseDataSchema.optional(),

  // Estado de completitud de la info del caso
  infoStatus: z.enum(["unknown", "incomplete", "ready"]).optional(),

  // Plantilla seleccionada (para generación de documentos)
  selectedTemplate: z
    .object({
      id: z.string(),
      text: z.string(),
      source: z.string().optional(),
    })
    .optional(),

  // === Extensiones para fase 2 ===
  // Complejidad del caso (determina el flujo de plantillas)
  complexity: z.enum(["baja", "media", "alta"]).optional(),

  // Nivel de riesgo del caso (controla tono y formalidad)
  risk: z.enum(["bajo", "medio", "alto"]).optional(),

  // Indica si el borrador requiere revisión humana antes de finalizar
  needsHumanReview: z.boolean().optional(),

  // Acción de revisión humana: approve | edit | cancel
  humanReviewAction: z.enum(["approve", "edit", "cancel"]).optional(),

  // Modo de operación recibido desde el frontend: qa | doc_assistant | intake_only
  mode: z.enum(["qa", "doc_assistant", "intake_only"]).optional(),

  // Historial de versiones de documentos generados en este hilo
  docVersions: z
    .array(
      z.object({
        version: z.string(),
        content: z.string(),
        timestamp: z.string().optional(),
      })
    )
    .optional(),

  // Esqueleto del documento construido a partir de las secciones recuperadas
  structure: z.any().optional(),

  // Contenido del borrador completo después de rellenar la plantilla
  filledTemplate: z.string().optional(),

  // Lista de campos obligatorios según el tipo de documento. Se calcula en
  // buildIntakeSchemaNode para guiar el flujo de preguntas.
  requiredFields: z.array(z.string()).optional(),

  // Lista de campos que aún faltan completar para considerar la info como
  // "ready". Se utiliza en autoEnrichCaseDataNode y/o requestMissingInfo
  missingFields: z.array(z.string()).optional(),
});

// =======================
// 1.1 Especialidades + esquema de clasificación
// =======================

// Si lo prefieres, este JSON se puede extraer a un archivo externo y hacer require(...)
const SPECIALTIES = [
  { "id":1,"nombre":"Derecho Penal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":2,"nombre":"Derecho Civil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":3,"nombre":"Derecho de Familia","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":4,"nombre":"Derecho Laboral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":5,"nombre":"Derecho Empresarial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":6,"nombre":"Derecho Administrativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":7,"nombre":"Derecho Tributario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":8,"nombre":"Derecho Constitucional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":9,"nombre":"Derecho Mercantil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":10,"nombre":"Derecho Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[{"id":2}]},
  { "id":11,"nombre":"Derecho Internacional Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":12,"nombre":"Derecho Internacional Privado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":13,"nombre":"Derecho Procesal Penal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":14,"nombre":"Derecho Procesal Civil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":15,"nombre":"Litigación Oral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":16,"nombre":"Arbitraje y Métodos Alternativos de Resolución de Conflictos (mediación, conciliación, negociación)","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":17,"nombre":"Compliance y Ética Corporativa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":18,"nombre":"Prevención de Lavado de Activos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":19,"nombre":"Protección de Datos Personales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":20,"nombre":"Ciberseguridad y Derecho Tecnológico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":21,"nombre":"Blockchain y Criptoactivos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":22,"nombre":"Derecho de Protección al Consumidor","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":23,"nombre":"Derechos Humanos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":24,"nombre":"Derecho Registral y Notarial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":25,"nombre":"Derecho de Seguros","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":26,"nombre":"Derecho de Sucesiones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":27,"nombre":"Derecho Matrimonial Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":28,"nombre":"Derecho de Filiación Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":29,"nombre":"Derecho de Adopción Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":30,"nombre":"Derecho de Propiedad Intelectual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":31,"nombre":"Derecho de la Competencia","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":32,"nombre":"Derecho de la Empresa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":33,"nombre":"Derecho Societario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":34,"nombre":"Derecho de Contrataciones y Adquisiciones del Estado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":35,"nombre":"Derecho de Responsabilidad Civil Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":36,"nombre":"Derecho de las Obligaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":37,"nombre":"Derecho de los Bienes","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":38,"nombre":"Derecho de las Personas Jurídicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":39,"nombre":"Derecho de la Nacionalidad","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":40,"nombre":"Derecho Bancario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":41,"nombre":"Derecho Financiero","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":42,"nombre":"Derecho de Energía y Minas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":43,"nombre":"Derecho Agrario","consulta":[],"formatos":[],"perfiles_especialidad":[{"id":1}]},
  { "id":44,"nombre":"Derecho Municipal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":45,"nombre":"Derecho Electoral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":46,"nombre":"Derecho Migratorio","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":47,"nombre":"Derecho de la Construcción","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":48,"nombre":"Derecho de Concesiones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":49,"nombre":"Derecho Aduanero","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":50,"nombre":"Derecho Internacional Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":51,"nombre":"Derecho Internacional Humanitario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":52,"nombre":"Derecho Procesal Administrativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":53,"nombre":"Derecho Procesal Constitucional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":54,"nombre":"Derecho Procesal Laboral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":55,"nombre":"Derecho Penal Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":56,"nombre":"Derecho Penal Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":57,"nombre":"Derecho Penal Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":58,"nombre":"Derecho Penal Tributario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":59,"nombre":"Derecho Penal Corporativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":60,"nombre":"Derecho Penal de Lavado de Activos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":61,"nombre":"Derecho Penal de Delitos Informáticos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":62,"nombre":"Derecho Tributario Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":63,"nombre":"Contratación Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":64,"nombre":"Regulación de Servicios Públicos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":65,"nombre":"Derecho de Recursos Naturales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":66,"nombre":"Derecho del Mar","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":67,"nombre":"Derecho Administrativo Sancionador","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":68,"nombre":"Derecho Administrativo Disciplinario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":69,"nombre":"Derecho Administrativo Global","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":70,"nombre":"Derecho Administrativo Electrónico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":71,"nombre":"Derecho Parlamentario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":72,"nombre":"Derecho Público y Buen Gobierno","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":73,"nombre":"Políticas Públicas y Derecho Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":74,"nombre":"Justicia Militar","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":75,"nombre":"Derecho y Género","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":76,"nombre":"Derecho y Diversidad Sexual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":77,"nombre":"Bioética Jurídica","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":78,"nombre":"Publicidad y Reprensión de la Competencia Desleal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":79,"nombre":"Derecho Socioambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":80,"nombre":"Derecho de Impacto Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":81,"nombre":"Derecho de Minería","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":82,"nombre":"Derecho de Hidrocarburos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":83,"nombre":"Derecho Eléctrico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":84,"nombre":"Derecho de Transportes","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":85,"nombre":"Derecho de Comunicaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":86,"nombre":"Derecho de Comercio Exterior","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":87,"nombre":"Comercio Exterior y Negociaciones Internacionales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":88,"nombre":"Derecho de Dumping y Subsidios","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":89,"nombre":"Derecho de Resolución de Conflictos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":90,"nombre":"Derecho de Mediación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":91,"nombre":"Derecho de Conciliación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":92,"nombre":"Derecho de Negociación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":93,"nombre":"Derecho Judicial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":94,"nombre":"Derecho de Contratos Internacionales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":95,"nombre":"Derecho de la Lex Mercatoria","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":96,"nombre":"Derecho de Fundaciones y Asociaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":97,"nombre":"Derecho Canónico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":98,"nombre":"Derecho de las Tecnologías de Información","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":99,"nombre":"Análisis Económico del Derecho","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":100,"nombre":"Derecho de Abastecimiento Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":101,"nombre":"Derecho de Planeamiento y Presupuesto Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":102,"nombre":"Derecho de Gestión de Inversiones Públicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":103,"nombre":"Derecho de Recursos Humanos Públicos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":104,"nombre":"Derecho de Control Gubernamental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":105,"nombre":"Derecho de Eliminación de Barreras Burocráticas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":106,"nombre":"Derecho de Simplificación Administrativa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":107,"nombre":"Derecho de Propiedad Industrial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":108,"nombre":"Derecho Autor y Derechos Sui Generis","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":109,"nombre":"Derecho Bancario y Financiero Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":110,"nombre":"Derecho del Consumidor Digital","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":111,"nombre":"Derecho Penal de Crimen Organizado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":112,"nombre":"Derecho Penal de Corrupción","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":113,"nombre":"Derecho Penal de Terrorismo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":114,"nombre":"Derecho Penal de Narcotráfico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":115,"nombre":"Derecho Penal de Delitos Financieros","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":116,"nombre":"Derecho Penal de Delitos contra la Administración Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":117,"nombre":"Derecho Penal de Delitos contra el Patrimonio","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":118,"nombre":"Derecho Penal de Delitos contra la Vida, el Cuerpo y la Salud","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":119,"nombre":"Derecho Penal de Delitos contra la Libertad Sexual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":120,"nombre":"Derecho Penal de Delitos contra el Orden Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":121,"nombre":"Derecho Penal de Delitos contra la Seguridad Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":122,"nombre":"Derecho Penal de Delitos contra el Medio Ambiente","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":123,"nombre":"Derecho Penal de Delitos contra la Paz y la Humanidad","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":124,"nombre":"Derecho Penal de Delitos contra la Seguridad Nacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":125,"nombre":"Derecho Penal de Delitos contra el Sistema de Contrataciones Públicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":126,"nombre":"Derecho Penal de Delitos contra el Sistema de Protección de Datos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":127,"nombre":"Derecho Penal de Delitos contra la Seguridad Informática","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  { "id":128,"nombre":"Derecho Penal de Delitos contra el Blockchain y Criptoactivos","consulta":[],"formatos":[],"perfiles_especialidad":[]}
];

const SpecialtyClassificationSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  confidence: z.number().min(0).max(1),
  justificacion: z.string().optional(),
});

// =======================
// 2) Helpers
// =======================

function getLastUserMessage(state) {
  const msgs = state.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const type = m._getType ? m._getType() : m.type || m.role;
    if (type === "human" || type === "user") {
      return m;
    }
  }
  return null;
}

function addError(state, error) {
  const payloadSize =
    error.payloadSize ??
    (error.payload
      ? Buffer.byteLength(JSON.stringify(error.payload))
      : undefined);

  const normalizedError = {
    requestId: state.requestId,
    ...error,
    payloadSize,
  };

  return (state.errors || []).concat(normalizedError);
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === "string" ? c : c.text ?? ""))
      .join("\n");
  }

  if (content && typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    return JSON.stringify(content);
  }

  return "";
}

// Extraer texto plano del último mensaje humano
function getLastUserMessageText(messages) {
  if (!Array.isArray(messages)) return "";
  const last = getLastUserMessage({ messages });
  if (!last) return "";
  const raw = last.content ?? last.text ?? "";
  return normalizeMessageContent(raw);
}

// Extraer JSON de una respuesta de modelo tipo:
// ```json { ... } ``` o texto mezclado
function extractJsonFromText(text) {
  if (!text) return "{}";

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    return text.slice(firstBrace).trim();
  }

  return text.trim();
}

function parseJsonL(content) {
  const lines = (content || "").split(/\r?\n/);
  for (const line of lines) {
    try {
      if (!line.trim()) continue;
      return JSON.parse(line);
    } catch (e) {
      continue;
    }
  }
  return null;
}

function safeParseJson(content) {
  if (!content) return { ok: false, error: new Error("Empty content") };
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch (firstErr) {
    const repaired = parseJsonL(content);
    if (repaired) return { ok: true, value: repaired };
    const wrapped = content.replace(/^[^{\[]*/, "").replace(/[^}\]]*$/, "");
    try {
      return { ok: true, value: JSON.parse(wrapped) };
    } catch (secondErr) {
      return {
        ok: false,
        error: secondErr,
        detail: { firstErr: firstErr.message, secondErr: secondErr.message },
      };
    }
  }
}

function keywordFallbackClassification(text) {
  if (!text || typeof text !== "string") return null;
  const normalized = text.toLowerCase();
  const rules = [
    {
      match: ["laboral", "trabajo", "contrato", "despido", "planilla"],
      specialty: { id: 4, nombre: "Derecho Laboral" },
    },
    {
      match: ["penal", "delito", "denuncia", "fiscalía"],
      specialty: { id: 1, nombre: "Derecho Penal" },
    },
    {
      match: ["civil", "contrato", "obligación", "responsabilidad"],
      specialty: { id: 2, nombre: "Derecho Civil" },
    },
    {
      match: ["familia", "custodia", "divorcio", "alimentos"],
      specialty: { id: 3, nombre: "Derecho de Familia" },
    },
  ];

  for (const rule of rules) {
    if (rule.match.some((k) => normalized.includes(k))) {
      return {
        id: rule.specialty.id,
        nombre: rule.specialty.nombre,
        confidence: 0.35,
        justificacion: "Clasificación heurística por palabras clave",
      };
    }
  }

  return null;
}

// Obtener el valor de un campo nested dado un path con "puntos". Devuelve
// undefined si el campo no existe.
function getField(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const p of parts) {
    if (current && Object.prototype.hasOwnProperty.call(current, p)) {
      current = current[p];
    } else {
      return undefined;
    }
  }
  return current;
}

// Contar la cantidad de campos (incluso anidados) de un objeto. Se usa
// para estimar complejidad y riesgo en función del número de datos de caso.
function countFields(obj) {
  if (!obj || typeof obj !== "object") return 0;
  let count = 0;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      count += countFields(value);
    } else if (value !== undefined && value !== null && String(value).trim()) {
      count += 1;
    }
  }
  return count;
}

// Contar el número de citas normativas presentes en un texto, buscando
// coincidencias de "art." o "artículo". Se usa para evaluar complejidad y riesgo.
function countNormativeCitations(text) {
  if (!text || typeof text !== "string") return 0;
  const regex = /(art\.?|articulo|artículo)\s*[0-9]+/gi;
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function joinUrl(base, path) {
  if (!base) return base;
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function resolveChatUrl() {
  if (process.env.LLAMA_API_URL) {
    return process.env.LLAMA_API_URL;
  }

  if (process.env.OLLAMA_BASE_URL) {
    return joinUrl(process.env.OLLAMA_BASE_URL, "/api/chat");
  }

  return null;
}

function resolveEmbeddingsUrl() {
  if (process.env.EMBEDDINGS_API_URL) {
    return process.env.EMBEDDINGS_API_URL;
  }

  if (process.env.OLLAMA_URL) {
    return joinUrl(process.env.OLLAMA_URL, "/api/embeddings");
  }

  if (process.env.OLLAMA_BASE_URL) {
    return joinUrl(process.env.OLLAMA_BASE_URL, "/api/embeddings");
  }

  return null;
}

// Helper general para llamar a LLaMA (reutilizado en clasificación y respuesta)
async function callLlama(messages, options = {}) {
  const llamaUrl = resolveChatUrl();
  if (!llamaUrl) {
    throw new Error(
      "Debe definir LLAMA_API_URL o, alternativamente, OLLAMA_BASE_URL en .env"
    );
  }

  const body = {
    messages,
    temperature: options.temperature ?? 0.1,
    max_tokens: options.max_tokens ?? 1024,
    stream: options.stream ?? false,
  };

  const chatModel =
    process.env.LLAMA_MODEL || process.env.AGENT_MODEL || undefined;
  if (chatModel) {
    body.model = chatModel;
  }

  const headers = {
    "Content-Type": "application/json",
  };
  if (process.env.LLAMA_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.LLAMA_API_KEY}`;
  }

  const requestConfig = {
    headers,
    responseType: body.stream ? "stream" : "json",
    timeout:
      options.timeout ?? (Number(process.env.LLAMA_TIMEOUT_MS) || 120000),
  };

  const startedAt = Date.now();
  const resp = await axios.post(llamaUrl, body, requestConfig);
  const latencyMs = Date.now() - startedAt;

  let answerText = "";

  if (body.stream && resp.data?.on) {
    await new Promise((resolve) => {
      resp.data.on("data", (chunk) => {
        try {
          const textChunk = chunk.toString();
          answerText += textChunk;
        } catch (e) {
          answerText += String(chunk);
        }
      });
      resp.data.on("end", resolve);
    });
  } else if (resp.data?.output) {
    answerText = resp.data.output;
  } else if (Array.isArray(resp.data?.choices)) {
    const choice = resp.data.choices[0] || {};
    answerText =
      choice.message?.content ??
      choice.message?.text ??
      choice.text ??
      "";
  } else if (typeof resp.data === "string") {
    answerText = resp.data;
  } else if (resp.data?.message?.content || resp.data?.message?.text) {
    answerText = resp.data.message.content ?? resp.data.message.text;
  }

  if (typeof answerText !== "string") {
    answerText = JSON.stringify(answerText);
  }

  return { text: answerText, latencyMs };
}

// =======================
// 3) Embeddings + QDRANT
// =======================

async function embedQuery(questionText, state, attempt = 1) {
  const ollamaEmbedUrl = process.env.OLLAMA_URL
    ? joinUrl(process.env.OLLAMA_URL, "/api/embeddings")
    : null;
  const url = ollamaEmbedUrl || resolveEmbeddingsUrl();
  if (!url) {
    throw new Error(
      "Debe definir EMBEDDINGS_API_URL o, alternativamente, OLLAMA_URL/OLLAMA_BASE_URL en .env"
    );
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.EMBEDDINGS_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.EMBEDDINGS_API_KEY}`;
  }

  const startedAt = Date.now();
  const maxAttempts = Number(process.env.EMBEDDINGS_MAX_ATTEMPTS) || 3;
  const embedModel =
    process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDINGS_MODEL || undefined;

  try {
    if (ollamaEmbedUrl) {
      const res = await fetch(ollamaEmbedUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: embedModel ?? "mxbai-embed-large",
          prompt: questionText,
        }),
      });

      if (!res.ok) {
        const err = new Error(
          `Ollama embeddings request failed with status ${res.status}`
        );
        err.response = { status: res.status };
        throw err;
      }

      const data = await res.json();
      const embedding = data.embedding;

      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding vacío desde Ollama (dimensión 0)");
      }

      return { embedding, latencyMs: Date.now() - startedAt };
    }

    const body = {
      input: questionText,
    };

    if (embedModel) {
      body.model = embedModel;
    }

    const resp = await axios.post(url, body, {
      headers,
      timeout:
        Number(process.env.EMBEDDINGS_TIMEOUT_MS) ||
        Number(process.env.QDRANT_TIMEOUT_MS) ||
        20000,
    });

    // Ajusta según tu servicio de embeddings (Ollama /api/embeddings, etc.)
    if (
      resp.data &&
      Array.isArray(resp.data.data) &&
      resp.data.data[0]?.embedding
    ) {
      const embedding = resp.data.data[0].embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding vacío o inválido");
      }
      return { embedding, latencyMs: Date.now() - startedAt };
    }

    if (resp.data && Array.isArray(resp.data.embedding)) {
      const embedding = resp.data.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("Embedding vacío o inválido");
      }
      return { embedding, latencyMs: Date.now() - startedAt };
    }

    throw new Error("Respuesta de embeddings sin campo 'embedding'");
  } catch (err) {
    const isRetryable =
      err.code === "ECONNABORTED" ||
      err.response?.status === 429 ||
      err.response?.status >= 500;
    if (isRetryable && attempt < maxAttempts) {
      const backoff =
        (Number(process.env.EMBEDDINGS_BACKOFF_MS) || 300) * attempt;
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((res) => setTimeout(res, backoff + jitter));
      return embedQuery(questionText, state, attempt + 1);
    }

    err.step = err.step || "embed";
    throw err;
  }
}

function normalizeVector(vector) {
  if (!Array.isArray(vector)) return vector;
  return vector.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));
}

/**
 * searchInQdrant ahora acepta un 4to parámetro opcional "options":
 *   - mode: "knowledge" | "templates"
 *   - limit?: number
 *   - filter?: objeto de filtro extra
 */
async function searchInQdrant(vector, state, attempt = 1, options = {}) {
  const baseUrl = process.env.QDRANT_URL;
  const collection = process.env.QDRANT_COLLECTION;

  if (!baseUrl || !collection) {
    throw new Error(
      "QDRANT_URL o QDRANT_COLLECTION no están definidos en .env"
    );
  }

  const { mode = "knowledge", limit = 8, filter: extraFilter } = options || {};

  const payload = {
    vector: normalizeVector(vector),
    limit,
    with_payload: true,
    with_vector: false,
  };

  if (!Array.isArray(payload.vector) || payload.vector.length === 0) {
    const err = new Error("Embedding no válido para Qdrant (vector vacío)");
    err.step = "embed";
    throw err;
  }

  // Construir filtro según el modo
  let filter = extraFilter ? { ...extraFilter } : undefined;

  if (mode === "templates") {
    const must = (filter?.must || []).concat([
      { key: "is_template", match: { value: true } },
    ]);
    filter = { ...(filter || {}), must };
  } else if (mode === "knowledge") {
    // Excluir plantillas explícitas cuando se busca solo conocimiento
    const must_not = (filter?.must_not || []).concat([
      { key: "is_template", match: { value: true } },
    ]);
    filter = { ...(filter || {}), must_not };
  }

  if (filter) {
    payload.filter = filter;
  }

  const headers = {
    "Content-Type": "application/json",
    ...(process.env.QDRANT_API_KEY
      ? { "api-key": process.env.QDRANT_API_KEY }
      : {}),
  };

  const startedAt = Date.now();
  try {
    const resp = await axios.post(
      `${baseUrl}/collections/${collection}/points/search`,
      payload,
      {
        headers,
        timeout: Number(process.env.QDRANT_TIMEOUT_MS) || 20000,
      }
    );

    const latencyMs = Date.now() - startedAt;
    const result = resp.data?.result || [];
    return {
      docs: result.map((p) => ({
        id: p.id != null ? String(p.id) : "",
        text: p.payload?.text ?? p.payload?.content ?? "",
        source:
          p.payload?.source ??
          p.payload?.norma ??
          p.payload?.file_name ??
          "",
        score: p.score,
      })),
      latencyMs,
    };
  } catch (err) {
    const status = err.response?.status;
    const isPayloadError = status === 400;
    const isRetryable =
      err.code === "ECONNABORTED" ||
      status === 429 ||
      status >= 500 ||
      err.response?.statusText === "Timeout";
    const maxAttempts = Number(process.env.QDRANT_MAX_ATTEMPTS) || 3;

    if (isPayloadError && attempt === 1) {
      const correctedPayload = { ...payload, vector: normalizeVector(vector) };
      return searchInQdrant(correctedPayload.vector, state, attempt + 1, options);
    }

    if (isRetryable && attempt < maxAttempts) {
      const backoff =
        (Number(process.env.QDRANT_BACKOFF_MS) || 500) * attempt;
      const jitter = Math.floor(Math.random() * 150);
      await new Promise((res) => setTimeout(res, backoff + jitter));
      return searchInQdrant(vector, state, attempt + 1, options);
    }

    throw err;
  }
}

// =======================
// 4) Nodo: clasificación de especialidad
// =======================

async function classifyQuestionNode(state) {
  const userText = getLastUserMessageText(state.messages) || "";

  const specialtiesList = SPECIALTIES.map(
    (s) => `${s.id}: ${s.nombre}`
  ).join("\n");

  const systemPrompt = `
Eres un asistente jurídico de LegalBot encargado de CLASIFICAR consultas legales.
Debes elegir UNA sola especialidad de la lista dada.
Responde SIEMPRE con un JSON VÁLIDO, sin texto adicional, sin explicaciones fuera del JSON.
`.trim();

  const userPrompt = `
Consulta del usuario (Perú):
"""
${userText}
"""

Especialidades disponibles (id - nombre):
${specialtiesList}

Instrucciones:
- Elige sólo una especialidad.
- Si hay varias que podrían aplicar, elige la más directa.
- Si ninguna encaja perfecto, elige la más cercana pero con "confidence" bajo (por ejemplo 0.3).
- Usa EXACTAMENTE alguno de los "nombre" que aparecen en la lista, sin inventar nombres nuevos.

Formato de respuesta EXACTO (JSON):
{
  "id": <id>,
  "nombre": "<nombre exactamente igual a la lista>",
  "confidence": <número entre 0 y 1>,
  "justificacion": "<explicación muy breve en español>"
}
`.trim();

  const maxAttempts = Number(process.env.CLASSIFY_MAX_ATTEMPTS) || 3;
  const baseErrors = state.errors || [];
  let classification;
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { text: rawText, latencyMs } = await callLlama(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        {
          temperature: 0,
          timeout: Number(process.env.CLASSIFY_TIMEOUT_MS) || 20000,
        }
      );

      const jsonText = extractJsonFromText(rawText);
      const parsed = safeParseJson(jsonText);
      if (!parsed.ok) {
        throw parsed.error || new Error("JSON inválido en clasificación");
      }

      const validation = SpecialtyClassificationSchema.safeParse(parsed.value);
      if (!validation.success) {
        throw new Error(validation.error.message);
      }

      classification = validation.data;

      // Asegurar que id/nombre existen en la lista
      const exists = SPECIALTIES.find((s) => s.id === classification.id);
      if (!exists) {
        const byName = SPECIALTIES.find(
          (s) =>
            s.nombre.toLowerCase() === classification.nombre.toLowerCase()
        );
        if (byName) {
          classification.id = byName.id;
          classification.nombre = byName.nombre;
        }
      }

      return {
        classifiedSpecialty: classification,
        errors: baseErrors,
        currentNode: "classifyQuestion",
        latencies: {
          ...(state.latencies || {}),
          classifyMs: latencyMs,
        },
      };
    } catch (err) {
      lastError = err;
      const enhancedErrors = addError(state, {
        step: "classify",
        message: err.message || String(err),
        attempt,
      });

      if (attempt < maxAttempts) {
        // Reparación: pedir al modelo que corrija su salida previa
        const repairPrompt = `Corrige la siguiente salida para que sea JSON válido con el esquema {id:number, nombre:string, confidence:number, justificacion?:string}. Devuelve solo JSON. Texto original: ${err.output || ""}`;
        state = { ...state, errors: enhancedErrors };
        try {
          const { text: repairText } = await callLlama(
            [
              { role: "system", content: systemPrompt },
              { role: "user", content: repairPrompt },
            ],
            {
              temperature: 0,
              timeout: Number(process.env.CLASSIFY_TIMEOUT_MS) || 20000,
            }
          );
          const parsed = safeParseJson(repairText);
          if (parsed.ok) {
            const validation =
              SpecialtyClassificationSchema.safeParse(parsed.value);
            if (validation.success) {
              return {
                classifiedSpecialty: validation.data,
                errors: enhancedErrors,
                currentNode: "classifyQuestion",
              };
            }
          }
        } catch (repairError) {
          state = {
            ...state,
            errors: addError(state, {
              step: "classify",
              message: repairError.message || String(repairError),
              attempt: attempt + 0.5,
            }),
          };
        }
      } else {
        // Fallback heurístico
        const heuristic = keywordFallbackClassification(userText);
        const finalClassification = classification || heuristic;
        const errorsWithFallback = finalClassification
          ? addError(
              { ...state, errors: enhancedErrors },
              {
                step: "classify",
                message:
                  "Se aplicó clasificación heurística por fallos del modelo.",
                attempt: attempt + 0.9,
              }
            )
          : enhancedErrors;

        return {
          classifiedSpecialty: finalClassification || null,
          errors: errorsWithFallback,
          currentNode: "classifyQuestion",
          lastError,
        };
      }
    }
  }

  return {
    classifiedSpecialty: classification || null,
    errors: baseErrors,
    currentNode: "classifyQuestion",
    lastError,
  };
}

// =======================
// 4.1) Nodo nuevo: detectar intención de documento
// =======================

async function detectIntentNode(state) {
  const userText = getLastUserMessageText(state.messages) || "";

  const systemPrompt = `
Eres un asistente jurídico de LegalBot.
Tu tarea es CLASIFICAR la intención del usuario respecto a su consulta:

- ¿Solo quiere orientación general?
- ¿O quiere que se le ayude a GENERAR UN DOCUMENTO jurídico (carta, reclamo, demanda, descargo, etc.)?

Responde SIEMPRE con un JSON válido y NADA más, con el siguiente formato:

{
  "wantsDocument": boolean,
  "tipoDocumento": string | null
}

"tipoDocumento" debe ser corto y en snake_case cuando corresponda, por ejemplo:
- "carta_de_renuncia"
- "carta_de_reclamo_laboral"
- "demanda_de_beneficios_sociales"
- "descargo_administrativo"
- o null si no está claro.
`.trim();

  const userPrompt = `
Texto del usuario:
"""
${userText}
"""
`.trim();

  let documentIntent = {
    wantsDocument: false,
    tipoDocumento: undefined,
  };

  try {
    const { text } = await callLlama(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0, max_tokens: 256 }
    );

    const jsonText = extractJsonFromText(text);
    const parsed = safeParseJson(jsonText);

    if (parsed.ok && parsed.value && typeof parsed.value === "object") {
      const val = parsed.value;
      documentIntent.wantsDocument = !!val.wantsDocument;
      if (typeof val.tipoDocumento === "string" && val.tipoDocumento.trim()) {
        documentIntent.tipoDocumento = val.tipoDocumento.trim();
      }
    }
  } catch (err) {
    const errors = addError(state, {
      step: "detectIntent",
      message: err.message || String(err),
    });
    return {
      documentIntent,
      errors,
      currentNode: "detectIntent",
    };
  }

  // Semilla inicial del caseData: guardar descripción libre si no existe
  const existingCaseData = state.caseData || {};
  const updatedCaseData = {
    ...existingCaseData,
  };
  if (!updatedCaseData.descripcionLibre && userText) {
    updatedCaseData.descripcionLibre = userText;
  }

  return {
    documentIntent,
    caseData: updatedCaseData,
    infoStatus: state.infoStatus || "unknown",
    currentNode: "detectIntent",
  };
}

// =======================
// 5) Nodo: retrieveKnowledge (Qdrant)
// =======================

async function retrieveKnowledgeNode(state) {
  const lastUser = getLastUserMessage(state);
  if (!lastUser) {
    return {
      contextDocs: [],
      errors: addError(state, {
        step: "retrieveKnowledge",
        message: "No se encontró mensaje de usuario.",
      }),
      currentNode: "retrieveKnowledge",
    };
  }

  const question = normalizeMessageContent(lastUser.content);
  const wantsDocument = !!state.documentIntent?.wantsDocument;

  try {
    const { embedding, latencyMs: embedLatency } = await embedQuery(
      question,
      state
    );

    const searchOptions = wantsDocument
      ? { mode: "templates", limit: 8 }
      : { mode: "knowledge", limit: 8 };

    const { docs, latencyMs: qdrantLatency } = await searchInQdrant(
      embedding,
      state,
      1,
      searchOptions
    );

    if (!docs.length) {
      return {
        contextDocs: [],
        selectedTemplate: undefined,
        errors: addError(state, {
          step: "qdrant",
          message:
            "Qdrant no devolvió resultados relevantes para esta consulta.",
          latencyMs: qdrantLatency,
        }),
        currentNode: "retrieveKnowledge",
        latencies: {
          ...(state.latencies || {}),
          embedMs: embedLatency,
          qdrantMs: qdrantLatency,
        },
      };
    }

    let selectedTemplate = state.selectedTemplate;
    if (wantsDocument && docs.length > 0) {
      const first = docs[0];
      selectedTemplate = {
        id: first.id || "",
        text: first.text || "",
        source: first.source,
      };
    }

    return {
      contextDocs: docs,
      selectedTemplate,
      currentNode: "retrieveKnowledge",
      latencies: {
        ...(state.latencies || {}),
        embedMs: embedLatency,
        qdrantMs: qdrantLatency,
      },
    };
  } catch (err) {
    const errors = addError(state, {
      step: err.step || "qdrant",
      message: err.message || String(err),
      detail: err.response?.data || err.stack,
    });
    return {
      contextDocs: [],
      errors,
      currentNode: "retrieveKnowledge",
    };
  }
}

// =======================
// 6) Nodo: LLM (respuesta final con contexto)
// =======================

async function llmCall(state) {
  const userText = getLastUserMessageText(state.messages);
  const specialty = state.classifiedSpecialty;

  const specialtyLine = specialty
    ? `Especialidad detectada: ${specialty.id} - ${specialty.nombre} (confianza: ${specialty.confidence.toFixed(
        2
      )}).`
    : "No se pudo clasificar la especialidad de la consulta.";

  const isLaboral =
    specialty &&
    typeof specialty.nombre === "string" &&
    specialty.nombre.toLowerCase().includes("laboral");

  const scopeWarning = isLaboral
    ? `
Te especializas en Derecho Laboral peruano.
- Usa los documentos proporcionados en el contexto como principal base.
- Si el contexto no es suficiente, di explícitamente tus límites.
`.trim()
    : `
LEGALBOT está especializado principalmente en Derecho Laboral peruano.
- Si la consulta es de otra área (${specialty?.nombre ?? "desconocida"}), puedes dar una respuesta general SOLO si el contexto lo permite.
- Siempre debes:
  - Aclarar que tu especialidad principal es laboral.
  - Recomendar que la persona consulte a un abogado especialista en el área detectada.
`.trim();

  const contextText =
    (state.contextDocs ?? [])
      .map(
        (doc, i) =>
          `# Fragmento ${i + 1}\n${doc.text ?? doc.content ?? ""}`
      )
      .join("\n\n") || "No hay documentos relevantes disponibles.";

  const systemPrompt = `
Eres LegalBot, un asistente jurídico IA integrado a una plataforma real de abogados en Perú.

${specialtyLine}

${scopeWarning}

Reglas:
- Basa tus respuestas en el contexto proporcionado (fragmentos de documentos).
- Si el contexto no tiene información suficiente, dilo con claridad.
- No inventes artículos, sentencias o montos.
- No inventes nombres de normas ni números de artículos.
- Indica siempre que tu respuesta es orientativa y no reemplaza la asesoría de un abogado.
- Responde en un lenguaje claro y respetuoso, adaptado a ciudadanos peruanos no especialistas.
`.trim();

  const userPrompt = `
Consulta del usuario:
"""
${userText}
"""

Contexto legal relevante:
${contextText}
`.trim();

  const { text: rawAnswer, latencyMs } = await callLlama(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, stream: false }
  );

  const messageText = normalizeMessageContent(rawAnswer);
  const aiMsg = new AIMessage(messageText);

  return {
    messages: [aiMsg],
    llmCalls: (state.llmCalls || 0) + 1,
    currentNode: "llmCall",
    latencies: {
      ...(state.latencies || {}),
      llmMs: latencyMs,
    },
  };
}

// =======================
// 6.1) Nodo: LLM cuando NO hay contexto de Qdrant
// =======================

async function llmCallNoContext(state) {
  const userText = getLastUserMessageText(state.messages);
  const specialty = state.classifiedSpecialty;

  const specialtyLine = specialty
    ? `Especialidad detectada (sin contexto documental): ${specialty.id} - ${specialty.nombre} (confianza: ${specialty.confidence.toFixed(
        2
      )}).`
    : "No se pudo clasificar la especialidad de la consulta (sin contexto documental).";

  const systemPrompt = `
Eres LegalBot, un asistente jurídico IA integrado a una plataforma real de abogados en Perú.

${specialtyLine}

Importante:
- En esta consulta NO tienes acceso a documentos de contexto (Qdrant no devolvió resultados).
- Sólo puedes dar una orientación GENERAL, basada en principios jurídicos amplios.
- Debes ser muy claro en indicar que NO cuentas con el expediente ni con normas específicas cargadas.
- No inventes artículos, normas ni montos.
- Indica siempre que tu respuesta es orientativa y no reemplaza la asesoría de un abogado.
`.trim();

  const userPrompt = `
Consulta del usuario:
"""
${userText}
"""

Contexto:
No hay documentos relevantes disponibles en la base de conocimiento para esta consulta.
`.trim();

  const { text: rawAnswer, latencyMs } = await callLlama(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, stream: false }
  );

  const messageText = normalizeMessageContent(rawAnswer);
  const aiMsg = new AIMessage(messageText);

  return {
    messages: [aiMsg],
    llmCalls: (state.llmCalls || 0) + 1,
    currentNode: "llmCallNoContext",
    latencies: {
      ...(state.latencies || {}),
      llmMs: latencyMs,
    },
  };
}

// =======================
// 6.2) Nodo: pedir aclaración al usuario (baja confianza)
// =======================

async function clarifyQuestionNode(state) {
  const userText = getLastUserMessageText(state.messages);
  const specialty = state.classifiedSpecialty;
  const wantsDocument = !!state.documentIntent?.wantsDocument;

  let clarificationText;

  if (wantsDocument) {
    clarificationText = `
Entiendo que deseas que te ayude a generar un documento jurídico relacionado con "${specialty?.nombre ?? "tu caso"}".

Para poder armar un borrador útil, por favor indícame:

1) Datos de la persona involucrada (si aplica):
   - Nombre completo
   - DNI
   - Cargo o relación (trabajador, cliente, usuario, etc.)
   - Nombre de la empresa o entidad, si corresponde

2) Datos de la contraparte:
   - Razón social / nombre
   - RUC (si lo tienes)
   - Ciudad o lugar

3) Hechos principales:
   - ¿Qué pasó exactamente?
   - ¿Desde cuándo?
   - ¿Qué documentos tienes (contrato, boletas, cartas, correos, resoluciones)?

Con esa información podré acercarme mucho más a un modelo de documento que luego deberá revisar un abogado.
`.trim();
  } else if (specialty) {
    clarificationText = `
He detectado que tu consulta podría estar relacionada con "${specialty.nombre}", pero la información aún es muy general.

Para orientarte mejor, por favor dime brevemente:
- ¿Qué pasó exactamente? (hechos principales)
- ¿Hace cuánto tiempo ocurrió?
- ¿Qué documentos o comunicaciones tienes (contrato, carta, correo, resolución, etc.)?

Con esos datos podré darte una respuesta más útil y ajustada a tu caso.
`.trim();
  } else {
    clarificationText = `
Necesito un poco más de detalle sobre tu consulta legal para poder ayudarte mejor.

Por favor cuéntame brevemente:
- ¿Qué problema concreto estás enfrentando?
- ¿Con quién es el problema? (empleador, entidad pública, banco, etc.)
- ¿Qué documento o situación específica quieres entender o resolver?

Con esa información podré orientarte con más precisión.
`.trim();
  }

  const aiMsg = new AIMessage(clarificationText);

  return {
    messages: [aiMsg],
    currentNode: "clarifyQuestion",
  };
}

// =======================
// 6.3) Nodo nuevo: generación de borrador de documento
// =======================

async function draftDocumentNode(state) {
  const userText = getLastUserMessageText(state.messages);
  const specialty = state.classifiedSpecialty;
  const tipoDocumento = state.documentIntent?.tipoDocumento || "documento_juridico";
  const caseData = state.caseData || {};
  const docs = state.contextDocs || [];

  // Elegir plantilla base
  let templateText = state.selectedTemplate?.text;
  let templateSource = state.selectedTemplate?.source;
  let templateId = state.selectedTemplate?.id;

  if ((!templateText || !templateText.trim()) && docs.length > 0) {
    const first = docs[0];
    templateText = first.text || "";
    templateSource = first.source;
    templateId = first.id || "";
  }

  const systemPrompt = `
Eres LegalBot, un asistente jurídico IA en Perú.
Tu tarea es GENERAR UN DOCUMENTO JURÍDICO en formato borrador.

Tipo de documento: ${tipoDocumento}
Especialidad: ${specialty?.nombre ?? "no clasificada"}

Debes:
- Usar la plantilla dada como referencia principal de estructura y tono.
- Insertar los datos del caso en los lugares adecuados.
- Si falta algún dato esencial, dejar un marcador claro: [DATO PENDIENTE].
- No inventar artículos, montos ni fechas exactas que no estén en el caso.
- Mantener un lenguaje formal, respetuoso y claro.
- Considera que este borrador DEBE SER REVISADO por un abogado antes de usarse.
`.trim();

  const userPrompt = `
PLANTILLA BASE:
"""
${templateText || "SIN PLANTILLA ESPECÍFICA"}
"""

DATOS DEL CASO (JSON):
${JSON.stringify(caseData, null, 2)}

DESCRIPCIÓN LIBRE DEL USUARIO:
"""
${userText}
"""
`.trim();

  const { text: rawAnswer, latencyMs } = await callLlama(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1, stream: false }
  );

  const messageText = normalizeMessageContent(rawAnswer);
  const aiMsg = new AIMessage(messageText);

  const newSelectedTemplate =
    templateText && templateText.trim()
      ? {
          id: templateId || "",
          text: templateText,
          source: templateSource,
        }
      : state.selectedTemplate;

  return {
    messages: [aiMsg],
    selectedTemplate: newSelectedTemplate,
    llmCalls: (state.llmCalls || 0) + 1,
    currentNode: "draftDocument",
    latencies: {
      ...(state.latencies || {}),
      llmMs: latencyMs,
    },
  };
}

// =======================
// 6.4) Nuevos nodos: complejidad, riesgo e intake
// =======================

// Evaluar la complejidad del caso en función de varias señales: número de
// citas normativas, longitud de los documentos de contexto y cantidad de
// campos presentes en la estructura de datos del caso.
async function assessComplexityNode(state) {
  const docs = state.contextDocs || [];
  let normativeCount = 0;
  let totalLength = 0;
  docs.forEach((doc) => {
    const text = doc.text || "";
    totalLength += text.length;
    normativeCount += countNormativeCitations(text);
  });
  const caseData = state.caseData || {};
  const fieldCount = countFields(caseData);
  let complexity = "baja";
  if (normativeCount > 8 || totalLength > 10000 || fieldCount > 6) {
    complexity = "alta";
  } else if (normativeCount > 3 || totalLength > 3000 || fieldCount > 3) {
    complexity = "media";
  }
  return {
    complexity,
    currentNode: "assessComplexity",
  };
}

// Evaluar el nivel de riesgo del caso a partir de la especialidad clasificada
async function assessRiskNode(state) {
  const specialtyName = state.classifiedSpecialty?.nombre?.toLowerCase() || "";
  const docs = state.contextDocs || [];
  let normativeCount = 0;
  docs.forEach((doc) => {
    normativeCount += countNormativeCitations(doc.text || "");
  });
  const fieldCount = countFields(state.caseData || {});
  let risk = "bajo";
  // Considerar especialidades sensibles como riesgo alto
  if (/(penal|tributario|ambiental)/i.test(specialtyName)) {
    risk = "alto";
  } else if (normativeCount > 10 || fieldCount > 6) {
    risk = "alto";
  } else if (/(civil|laboral|administrativo)/i.test(specialtyName)) {
    risk = "medio";
  } else if (normativeCount > 5 || fieldCount > 3) {
    risk = "medio";
  }
  return {
    risk,
    currentNode: "assessRisk",
  };
}

// Construir un esquema de intake basado en el tipo de documento
async function buildIntakeSchemaNode(state) {
  const tipoDoc = state.documentIntent?.tipoDocumento;
  // Definir campos requeridos por tipo de documento. Se pueden ampliar según necesidades
  const requiredMap = {
    carta_de_renuncia: [
      "hechosRelevantes",
      "fechaHechos",
      "contraparte",
    ],
    demanda_laboral: [
      "hechosRelevantes",
      "fechaHechos",
      "contraparte",
      "datosTrabajador.nombreCompleto",
      "datosTrabajador.dni",
      "datosTrabajador.empresa",
    ],
  };
  const requiredFields = requiredMap[tipoDoc] || [];
  const caseData = state.caseData || {};
  // Identificar qué campos están vacíos en el caseData
  const missingFields = requiredFields.filter((field) => !getField(caseData, field));
  // Determinar estado de la información
  let infoStatus = "ready";
  if (requiredFields.length && missingFields.length) {
    infoStatus = "incomplete";
  } else if (!requiredFields.length) {
    infoStatus = state.infoStatus || "unknown";
  }
  return {
    requiredFields,
    missingFields,
    infoStatus,
    currentNode: "buildIntakeSchema",
  };
}

// Auto-enriquecer los datos del caso utilizando los documentos recuperados
async function autoEnrichCaseDataNode(state) {
  let caseData = state.caseData || {};
  const requiredFields = state.requiredFields || [];
  let missing = state.missingFields;
  // Recalcular campos faltantes si no se proporcionaron
  if (!Array.isArray(missing) || !missing.length) {
    missing = requiredFields.filter((field) => !getField(caseData, field));
  }

  // Si hay campos faltantes, intentar inferirlos a partir del último mensaje
  if (missing && missing.length) {
    try {
      const lastUser = getLastUserMessageText(state.messages) || "";
      // Construir un prompt claro para que el modelo extraiga solo los campos requeridos
      const systemPrompt = `Eres un asistente jurídico. Debes extraer información específica del texto del usuario. Responde exclusivamente con un objeto JSON que contenga los campos solicitados si pueden inferirse, o déjalos en null. No añadas explicaciones.`;
      const userPrompt = `Texto del usuario:\n"""\n${lastUser}\n"""\n\nCampos a extraer: ${missing.join(", ")}. Devuelve sólo JSON con estos campos.`;

      const { text: raw, latencyMs } = await callLlama(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        { temperature: 0, max_tokens: 512 }
      );
      const jsonText = extractJsonFromText(raw);
      const parsed = safeParseJson(jsonText);
      if (parsed.ok) {
        const extracted = parsed.value;
        // Mezclar los valores extraídos en caseData
        for (const key of Object.keys(extracted || {})) {
          const value = extracted[key];
          if (value !== undefined && value !== null && String(value).trim()) {
            // Asignar en estructura anidada si el campo incluye "puntos"
            if (key.includes(".")) {
              const parts = key.split(".");
              let target = caseData;
              while (parts.length > 1) {
                const k = parts.shift();
                if (!target[k] || typeof target[k] !== "object") {
                  target[k] = {};
                }
                target = target[k];
              }
              target[parts[0]] = value;
            } else {
              caseData[key] = value;
            }
          }
        }
      }
      // Actualizar latencias y contador de llamadas
      const llmCalls = (state.llmCalls || 0) + 1;
      const latencies = {
        ...(state.latencies || {}),
        llmMs: ((state.latencies?.llmMs || 0) + (latencyMs || 0)),
      };
      // Recalcular campos faltantes
      missing = requiredFields.filter((field) => !getField(caseData, field));
      const infoStatus = missing.length ? "incomplete" : "ready";
      return {
        caseData,
        missingFields: missing,
        infoStatus,
        llmCalls,
        latencies,
        currentNode: "autoEnrichCaseData",
      };
    } catch (err) {
      // En caso de error, registrar e intentar continuar
      const errors = addError(state, {
        step: "autoEnrichCaseData",
        message: err.message || String(err),
      });
      return {
        caseData,
        missingFields: missing,
        infoStatus: missing.length ? "incomplete" : "ready",
        errors,
        currentNode: "autoEnrichCaseData",
      };
    }
  }
  // Si no hay campos faltantes, regresar sin cambios
  return {
    caseData,
    missingFields: missing,
    infoStatus: missing && missing.length ? "incomplete" : state.infoStatus || "ready",
    currentNode: "autoEnrichCaseData",
  };
}

// Anonimizar datos sensibles (p.ej. números de DNI, teléfonos) antes de
// procesar o almacenar la información del caso. Reemplaza secuencias de
// ocho o más dígitos por un marcador de asteriscos.
async function anonymizeSensitiveDataNode(state) {
  const maskNumeric = (value) => {
    if (typeof value !== "string") return value;
    return value.replace(/\b\d{8,}\b/g, (m) => "*".repeat(m.length));
  };
  const anonymizeObj = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    const result = Array.isArray(obj) ? [] : {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string") {
        result[key] = maskNumeric(val);
      } else if (val && typeof val === "object") {
        result[key] = anonymizeObj(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };
  const newCaseData = anonymizeObj(state.caseData || {});
  return {
    caseData: newCaseData,
    currentNode: "anonymizeSensitiveData",
  };
}

// Crear un esqueleto de documento a partir de las secciones presentes en los documentos recuperados
async function buildStructureFromDocsNode(state) {
  const docs = state.contextDocs || [];
  const sections = {};
  const sectionNames = ["ENCABEZADO", "VISTO", "CONSIDERANDO", "RESUELVE"];
  docs.forEach((doc) => {
    const text = (doc.text || "").trim();
    let matched = false;
    sectionNames.forEach((sec) => {
      if (text.toUpperCase().includes(sec)) {
        sections[sec] = (sections[sec] || "") + "\n" + text;
        matched = true;
      }
    });
    if (!matched) {
      sections["OTROS"] = (sections["OTROS"] || "") + "\n" + text;
    }
  });
  return {
    structure: sections,
    currentNode: "buildStructureFromDocs",
  };
}

// Rellenar la plantilla con los datos del caso y el esqueleto generado
async function fillTemplateWithCaseDataNode(state) {
  const structure = state.structure || {};
  const caseData = state.caseData || {};
  let content = "";
  Object.entries(structure).forEach(([sec, text]) => {
    content += `\n### ${sec}\n${text}`;
  });
  // Placeholder: en el futuro se reemplazarán marcadores con los datos de caseData
  return {
    filledTemplate: content.trim(),
    currentNode: "fillTemplateWithCaseData",
  };
}

// Esperar revisión humana del borrador. Por ahora, se marca como revisado inmediatamente
async function waitForUserReviewNode(state) {
  const needsReview = state.needsHumanReview ?? false;
  const action = state.humanReviewAction || null;
  if (!needsReview) {
    return {
      currentNode: "waitForUserReview",
    };
  }
  // Si el usuario revisó, registramos la acción
  return {
    needsHumanReview: false,
    humanReviewAction: action,
    currentNode: "waitForUserReview",
  };
}

// Finalizar el documento tras la revisión. Añade el borrador completado a la lista de mensajes
async function finalizeDocumentNode(state) {
  const finalText = state.filledTemplate || "";
  const aiMsg = new AIMessage(finalText);
  const docVersions = state.docVersions || [];
  const newVersion = {
    version: `v${(docVersions.length || 0) + 1}`,
    content: finalText,
    timestamp: new Date().toISOString(),
  };
  return {
    messages: (state.messages || []).concat(aiMsg),
    docVersions: docVersions.concat(newVersion),
    currentNode: "finalizeDocument",
  };
}

// Comprobar alucinaciones: placeholder para verificación de consistencia
async function checkForHallucinationsNode(state) {
  try {
    // Tomar el borrador generado más reciente. Puede provenir de filledTemplate o del último mensaje del AI
    let draft = state.filledTemplate || "";
    if (!draft) {
      const aiMessages = (state.messages || []).filter((m) => m.role === "ai");
      const lastAi = aiMessages[aiMessages.length - 1];
      draft = lastAi ? normalizeMessageContent(lastAi.content) : "";
    }
    // Si no hay borrador, no hay nada que revisar
    if (!draft) {
      return {
        currentNode: "checkForHallucinations",
      };
    }
    // Construir contexto con los primeros tres documentos recuperados
    const docs = state.contextDocs || [];
    const contextSnippet = docs.slice(0, 3).map((d) => d.text || "").join("\n\n");
    const systemPrompt = `Eres un abogado revisor. Debes analizar un borrador y compararlo con el contexto autorizado. Tu tarea es eliminar del borrador cualquier afirmación que no esté respaldada por el contexto proporcionado. Devuelve únicamente el borrador corregido, en español.`;
    const userPrompt = `Borrador a revisar:\n"""\n${draft}\n"""\n\nContexto autorizado:\n"""\n${contextSnippet}\n"""`;
    const { text: corrected, latencyMs } = await callLlama(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { temperature: 0 }
    );
    const correctedText = corrected.trim();
    // Añadir un mensaje AI con el texto corregido
    const aiMsg = new AIMessage(correctedText);
    const updatedMessages = (state.messages || []).concat(aiMsg);
    const llmCalls = (state.llmCalls || 0) + 1;
    const latencies = {
      ...(state.latencies || {}),
      llmMs: ((state.latencies?.llmMs || 0) + (latencyMs || 0)),
    };
    return {
      messages: updatedMessages,
      llmCalls,
      latencies,
      currentNode: "checkForHallucinations",
    };
  } catch (err) {
    const errors = addError(state, {
      step: "checkForHallucinations",
      message: err.message || String(err),
    });
    return {
      errors,
      currentNode: "checkForHallucinations",
    };
  }
}

// Eliminar afirmaciones sin soporte: placeholder para limpiar el texto
async function stripUnsupportedClaimsNode(state) {
  return {
    currentNode: "stripUnsupportedClaims",
  };
}

// =======================
// 7) Construir el Graph
// =======================

const workflow = new StateGraph(LegalBotState)
  // Nodos
  .addNode("classifyQuestion", classifyQuestionNode, {
    retryPolicy: { maxAttempts: 2, initialInterval: 0.5 },
  })
  .addNode("detectIntent", detectIntentNode)
  .addNode("retrieveKnowledge", retrieveKnowledgeNode, {
    retryPolicy: { maxAttempts: 3, initialInterval: 0.5 },
  })
  .addNode("llmCall", llmCall, {
    retryPolicy: { maxAttempts: 2, initialInterval: 1.0 },
  })
  .addNode("llmCallNoContext", llmCallNoContext, {
    retryPolicy: { maxAttempts: 2, initialInterval: 1.0 },
  })
  .addNode("clarifyQuestion", clarifyQuestionNode)
  .addNode("draftDocument", draftDocumentNode, {
    retryPolicy: { maxAttempts: 2, initialInterval: 1.0 },
  })
  // Nuevos nodos para manejo avanzado del flujo de documentos
  .addNode("assessComplexity", assessComplexityNode)
  .addNode("assessRisk", assessRiskNode)
  .addNode("buildIntakeSchema", buildIntakeSchemaNode)
  .addNode("autoEnrichCaseData", autoEnrichCaseDataNode)
  .addNode("anonymizeSensitiveData", anonymizeSensitiveDataNode)
  .addNode("buildStructureFromDocs", buildStructureFromDocsNode)
  .addNode("fillTemplateWithCaseData", fillTemplateWithCaseDataNode)
  .addNode("waitForUserReview", waitForUserReviewNode)
  .addNode("finalizeDocument", finalizeDocumentNode)
  .addNode("checkForHallucinations", checkForHallucinationsNode)
  .addNode("stripUnsupportedClaims", stripUnsupportedClaimsNode)
  // Flujo inicial
  .addEdge(START, "classifyQuestion")
  // Condicional después de clasificar
  .addConditionalEdges(
    "classifyQuestion",
    (state) => {
      const cls = state.classifiedSpecialty;
      if (!cls) return "noSpecialty";
      if (typeof cls.confidence === "number" && cls.confidence < 0.3) {
        return "lowConfidence";
      }
      return "ok";
    },
    {
      ok: "detectIntent",          // antes iba directo a retrieveKnowledge
      lowConfidence: "clarifyQuestion",
      noSpecialty: "detectIntent", // si no clasifica igual intentamos detectar intención
    }
  )
  // De detectar intención pasamos siempre a retrieveKnowledge
  .addEdge("detectIntent", "retrieveKnowledge")
  // Desde recuperar conocimiento se evalúa la complejidad y el riesgo
  .addEdge("retrieveKnowledge", "assessComplexity")
  .addEdge("assessComplexity", "assessRisk")
  // Condicional después de evaluar riesgo y decidir el flujo
  .addConditionalEdges(
    "assessRisk",
    (state) => {
      const docs = state.contextDocs || [];
      const hasDocs = Array.isArray(docs) && docs.length > 0;
      const wantsDoc = !!state.documentIntent?.wantsDocument;
      const mode = state.mode;
      const complexity = state.complexity;
      const risk = state.risk;
      const docFlowDesired = wantsDoc || mode === "doc_assistant" || mode === "intake_only";
      const allowDocFlow = (!complexity || complexity !== "alta") && (!risk || risk !== "alto");
      if (docFlowDesired && allowDocFlow) {
        return hasDocs ? "hasContextDoc" : "noContextDoc";
      }
      return hasDocs ? "hasContext" : "noContext";
    },
    {
      // Flujos de QA
      hasContext: "llmCall",
      noContext: "llmCallNoContext",
      // Flujos de documento
      hasContextDoc: "buildIntakeSchema",
      noContextDoc: "llmCallNoContext",
    }
  )
  // Flujo de intake y documento
  .addEdge("buildIntakeSchema", "autoEnrichCaseData")
  .addEdge("autoEnrichCaseData", "anonymizeSensitiveData")
  .addEdge("anonymizeSensitiveData", "buildStructureFromDocs")
  .addEdge("buildStructureFromDocs", "fillTemplateWithCaseData")
  .addEdge("fillTemplateWithCaseData", "draftDocument")
  .addEdge("draftDocument", "waitForUserReview")
  .addEdge("waitForUserReview", "finalizeDocument")
  .addEdge("finalizeDocument", "checkForHallucinations")
  .addEdge("checkForHallucinations", "stripUnsupportedClaims")
  .addEdge("stripUnsupportedClaims", END)
  // Finales para flujos QA
  .addEdge("llmCall", END)
  .addEdge("llmCallNoContext", END)
  .addEdge("clarifyQuestion", END);

const memory = new MemorySaver();
const legalbotApp = workflow.compile({ checkpointer: memory });

// =======================
// 8) Controller Express
// =======================

async function legalbotChat(req, res) {
  try {
    const { message, threadId, mode } = req.body;
    // Validar que exista el mensaje
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Falta el campo 'message' (string) en el body." });
    }

    // Generar identificador de solicitud y de hilo
    const requestId = req.headers["x-request-id"] || randomUUID();
    const resolvedThreadId = threadId || requestId || randomUUID();

    // Estado inicial del flujo
    const initialState = {
      messages: [new HumanMessage(message)],
      requestId,
      // Transferir el modo de operación si se proporcionó
      mode: typeof mode === "string" ? mode : undefined,
    };
    const config = { configurable: { thread_id: resolvedThreadId } };

    // Utilizar streaming para procesar el grafo y obtener actualizaciones intermedias
    const events = [];
    let resultState = null;
    for await (const update of legalbotApp.stream(initialState, config, { stream_mode: "values" })) {
      resultState = update;
      events.push(update);
    }

    if (!resultState) {
      throw new Error("No se pudo obtener un estado final de la ejecución del grafo.");
    }

    const allMessages = resultState.messages || [];
    const last = allMessages[allMessages.length - 1] || null;
    const answer = last ? normalizeMessageContent(last.content) : "";

    return res.json({
      reply: answer,
      contextDocs: resultState.contextDocs || [],
      classifiedSpecialty: resultState.classifiedSpecialty || null,
      documentIntent: resultState.documentIntent || null,
      caseData: resultState.caseData || null,
      selectedTemplate: resultState.selectedTemplate || null,
      infoStatus: resultState.infoStatus || null,
      errors: resultState.errors || [],
      threadId: resolvedThreadId,
      currentNode: resultState.currentNode || null,
      latencies: resultState.latencies || {},
      complexity: resultState.complexity || null,
      risk: resultState.risk || null,
      structure: resultState.structure || null,
      filledTemplate: resultState.filledTemplate || null,
      docVersions: resultState.docVersions || [],
      mode: resultState.mode || null,
      // Devuelve los eventos acumulados en el streaming para mayor trazabilidad
      events,
    });
  } catch (err) {
    console.error("[LegalBot][HTTP] Error:", err);
    return res.status(500).json({
      error: "Error interno procesando la consulta de LegalBot.",
    });
  }
}

module.exports = {
  legalbotApp,
  legalbotChat,
};
