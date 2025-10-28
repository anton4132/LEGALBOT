// scripts/seed-especialidades.mjs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Cambia a prisma.especialidades si tu modelo se llama en plural
const model = prisma.especialidad;

const NOMBRES_RAW = [
  "Derecho Penal",
  "Derecho Civil",
  "Derecho de Familia",
  "Derecho Laboral",
  "Derecho Empresarial",
  "Derecho Administrativo",
  "Derecho Tributario",
  "Derecho Constitucional",
  "Derecho Mercantil",
  "Derecho Ambiental",
  "Derecho Internacional Público",
  "Derecho Internacional Privado",
  "Derecho Procesal Penal",
  "Derecho Procesal Civil",
  "Litigación Oral",
  "Arbitraje y Métodos Alternativos de Resolución de Conflictos (mediación, conciliación, negociación)",
  "Compliance y Ética Corporativa",
  "Prevención de Lavado de Activos",
  "Protección de Datos Personales",
  "Ciberseguridad y Derecho Tecnológico",
  "Blockchain y Criptoactivos",
  "Derecho de Protección al Consumidor",
  "Derechos Humanos",
  "Derecho Registral y Notarial",
  "Derecho de Seguros",
  "Derecho de Sucesiones",
  "Derecho Matrimonial Internacional",
  "Derecho de Filiación Internacional",
  "Derecho de Adopción Internacional",
  "Derecho de Propiedad Intelectual",
  "Derecho de la Competencia",
  "Derecho de la Empresa",
  "Derecho Societario",
  "Derecho de Contrataciones y Adquisiciones del Estado",
  "Derecho de Responsabilidad Civil Internacional",
  "Derecho de las Obligaciones",
  "Derecho de los Bienes",
  "Derecho de las Personas Jurídicas",
  "Derecho de la Nacionalidad",
  "Derecho Bancario",
  "Derecho Financiero",
  "Derecho de Energía y Minas",
  "Derecho Agrario",
  "Derecho Municipal",
  "Derecho Electoral",
  "Derecho Migratorio",
  "Derecho de la Construcción",
  "Derecho de Concesiones",
  "Derecho Aduanero",
  "Derecho Internacional Económico",
  "Derecho Internacional Humanitario",
  "Derecho Procesal Administrativo",
  "Derecho Procesal Constitucional",
  "Derecho Procesal Laboral",
  "Derecho Penal Económico",
  "Derecho Penal Ambiental",
  "Derecho Penal Internacional",
  "Derecho Penal Tributario",
  "Derecho Penal Corporativo",
  "Derecho Penal de Lavado de Activos",
  "Derecho Penal de Delitos Informáticos",
  "Derecho Tributario Internacional",
  "Contratación Pública",
  "Regulación de Servicios Públicos",
  "Derecho de Recursos Naturales",
  "Derecho del Mar",
  "Derecho Administrativo Sancionador",
  "Derecho Administrativo Disciplinario",
  "Derecho Administrativo Global",
  "Derecho Administrativo Electrónico",
  "Derecho Parlamentario",
  "Derecho Público y Buen Gobierno",
  "Políticas Públicas y Derecho Público",
  "Justicia Militar",
  "Derecho y Género",
  "Derecho y Diversidad Sexual",
  "Bioética Jurídica",
  "Publicidad y Reprensión de la Competencia Desleal",
  "Derecho Socioambiental",
  "Derecho de Impacto Ambiental",
  "Derecho de Minería",
  "Derecho de Hidrocarburos",
  "Derecho Eléctrico",
  "Derecho de Transportes",
  "Derecho de Comunicaciones",
  "Derecho de Comercio Exterior",
  "Comercio Exterior y Negociaciones Internacionales",
  "Derecho de Dumping y Subsidios",
  "Derecho de Resolución de Conflictos",
  "Derecho de Mediación",
  "Derecho de Conciliación",
  "Derecho de Negociación",
  "Derecho Judicial",
  "Derecho de Contratos Internacionales",
  "Derecho de la Lex Mercatoria",
  "Derecho de Fundaciones y Asociaciones",
  "Derecho Canónico",
  "Derecho de las Tecnologías de Información",
  "Análisis Económico del Derecho",
  "Derecho de Abastecimiento Público",
  "Derecho de Planeamiento y Presupuesto Público",
  "Derecho de Gestión de Inversiones Públicas",
  "Derecho de Recursos Humanos Públicos",
  "Derecho de Control Gubernamental",
  "Derecho de Eliminación de Barreras Burocráticas",
  "Derecho de Simplificación Administrativa",
  "Derecho de Propiedad Industrial",
  "Derecho Autor y Derechos Sui Generis",
  "Derecho Bancario y Financiero Internacional",
  "Derecho del Consumidor Digital",
  "Derecho Penal de Crimen Organizado",
  "Derecho Penal de Corrupción",
  "Derecho Penal de Terrorismo",
  "Derecho Penal de Narcotráfico",
  "Derecho Penal de Delitos Financieros",
  "Derecho Penal de Delitos Informáticos",
  "Derecho Penal de Delitos contra la Administración Pública",
  "Derecho Penal de Delitos contra el Patrimonio",
  "Derecho Penal de Delitos contra la Vida, el Cuerpo y la Salud",
  "Derecho Penal de Delitos contra la Libertad Sexual",
  "Derecho Penal de Delitos contra el Orden Económico",
  "Derecho Penal de Delitos contra la Seguridad Pública",
  "Derecho Penal de Delitos contra el Medio Ambiente",
  "Derecho Penal de Delitos contra la Paz y la Humanidad",
  "Derecho Penal de Delitos contra la Seguridad Nacional",
  "Derecho Penal de Delitos contra el Sistema de Contrataciones Públicas",
  "Derecho Penal de Delitos contra el Sistema de Protección de Datos",
  "Derecho Penal de Delitos contra la Seguridad Informática",
  "Derecho Penal de Delitos contra el Blockchain y Criptoactivos",
];

// deduplicar por texto exacto (tu lista repite "Delitos Informáticos")
const NOMBRES = Array.from(new Set(NOMBRES_RAW.map(s => s.trim())));

async function main() {
  console.log(`Sembrando especialidades (únicas): ${NOMBRES.length}`);
  const existentes = await model.findMany({ select: { nombre: true } });
  const ya = new Set(existentes.map(e => e.nombre.trim()));

  const aCrear = NOMBRES.filter(n => !ya.has(n)).map(n => ({ nombre: n }));

  if (aCrear.length === 0) {
    console.log("No hay nuevas especialidades por crear. ✅");
    return;
  }

  // inserción en bloque
  const res = await model.createMany({ data: aCrear });
  console.log(`Insertadas: ${res.count} nuevas especialidades.`);
}

main()
  .catch(err => {
    console.error("Error sembrando especialidades:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
