// scripts/import-direcciones.mjs
import * as XLSX from "xlsx/xlsx.mjs";
import * as fs from "fs";
XLSX.set_fs(fs); // necesario para readFile en ESM
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FILE = process.argv[2];
if (!FILE) {
  console.error('Uso: node scripts/import-direcciones.mjs <ruta .xls/.xlsx/.csv/.tsv> [--mode insert|upsert] [--dry-run]');
  process.exit(1);
}

// ---------- utils ----------
const norm = (s) => String(s ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ").trim().toLowerCase();

const HEADER_ALIASES = {
  departamento: ["departamento", "dpto", "region"],
  provincia: ["provincia"],
  distrito: ["distrito"],
  ubigeo_codigo: ["idubigeo", "ubigeo", "ubigeo_codigo", "codigo ubigeo"],
};

function pick(obj, names) {
  for (const n of names) {
    for (const [k, v] of Object.entries(obj)) {
      if (norm(k) === n) return v ?? "";
    }
  }
  return "";
}

const padUbigeo = (v) => {
  let s = String(v ?? "").trim().replace(/\D/g, "");
  if (!s) return "";
  if (s.length > 6) s = s.slice(0, 6);
  if (s.length < 6) s = s.padStart(6, "0");
  return s;
};

// elimina prefijo solo si coincide con los 2 dígitos esperados
const stripCodeFromName = (name, expected2) => {
  const s = String(name ?? "").trim();
  if (!expected2) return s;
  const re = new RegExp(`^\\s*${expected2}\\s*[-\\.]?\\s*`, "i"); // "01 ", "01-", "01."
  return s.replace(re, "").trim();
};

const getArg = (flag) => {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) return true; // flags tipo --dry-run
  return v;
};

// ---------- parse ----------
function toRowsFromSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  if (!rows.length) return [];

  const out = [];
  for (const r of rows) {
    const departamento = String(pick(r, HEADER_ALIASES.departamento.map(norm))).trim();
    const provincia    = String(pick(r, HEADER_ALIASES.provincia.map(norm))).trim();
    const distrito     = String(pick(r, HEADER_ALIASES.distrito.map(norm))).trim();
    const ubigeo       = padUbigeo(pick(r, HEADER_ALIASES.ubigeo_codigo.map(norm)));

    if (!ubigeo || !/^\d{6}$/.test(ubigeo) || !departamento) continue;

    // limpiar prefijos según UBIGEO: DDPPDD
    const depClean  = stripCodeFromName(departamento, ubigeo.slice(0, 2));
    const provClean = stripCodeFromName(provincia,    ubigeo.slice(2, 4));
    const distClean = stripCodeFromName(distrito,     ubigeo.slice(4, 6));

    out.push({
      ubigeo_codigo: ubigeo,
      departamento: depClean,
      provincia:    provClean || "",
      distrito:     distClean  || "",
    });
  }
  return out;
}

// ---------- main ----------
async function main() {
  const MODE = (process.env.IMPORT_DIRECCION_MODE || getArg("--mode") || "insert").toString().toLowerCase();
  const DRY  = !!getArg("--dry-run");
  const CHUNK = 500;

  console.log("Leyendo:", FILE);
  const wb = XLSX.readFile(FILE, { raw: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("No se encontró hoja en el archivo.");

  let data = toRowsFromSheet(ws);
  if (!data.length) throw new Error("No se encontraron filas válidas (revisa encabezados).");

  // dedup PK
  const map = new Map();
  for (const r of data) map.set(r.ubigeo_codigo, r);
  data = Array.from(map.values());

  console.log(`Filas válidas tras normalizar/deduplicar: ${data.length}`);
  console.log(`Modo: ${MODE}${DRY ? " (dry-run)" : ""}`);

  if (DRY) {
    console.table(data.slice(0, 10));
    console.log("Dry-run: no se realizaron escrituras.");
    return;
  }

  if (MODE === "upsert") {
    let processed = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.slice(i, i + CHUNK);
      await prisma.$transaction(
        slice.map(row =>
          prisma.direccion.upsert({
            where:  { ubigeo_codigo: row.ubigeo_codigo },
            create: row,
            update: {
              departamento: row.departamento,
              provincia:    row.provincia,
              distrito:     row.distrito,
            },
          })
        )
      );
      processed += slice.length;
      console.log(`Upsert ${processed}/${data.length}`);
    }
    console.log("Upsert completado.");
  } else { // insert
    let inserted = 0;
    for (let i = 0; i < data.length; i += CHUNK) {
      const slice = data.slice(i, i + CHUNK);
      const res = await prisma.direccion.createMany({ data: slice, skipDuplicates: true });
      inserted += res.count;
      console.log(`Bloque ${i + 1}-${i + slice.length}: insertadas ${res.count}, acumuladas ${inserted}`);
    }
    console.log("Insert completado. Filas nuevas insertadas:", inserted);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
