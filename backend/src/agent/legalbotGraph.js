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

  // Métrica simple
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

  // 🔹 Resultado de clasificación de especialidad
  classifiedSpecialty: z
    .object({
      id: z.number(),
      nombre: z.string(),
      confidence: z.number(), // 0–1
      justificacion: z.string().optional(),
    })
    .optional(),
});

// =======================
// 1.1 Especialidades + esquema de clasificación
// =======================

// Si lo prefieres, este JSON se puede extraer a un archivo externo y hacer require(...)
const SPECIALTIES = [
  {"id":1,"nombre":"Derecho Penal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":2,"nombre":"Derecho Civil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":3,"nombre":"Derecho de Familia","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":4,"nombre":"Derecho Laboral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":5,"nombre":"Derecho Empresarial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":6,"nombre":"Derecho Administrativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":7,"nombre":"Derecho Tributario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":8,"nombre":"Derecho Constitucional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":9,"nombre":"Derecho Mercantil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":10,"nombre":"Derecho Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[{"id":2}]},
  {"id":11,"nombre":"Derecho Internacional Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":12,"nombre":"Derecho Internacional Privado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":13,"nombre":"Derecho Procesal Penal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":14,"nombre":"Derecho Procesal Civil","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":15,"nombre":"Litigación Oral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":16,"nombre":"Arbitraje y Métodos Alternativos de Resolución de Conflictos (mediación, conciliación, negociación)","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":17,"nombre":"Compliance y Ética Corporativa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":18,"nombre":"Prevención de Lavado de Activos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":19,"nombre":"Protección de Datos Personales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":20,"nombre":"Ciberseguridad y Derecho Tecnológico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":21,"nombre":"Blockchain y Criptoactivos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":22,"nombre":"Derecho de Protección al Consumidor","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":23,"nombre":"Derechos Humanos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":24,"nombre":"Derecho Registral y Notarial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":25,"nombre":"Derecho de Seguros","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":26,"nombre":"Derecho de Sucesiones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":27,"nombre":"Derecho Matrimonial Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":28,"nombre":"Derecho de Filiación Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":29,"nombre":"Derecho de Adopción Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":30,"nombre":"Derecho de Propiedad Intelectual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":31,"nombre":"Derecho de la Competencia","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":32,"nombre":"Derecho de la Empresa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":33,"nombre":"Derecho Societario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":34,"nombre":"Derecho de Contrataciones y Adquisiciones del Estado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":35,"nombre":"Derecho de Responsabilidad Civil Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":36,"nombre":"Derecho de las Obligaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":37,"nombre":"Derecho de los Bienes","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":38,"nombre":"Derecho de las Personas Jurídicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":39,"nombre":"Derecho de la Nacionalidad","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":40,"nombre":"Derecho Bancario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":41,"nombre":"Derecho Financiero","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":42,"nombre":"Derecho de Energía y Minas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":43,"nombre":"Derecho Agrario","consulta":[],"formatos":[],"perfiles_especialidad":[{"id":1}]},
  {"id":44,"nombre":"Derecho Municipal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":45,"nombre":"Derecho Electoral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":46,"nombre":"Derecho Migratorio","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":47,"nombre":"Derecho de la Construcción","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":48,"nombre":"Derecho de Concesiones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":49,"nombre":"Derecho Aduanero","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":50,"nombre":"Derecho Internacional Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":51,"nombre":"Derecho Internacional Humanitario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":52,"nombre":"Derecho Procesal Administrativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":53,"nombre":"Derecho Procesal Constitucional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":54,"nombre":"Derecho Procesal Laboral","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":55,"nombre":"Derecho Penal Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":56,"nombre":"Derecho Penal Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":57,"nombre":"Derecho Penal Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":58,"nombre":"Derecho Penal Tributario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":59,"nombre":"Derecho Penal Corporativo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":60,"nombre":"Derecho Penal de Lavado de Activos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":61,"nombre":"Derecho Penal de Delitos Informáticos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":62,"nombre":"Derecho Tributario Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":63,"nombre":"Contratación Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":64,"nombre":"Regulación de Servicios Públicos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":65,"nombre":"Derecho de Recursos Naturales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":66,"nombre":"Derecho del Mar","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":67,"nombre":"Derecho Administrativo Sancionador","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":68,"nombre":"Derecho Administrativo Disciplinario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":69,"nombre":"Derecho Administrativo Global","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":70,"nombre":"Derecho Administrativo Electrónico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":71,"nombre":"Derecho Parlamentario","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":72,"nombre":"Derecho Público y Buen Gobierno","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":73,"nombre":"Políticas Públicas y Derecho Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":74,"nombre":"Justicia Militar","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":75,"nombre":"Derecho y Género","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":76,"nombre":"Derecho y Diversidad Sexual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":77,"nombre":"Bioética Jurídica","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":78,"nombre":"Publicidad y Reprensión de la Competencia Desleal","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":79,"nombre":"Derecho Socioambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":80,"nombre":"Derecho de Impacto Ambiental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":81,"nombre":"Derecho de Minería","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":82,"nombre":"Derecho de Hidrocarburos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":83,"nombre":"Derecho Eléctrico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":84,"nombre":"Derecho de Transportes","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":85,"nombre":"Derecho de Comunicaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":86,"nombre":"Derecho de Comercio Exterior","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":87,"nombre":"Comercio Exterior y Negociaciones Internacionales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":88,"nombre":"Derecho de Dumping y Subsidios","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":89,"nombre":"Derecho de Resolución de Conflictos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":90,"nombre":"Derecho de Mediación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":91,"nombre":"Derecho de Conciliación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":92,"nombre":"Derecho de Negociación","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":93,"nombre":"Derecho Judicial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":94,"nombre":"Derecho de Contratos Internacionales","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":95,"nombre":"Derecho de la Lex Mercatoria","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":96,"nombre":"Derecho de Fundaciones y Asociaciones","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":97,"nombre":"Derecho Canónico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":98,"nombre":"Derecho de las Tecnologías de Información","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":99,"nombre":"Análisis Económico del Derecho","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":100,"nombre":"Derecho de Abastecimiento Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":101,"nombre":"Derecho de Planeamiento y Presupuesto Público","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":102,"nombre":"Derecho de Gestión de Inversiones Públicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":103,"nombre":"Derecho de Recursos Humanos Públicos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":104,"nombre":"Derecho de Control Gubernamental","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":105,"nombre":"Derecho de Eliminación de Barreras Burocráticas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":106,"nombre":"Derecho de Simplificación Administrativa","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":107,"nombre":"Derecho de Propiedad Industrial","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":108,"nombre":"Derecho Autor y Derechos Sui Generis","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":109,"nombre":"Derecho Bancario y Financiero Internacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":110,"nombre":"Derecho del Consumidor Digital","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":111,"nombre":"Derecho Penal de Crimen Organizado","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":112,"nombre":"Derecho Penal de Corrupción","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":113,"nombre":"Derecho Penal de Terrorismo","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":114,"nombre":"Derecho Penal de Narcotráfico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":115,"nombre":"Derecho Penal de Delitos Financieros","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":116,"nombre":"Derecho Penal de Delitos contra la Administración Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":117,"nombre":"Derecho Penal de Delitos contra el Patrimonio","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":118,"nombre":"Derecho Penal de Delitos contra la Vida, el Cuerpo y la Salud","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":119,"nombre":"Derecho Penal de Delitos contra la Libertad Sexual","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":120,"nombre":"Derecho Penal de Delitos contra el Orden Económico","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":121,"nombre":"Derecho Penal de Delitos contra la Seguridad Pública","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":122,"nombre":"Derecho Penal de Delitos contra el Medio Ambiente","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":123,"nombre":"Derecho Penal de Delitos contra la Paz y la Humanidad","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":124,"nombre":"Derecho Penal de Delitos contra la Seguridad Nacional","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":125,"nombre":"Derecho Penal de Delitos contra el Sistema de Contrataciones Públicas","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":126,"nombre":"Derecho Penal de Delitos contra el Sistema de Protección de Datos","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":127,"nombre":"Derecho Penal de Delitos contra la Seguridad Informática","consulta":[],"formatos":[],"perfiles_especialidad":[]},
  {"id":128,"nombre":"Derecho Penal de Delitos contra el Blockchain y Criptoactivos","consulta":[],"formatos":[],"perfiles_especialidad":[]}
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
        Number(process.env.EMBEDDINGS_TIMEOUT_MS) || Number(process.env.QDRANT_TIMEOUT_MS) || 20000,
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
      const backoff = (Number(process.env.EMBEDDINGS_BACKOFF_MS) || 300) * attempt;
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

async function searchInQdrant(vector, state, attempt = 1) {
  const baseUrl = process.env.QDRANT_URL;
  const collection = process.env.QDRANT_COLLECTION;

  if (!baseUrl || !collection) {
    throw new Error(
      "QDRANT_URL o QDRANT_COLLECTION no están definidos en .env"
    );
  }

  const payload = {
    vector: normalizeVector(vector),
    limit: 8,
    with_payload: true,
    with_vector: false,
  };

   if (!Array.isArray(payload.vector) || payload.vector.length === 0) {
    const err = new Error("Embedding no válido para Qdrant (vector vacío)");
    err.step = "embed";
    throw err;
  }

  const headers = {
    "Content-Type": "application/json",
    ...(process.env.QDRANT_API_KEY ? { "api-key": process.env.QDRANT_API_KEY } : {}),
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
          p.payload?.source ?? p.payload?.norma ?? p.payload?.file_name ?? "",
        score: p.score,
      })),
      latencyMs,
    };
  } catch (err) {
    const status = err.response?.status;
    const isPayloadError = status === 400;
    const isRetryable =
      err.code === "ECONNABORTED" || status === 429 || status >= 500 || err.response?.statusText === "Timeout";
    const maxAttempts = Number(process.env.QDRANT_MAX_ATTEMPTS) || 3;

    if (isPayloadError && attempt === 1) {
      const correctedPayload = { ...payload, vector: normalizeVector(vector) };
      return searchInQdrant(correctedPayload.vector, state, attempt + 1);
    }

    if (isRetryable && attempt < maxAttempts) {
      const backoff = (Number(process.env.QDRANT_BACKOFF_MS) || 500) * attempt;
      const jitter = Math.floor(Math.random() * 150);
      await new Promise((res) => setTimeout(res, backoff + jitter));
      return searchInQdrant(vector, state, attempt + 1);
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
  const errors = state.errors || [];
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
        errors,
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
            { temperature: 0, timeout: Number(process.env.CLASSIFY_TIMEOUT_MS) || 20000 }
          );
          const parsed = safeParseJson(repairText);
          if (parsed.ok) {
            const validation = SpecialtyClassificationSchema.safeParse(parsed.value);
            if (validation.success) {
              return {
                classifiedSpecialty: validation.data,
                errors: enhancedErrors,
              };
            }
          }
        } catch (repairError) {
          state = { ...state, errors: addError(state, {
            step: "classify",
            message: repairError.message || String(repairError),
            attempt: attempt + 0.5,
          }) };
        }
      } else {
        const heuristic = keywordFallbackClassification(userText);
        const finalClassification = classification || heuristic;
        const errorsWithFallback = finalClassification
          ? addError(
              { ...state, errors: enhancedErrors },
              {
                step: "classify",
                message: "Se aplicó clasificación heurística por fallos del modelo.",
                attempt: attempt + 0.9,
              }
            )
          : enhancedErrors;

        return {
          classifiedSpecialty: finalClassification || null,
          errors: errorsWithFallback,
        };
      }
    }
  }

  return {
    classifiedSpecialty: classification || null,
    errors,
    lastError,
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
    };
  }

  const question = normalizeMessageContent(lastUser.content);

  try {
    const { embedding, latencyMs: embedLatency } = await embedQuery(
      question,
      state
    );
    const { docs, latencyMs: qdrantLatency } = await searchInQdrant(
      embedding,
      state
    );

    if (!docs.length) {
      return {
        contextDocs: [],
        errors: addError(state, {
          step: "qdrant",
          message:
            "Qdrant no devolvió resultados relevantes para esta consulta.",
          latencyMs: qdrantLatency,
        }),
      };
    }

    return {
      contextDocs: docs,
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
    };
  }
}


// =======================
// 6) Nodo: LLM (respuesta final)
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

  const { text: rawAnswer } = await callLlama(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.2, stream: false }
  );

  const messageText = normalizeMessageContent(rawAnswer);
  const aiMsg = new AIMessage(messageText);

  // 🔹 Parche mínimo importante:
  //    devolvemos SOLO el nuevo mensaje. LangGraph lo agrega al historial
  //    usando MessagesZodMeta, evitando duplicar state.messages.
  return {
    messages: [aiMsg],
    llmCalls: (state.llmCalls || 0) + 1,
  };
}

// =======================
// 7) Construir el Graph
// =======================

const workflow = new StateGraph(LegalBotState)
  .addNode("classifyQuestion", classifyQuestionNode)
  .addNode("retrieveKnowledge", retrieveKnowledgeNode, {
    retryPolicy: { maxAttempts: 3, initialInterval: 0.5 },
  })
  .addNode("llmCall", llmCall, {
    retryPolicy: { maxAttempts: 2, initialInterval: 1.0 },
  })
  // Flujo
  .addEdge(START, "classifyQuestion")
  .addEdge("classifyQuestion", "retrieveKnowledge")
  .addEdge("retrieveKnowledge", "llmCall")
  .addEdge("llmCall", END);

const memory = new MemorySaver();
const legalbotApp = workflow.compile({ checkpointer: memory });

// =======================
// 8) Controller Express
// =======================

async function legalbotChat(req, res) {
  try {
    const { message, threadId } = req.body;

    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ error: "Falta el campo 'message' (string) en el body." });
    }

    const initialState = {
      messages: [new HumanMessage(message)],
      requestId: req.headers["x-request-id"] || randomUUID(),
    };

    // Si quieres conversaciones persistentes por usuario:
    // const userId = req.user?.id;
    // const config = { configurable: { thread_id: `user-${userId}` } };
    const resolvedThreadId = threadId || initialState.requestId || randomUUID();
    const config = { configurable: { thread_id: resolvedThreadId } };

    const resultState = await legalbotApp.invoke(initialState, config);

    const allMessages = resultState.messages || [];
    const last = allMessages[allMessages.length - 1] || null;
    const answer = last ? normalizeMessageContent(last.content) : "";

    return res.json({
  reply: answer,
  contextDocs: resultState.contextDocs || [],
  classifiedSpecialty: resultState.classifiedSpecialty || null,
  errors: resultState.errors || [],
  threadId: resolvedThreadId, // <-- este es el que realmente usaste
});

  } catch (err) {
    console.error("[LegalBot][HTTP] Error:", err);
    return res
      .status(500)
      .json({ error: "Error interno procesando la consulta de LegalBot." });
  }
}

module.exports = {
  legalbotApp,
  legalbotChat,
};
