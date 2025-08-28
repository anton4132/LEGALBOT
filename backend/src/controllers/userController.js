const { prisma } = require('../config/database');

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

    // Verificar si el DNI ya existe
    const existingPersona = await prisma.persona.findUnique({
      where: { dni }
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
        dni,
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

    // Verificar si el DNI ya existe en otra persona
    if (dni && dni !== usuarioActual.persona.dni) {
      const existingPersona = await prisma.persona.findUnique({
        where: { dni }
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
        dni,
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
  deleteUser
};