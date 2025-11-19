const net = require('net');
const app = require('./app');
const { testConnection, closeConnection } = require('./config/database');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const MAX_PORT_SEARCH = 15;

async function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          resolve(false);
        } else {
          reject(err);
        }
      })
      .once('listening', () => {
        tester.close(() => resolve(true));
      })
      .listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort) {
  for (let offset = 0; offset < MAX_PORT_SEARCH; offset += 1) {
    const candidate = startPort + offset;
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  throw new Error(`No se encontró un puerto disponible a partir de ${startPort}`);
}

// Función para iniciar el servidor
async function startServer() {
  try {
    // Verificar conexión a la base de datos
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      process.exit(1);
    }

    const portToUse = await findAvailablePort(DEFAULT_PORT);

    if (portToUse !== DEFAULT_PORT) {
      console.warn(`⚠️ Puerto ${DEFAULT_PORT} en uso. Se utilizará el puerto ${portToUse}.`);
    }

    // Iniciar servidor
    process.env.PORT = String(portToUse);

    const server = app.listen(portToUse, () => {
      const apiPath = process.env.VERCEL ? '' : '/api';
      console.log(`📚 Swagger UI en http://localhost:${portToUse}/api-docs`);
      console.log(`🚀 Servidor activo en http://localhost:${portToUse}`);
      console.log(`📊 API disponible en http://localhost:${portToUse}${apiPath}`);

      console.log(`🌐 Admin Web en http://localhost:${portToUse}/dashboard`);
      console.log(`🔐 Login en http://localhost:${portToUse}/login`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ El puerto ${portToUse} está en uso. Intenta ajustar la variable PORT.`);
      } else {
        console.error('❌ Error inesperado en el servidor:', err);
      }
      process.exit(1);
    });


    // Manejo de cierre graceful
    process.on('SIGTERM', () => {
      console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado');
        closeConnection();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado');
        closeConnection();
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor
startServer();