const { PrismaClient } = require('@prisma/client');

if (!global.prisma) {
  global.prisma = new PrismaClient();
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
  closeConnection
};