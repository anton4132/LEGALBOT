const { PrismaClient } = require('@prisma/client');
const { URL } = require('url');

function resolveDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL no está configurada');
  }

  try {
    const url = new URL(rawUrl);

    const connectionLimit = process.env.DATABASE_CONNECTION_LIMIT || '25';
    const poolTimeout = process.env.DATABASE_POOL_TIMEOUT || '30';

    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', connectionLimit);
    }

    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', poolTimeout);
    }

    return url.toString();
  } catch (error) {
    console.warn('No se pudo procesar DATABASE_URL, usando valor original');
    return rawUrl;
  }
}

if (!global.prisma) {
  global.prisma = new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

const prisma = global.prisma;

// Función para verificar conexión
async function testConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Conexión a base de datos exitosa');
    return true;
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error);
    return false;
  }
}

// Función para cerrar conexión
async function closeConnection() {
  await prisma.$disconnect();
}

module.exports = {
  prisma,
  testConnection,
  closeConnection,
};