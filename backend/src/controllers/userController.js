const { prisma } = require('../config/database');

// Obtener todos los usuarios
const getAllUsers = async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        persona: true,
        role: true
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
        rol_id,
        clave,
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
    const updateData = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: updateData,
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