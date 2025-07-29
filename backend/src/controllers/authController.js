const { prisma } = require('../config/database');

// Login de usuario
const login = async (req, res) => {
  try {
    console.log('=== INICIO LOGIN ===');
    console.log('Body recibido:', req.body);
    
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Error: Email o password faltantes');
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    console.log('Intentando conectar a la BD...');
    
    // Verificar conexión a la BD
    await prisma.$connect();
    console.log('✅ Conexión a BD exitosa');

    console.log('Buscando usuario con email:', email);
    
    // Buscar usuario por correo
    const user = await prisma.usuario.findFirst({
      where: {
        persona: {
          correo: email
        }
      },
      include: {
        persona: true,
        role: true
      }
    });

    console.log('Usuario encontrado:', user ? 'SÍ' : 'NO');
    if (user) {
      console.log('Datos del usuario:', {
        id: user.id,
        email: user.persona.correo,
        rol: user.role.codigo
      });
    }

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    // Verificar contraseña
    if (user.clave !== password) {
      console.log('❌ Contraseña incorrecta');
      return res.status(401).json({
        success: false,
        message: 'Credenciales incorrectas'
      });
    }

    console.log('✅ Login exitoso');
    
    // Login exitoso
    res.json({
      success: true,
      message: 'Login exitoso',
      user: {
        id: user.id,
        email: user.persona.correo,
        nombre: `${user.persona.primer_nombre} ${user.persona.apellido_paterno}`,
        rol: user.role.codigo
      }
    });

  } catch (error) {
    console.error('❌ ERROR EN LOGIN:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Logout de usuario
const logout = async (req, res) => {
  try {
    // Aquí puedes implementar lógica de logout
    // Por ejemplo, invalidar tokens, etc.
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar token
const verifyToken = async (req, res) => {
  try {
    // Aquí puedes implementar verificación de token
    res.json({
      success: true,
      message: 'Token válido'
    });
  } catch (error) {
    console.error('Error verificando token:', error);
    res.status(401).json({
      success: false,
      message: 'Token inválido'
    });
  }
};

module.exports = {
  login,
  logout,
  verifyToken
};