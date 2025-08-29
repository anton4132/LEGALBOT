const { prisma } = require('../config/database');

const INVALID_DNI_SEQUENCES = ['00000000', '11111111', '12345678', '87654321'];

function validateDniFormat(dni) {
  if (!/^\d{8}$/.test(dni)) {
    return 'El DNI debe contener exactamente 8 dígitos';
  }
  if (INVALID_DNI_SEQUENCES.includes(dni)) {
    return 'El DNI proporcionado no es válido';
  }
  return null;
}

async function fetchDniInfo(dni) {
  const token = process.env.APIPERU_TOKEN;
  if (!token) {
    throw new Error('APIPERU_TOKEN no configurado');
  }
  const response = await fetch('https://apiperu.dev/api/dni', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ dni })
  });

  if (!response.ok) {
    throw new Error('No se pudo verificar el DNI');
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error('DNI no encontrado en padrón público');
  }
  return data.data;
}

async function validateDni(dni) {
  const formatError = validateDniFormat(dni);
  if (formatError) {
    return formatError;
  }
  if (process.env.APIPERU_TOKEN) {
    try {
      await fetchDniInfo(dni);
    } catch (error) {
      console.error('Error verificando DNI:', error);
      return error.message || 'Error verificando DNI';

    }
  }
  return null;
}
const lookupDni = async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const formatError = validateDniFormat(dni);
    if (formatError) {
      return res.status(400).json({ success: false, message: formatError });
    }
    const data = await fetchDniInfo(dni);
    const nombres = (data.nombres || '').trim().split(/\s+/);
    const structured = {
      numero: data.numero,
      primer_nombre: nombres[0] || '',
      segundo_nombre: nombres.slice(1).join(' ') || '',
      apellido_paterno: data.apellido_paterno || '',
      apellido_materno: data.apellido_materno || '',
    };
    res.json({ success: true, data: structured });
  } catch (error) {
    console.error('Error consultando DNI:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error consultando DNI'
    });
  }
};

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        persona: true,
        role: true
      },
      orderBy: {
        creado_el: 'desc'
      }
    });
    res.json(usuarios);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuarios'
    });
  }
};

// Obtener usuario por ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      include: {
        persona: true,
        role: true
      }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user: usuario
    });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error obteniendo usuario'
    });
  }
};

// Crear nuevo usuario
const createUser = async (req, res) => {
  try {
    const { 
      dni, 
      telefono, 
      correo, 
      primer_nombre, 
      segundo_nombre, 
      apellido_paterno, 
      apellido_materno, 
      direccion, 
      clave, 
      rol_id 
    } = req.body;

    // Validaciones
    if (!dni || !correo || !primer_nombre || !apellido_paterno || !clave || !rol_id) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos'
      });
    }
    const normalizedDni = dni.trim();
    const dniError = await validateDni(normalizedDni);
    if (dniError) {
      return res.status(400).json({ success: false, message: dniError });
    }
    // Verificar si el DNI ya existe
    const existingPersona = await prisma.persona.findUnique({
      where: { dni: normalizedDni }
    });

    if (existingPersona) {
      return res.status(400).json({
        success: false,
        message: 'El DNI ya está registrado'
      });
    }

    // Verificar si el email ya existe
    const existingEmail = await prisma.persona.findUnique({
      where: { correo }
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear persona primero
    const persona = await prisma.persona.create({
      data: {
        dni: normalizedDni,
        telefono,
        correo,
        primer_nombre,
        segundo_nombre,
        apellido_paterno,
        apellido_materno,
        direccion
      }
    });

    // Crear usuario
    const usuario = await prisma.usuario.create({
      data: {
        persona_id: persona.id,
        rol_id: parseInt(rol_id),
        clave: clave,
        telefono_verificado: false
      },
      include: {
        persona: true,
        role: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      user: usuario
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando usuario'
    });
  }
};

// Actualizar usuario
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      dni, 
      telefono, 
      correo, 
      primer_nombre, 
      segundo_nombre, 
      apellido_paterno, 
      apellido_materno, 
      direccion, 
      rol_id 
    } = req.body;

    // Buscar el usuario actual
    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      include: { persona: true }
    });

    if (!usuarioActual) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    let normalizedDni = usuarioActual.persona.dni;
    if (dni) {
      normalizedDni = dni.trim();
    }

    // Verificar si el DNI ya existe en otra persona
    if (normalizedDni !== usuarioActual.persona.dni) {
      const dniError = await validateDni(normalizedDni);
      if (dniError) {
        return res.status(400).json({ success: false, message: dniError });
      }

      const existingPersona = await prisma.persona.findUnique({
        where: { dni: normalizedDni }
      });

      if (existingPersona) {
        return res.status(400).json({
          success: false,
          message: 'El DNI ya está registrado por otro usuario'
        });
      }
    }

    // Verificar si el email ya existe en otra persona
    if (correo && correo !== usuarioActual.persona.correo) {
      const existingEmail = await prisma.persona.findUnique({
        where: { correo }
      });

      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado por otro usuario'
        });
      }
    }

    // Actualizar persona
    await prisma.persona.update({
      where: { id: usuarioActual.persona_id },
      data: {
        dni: normalizedDni,
        telefono,
        correo,
        primer_nombre,
        segundo_nombre,
        apellido_paterno,
        apellido_materno,
        direccion
      }
    });

    // Actualizar usuario si se proporciona rol_id
    let usuarioUpdateData = {};
    if (rol_id) {
      usuarioUpdateData.rol_id = parseInt(rol_id);
    }

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: usuarioUpdateData,
      include: {
        persona: true,
        role: true
      }
    });

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      user: usuario
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando usuario'
    });
  }
};

// Eliminar usuario
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si el usuario existe
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      include: { persona: true }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Eliminar usuario (esto también eliminará la persona debido a la relación)
    await prisma.usuario.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error eliminando usuario'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  lookupDni,
  fetchDniInfo
};