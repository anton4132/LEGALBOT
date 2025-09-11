const app = require('./app');
const { testConnection, closeConnection } = require('./config/database');

const PORT = process.env.PORT || 3000;

// Función para iniciar el servidor
async function startServer() {
  try {
    // Verificar conexión a la base de datos
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.error('❌ No se pudo conectar a la base de datos');
      process.exit(1);
    }

    // Iniciar servidor
    const server = app.listen(PORT, () => {
      console.log('📚 Swagger UI en http://localhost:3000/api-docs');
      console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
      console.log(`📊 API disponible en http://localhost:${PORT}/api`);
      console.log(`🌐 Admin Web en http://localhost:${PORT}/dashboard`);
      console.log(`🔐 Login en http://localhost:${PORT}/login`);
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