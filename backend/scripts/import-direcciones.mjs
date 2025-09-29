// scripts/import-direcciones.mjs
import * as XLSX from "xlsx/xlsx.mjs";
import * as fs from "fs";
XLSX.set_fs(fs); // <- NECESARIO en ESM para que readFile funcione

import { PrismaClient } from "@prisma/client";


const prisma = new PrismaClient();

const FILE = process.argv[2];
if (!FILE) {
  console.error("Uso: node scripts/import-direcciones.mjs <ruta .xls/.xlsx/.csv/.tsv>");
  process.exit(1);
}

// Normaliza encabezados: minúsculas, sin acentos, sin espacios extra
const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ").trim().toLowerCase();

const HEADER_ALIASES = {
  departamento: ["departamento", "dpto", "region"],
  provincia: ["provincia"],
  distrito: ["distrito"],
  ubigeo_codigo: ["idubigeo", "ubigeo", "ubigeo_codigo", "codigo ubigeo"]
};

function pick(obj, names) {
  for (const n of names) {
    for (const [k, v] of Object.entries(obj)) {
      if (norm(k) === n) return v ?? "";
    }
  }
  return "";
}

function toRowsFromSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  if (!rows.length) return [];

  // Construir filas canonizadas
  const out = [];
  for (const r of rows) {
    const departamento = String(pick(r, HEADER_ALIASES.departamento.map(norm))).trim();
    const provincia    = String(pick(r, HEADER_ALIASES.provincia.map(norm))).trim();
    const distrito     = String(pick(r, HEADER_ALIASES.distrito.map(norm))).trim();
    let   ubigeo       = String(pick(r, HEADER_ALIASES.ubigeo_codigo.map(norm))).trim();

    // Normaliza ubigeo a 6 dígitos
    ubigeo = ubigeo.replace(/\D/g, "");
    if (ubigeo.length > 6) ubigeo = ubigeo.slice(0, 6);
    if (ubigeo.length && ubigeo.length < 6) ubigeo = ubigeo.padStart(6, "0");

    // Reglas: requerimos ubigeo y departamento; provincia/distrito pueden ir vacíos
    if (!ubigeo || !/^\d{6}$/.test(ubigeo) || !departamento) continue;

    out.push({
      ubigeo_codigo: ubigeo,
      departamento,
      provincia: provincia || "",
      distrito:  distrito  || "",
    });
  }
  return out;
}

async function main() {
  console.log("Leyendo:", FILE);
  const wb = XLSX.readFile(FILE, { raw: false });  // soporta xls/xlsx/csv/tsv
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("No se encontró hoja en el archivo.");

  let data = toRowsFromSheet(ws);
  if (!data.length) throw new Error("No se encontraron filas válidas (revisa encabezados).");

  // Dedup por PK
  const map = new Map();
  for (const r of data) map.set(r.ubigeo_codigo, r);
  data = Array.from(map.values());

  console.log(`Filas válidas tras normalizar/deduplicar: ${data.length}`);

  const CHUNK = 1000;
  let inserted = 0;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    const res = await prisma.direccion.createMany({
      data: slice,
      skipDuplicates: true, // si la PK ya existe, la omite
    });
    inserted += res.count;
    console.log(`Bloque ${i + 1}-${i + slice.length}: insertadas ${res.count}, acumuladas ${inserted}`);
  }

  console.log("Importación finalizada. Filas insertadas nuevas:", inserted);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
