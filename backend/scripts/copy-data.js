// scripts/copy-data.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
// Detecta Decimal de Prisma para no tratarlos como JSON
const { Decimal } = require('@prisma/client/runtime/library');

const LOCAL_URL  = process.env.LOCAL_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;

if (!LOCAL_URL || !TARGET_URL) {
  console.error('Faltan LOCAL_DATABASE_URL o TARGET_DATABASE_URL en .env');
  process.exit(1);
}

const local  = new PrismaClient({ datasources: { db: { url: LOCAL_URL  } } });
const target = new PrismaClient({ datasources: { db: { url: TARGET_URL } } });

// ---- helpers de formato por tipo ----
function fmtDate(d) {
  // YYYY-MM-DD
  const iso = d.toISOString();
  return iso.slice(0, 10);
}
function fmtTime(d) {
  // HH:MM:SS.mmm (sin fecha/zonas); usa la porción de ISO
  const t = d.toISOString().split('T')[1].replace('Z', '');
  return t; // Postgres lo parsea a time
}
function fmtTimestampTZ(d) {
  // ISO completo (con Z)
  return d.toISOString();
}
function fmtTimestamp(d) {
  // sin Z (timestamp without time zone)
  return d.toISOString().replace('Z', '');
}

function sqlValByType(v, data_type, udt_name) {
  // Null
  if (v === null || v === undefined) return 'NULL';

  // NUMERIC / DECIMAL
  if (data_type === 'numeric') {
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    if (Decimal && v instanceof Decimal) return v.toString(); // sin comillas
    // por si viniera como string numérica:
    return String(v);
  }

  // INTEGER family
  if (data_type === 'integer' || data_type === 'smallint' || data_type === 'bigint') {
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return String(v); // fallback
  }

  // BOOLEAN
  if (data_type === 'boolean') {
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    return String(v).toLowerCase() === 'true' ? 'TRUE' : 'FALSE';
  }

  // JSON/JSONB
  if (data_type === 'json' || data_type === 'jsonb') {
    return `'${JSON.stringify(v).replace(/'/g, "''")}'::${data_type}`;
  }

  // BYTEA
  if (data_type === 'bytea') {
    if (typeof Buffer !== 'undefined' && v && v.type === 'Buffer' && Array.isArray(v.data)) {
      return `'\\x${Buffer.from(v.data).toString('hex')}'::bytea`;
    }
    // si fuera string base64:
    if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'::bytea`;
  }

  // DATE
  if (data_type === 'date') {
    const s = v instanceof Date ? fmtDate(v) : String(v);
    return `'${s}'::date`;
  }

  // TIME
  if (data_type === 'time without time zone' || data_type === 'time with time zone' || udt_name === 'time' || udt_name === 'timetz') {
    const s = v instanceof Date ? fmtTime(v) : String(v);
    return `'${s}'::time`;
  }

  // TIMESTAMP
  if (data_type === 'timestamp with time zone' || udt_name === 'timestamptz') {
    const s = v instanceof Date ? fmtTimestampTZ(v) : String(v);
    return `'${s}'::timestamptz`;
  }
  if (data_type === 'timestamp without time zone' || udt_name === 'timestamp') {
    const s = v instanceof Date ? fmtTimestamp(v) : String(v);
    return `'${s}'::timestamp`;
  }

  // TEXT / VARCHAR / UUID / CHAR / etc.
  if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
  // Cualquier objeto restante -> a texto (NO jsonb, porque no sabemos el tipo)
  if (typeof v === 'object') return `'${String(v).replace(/'/g, "''")}'`;

  // number/bool fallback como texto
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ---- topological sort por FKs (para no necesitar session_replication_role) ----
async function topologicalOrder(client) {
  const tables = await client.$queryRawUnsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema='public' AND table_type='BASE TABLE'
  `);
  const all = new Set(tables.map(t => t.table_name));

  const edges = await client.$queryRawUnsafe(`
    SELECT
      tc.table_name  AS child,
      ccu.table_name AS parent
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema   = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema   = tc.table_schema
    WHERE tc.constraint_type='FOREIGN KEY'
      AND tc.table_schema='public'
  `);

  const parents = {};
  for (const t of all) parents[t] = new Set();
  for (const e of edges) if (all.has(e.child) && all.has(e.parent)) parents[e.child].add(e.parent);

  const noParents = [];
  for (const t of all) if (parents[t].size === 0) noParents.push(t);

  const ordered = [];
  while (noParents.length) {
    const n = noParents.pop();
    ordered.push(n);
    for (const t of all) {
      if (parents[t].has(n)) {
        parents[t].delete(n);
        if (parents[t].size === 0) noParents.push(t);
      }
    }
  }
  const leftover = [...all].filter(t => !ordered.includes(t));
  return { ordered, leftover };
}

async function loadColumns(client, tableName) {
  return client.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
    ORDER BY ordinal_position
  `, tableName);
}

async function copyTable(src, dst, tableName) {
  // Si tienes tablas que NO quieres copiar, salta aquí:
  // const skip = new Set(['auditoria','bitacorabusquedavh']);
  // if (skip.has(tableName)) return;

  const cols = await loadColumns(src, tableName);
  if (!cols.length) return console.log(`- ${tableName}: 0 cols`);

  const colListSql = cols.map(c => `"${c.column_name}"`).join(',');
  const rows = await src.$queryRawUnsafe(`SELECT ${colListSql} FROM "public"."${tableName}"`);
  if (!rows.length) return console.log(`- ${tableName}: 0 filas`);

  const chunkSize = 300; // por si hay filas grandes
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = chunk.map(r => '(' + cols.map(c => sqlValByType(r[c.column_name], c.data_type, c.udt_name)).join(',') + ')').join(',');
    const sql = `INSERT INTO "public"."${tableName}" (${colListSql}) VALUES ${values} ON CONFLICT DO NOTHING;`;
    await dst.$executeRawUnsafe(sql);
    inserted += chunk.length;
  }
  console.log(`- ${tableName}: ${inserted} filas copiadas`);
}

async function copyWithRetriesFor(tableName) {
  const cols = await loadColumns(local, tableName);
  if (!cols.length) return;
  const colListSql = cols.map(c => `"${c.column_name}"`).join(',');
  const rows = await local.$queryRawUnsafe(`SELECT ${colListSql} FROM "public"."${tableName}"`);
  if (!rows.length) return;

  let ok = 0, fail = 0;
  for (const r of rows) {
    const sql = `INSERT INTO "public"."${tableName}" (${colListSql}) VALUES (${
      cols.map(c => sqlValByType(r[c.column_name], c.data_type, c.udt_name)).join(',')
    }) ON CONFLICT DO NOTHING;`;
    try { await target.$executeRawUnsafe(sql); ok++; } catch { fail++; }
  }
  console.log(`- ${tableName} (ciclo): ${ok} ok, ${fail} fallas (FK).`);
}

async function resetSequences(dst) {
    await dst.$executeRawUnsafe(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT
            n.nspname AS schema_name,
            c.relname AS table_name,
            a.attname AS column_name,
            pg_get_serial_sequence(
              quote_ident(n.nspname)||'.'||quote_ident(c.relname),
              a.attname
            ) AS seq_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
          JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
          WHERE c.relkind = 'r'
            AND n.nspname = 'public'
            AND pg_get_expr(d.adbin, d.adrelid) LIKE 'nextval(%'
        LOOP
          IF r.seq_name IS NOT NULL THEN
            EXECUTE format(
              'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I.%I), 0) + 1)',
              r.seq_name, r.column_name, r.schema_name, r.table_name
            );
          END IF;
        END LOOP;
      END$$;
    `);
  }
      

async function main() {
  console.log('Destino:', TARGET_URL);
  const { ordered, leftover } = await topologicalOrder(local);

  for (const t of ordered) await copyTable(local, target, t);
  for (const t of leftover) await copyWithRetriesFor(t);

  await resetSequences(target);
  console.log('✅ Copia completa');
}

main()
  .catch(async (e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await local.$disconnect();
    await target.$disconnect();
  });
