// controllers/userController.js
const { prisma } = require('../config/database');

// ===== Utiles comunes =====
const INVALID_DNI_SEQUENCES = ['00000000', '11111111', '12345678', '87654321'];

function validateDniFormat(dni) {
  if (!/^\d{8}$/.test(dni)) return 'El DNI debe contener exactamente 8 dígitos';
  if (INVALID_DNI_SEQUENCES.includes(dni)) return 'El DNI proporcionado no es válido';
  return null;
}

function dayNameToNum(name) {
  const map = { 'Lunes':1,'Martes':2,'Miércoles':3,'Miercoles':3,'Jueves':4,'Viernes':5,'Sábado':6,'Sabado':6,'Domingo':7 };
  return map[name] || null;
}
function hhmmToTimeDate(t) {
  if (!t) return null;           // si viene vacío, lo descartamos más abajo
  const [hh, mm] = String(t).split(':');
  if (hh == null || mm == null) return null;
  // ISO con fecha fija (UTC); puedes usar sin 'Z' si prefieres local
  const iso = `1970-01-01T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:00.000Z`;
  return new Date(iso);
}

// ===== API Perú (opcional) =====
async function fetchDniInfo(dni) {
  const token = process.env.APIPERU_TOKEN;
  if (!token) throw new Error('APIPERU_TOKEN no configurado');

  const response = await fetch('https://apiperu.dev/api/dni', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ dni })
  });

  if (!response.ok) throw new Error('No se pudo verificar el DNI');
  const data = await response.json();
  if (!data.success) throw new Error('DNI no encontrado en padrón público');
  return data.data;
}

async function validateDni(dni) {
  const formatError = validateDniFormat(dni);
  if (formatError) return formatError;
  if (process.env.APIPERU_TOKEN) {
    try { await fetchDniInfo(dni); }
    catch (e) { return e.message || 'Error verificando DNI'; }
  }
  return null;
}

// ===== Endpoints auxiliares =====
const lookupDni = async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const formatError = validateDniFormat(dni);
    if (formatError) return res.status(400).json({ success: false, message: formatError });

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
    res.status(500).json({ success: false, message: error.message || 'Error consultando DNI' });
  }
};

// Listar roles (el frontend lo necesita)
const getRoles = async (_req, res) => {
  try {
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
    res.json(roles);
  } catch (e) {
    console.error('Error obteniendo roles:', e);
    res.status(500).json({ success: false, message: 'Error obteniendo roles' });
  }
};

// ===== Listar / Obtener =====
const getAllUsers = async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        persona: true,
        role: true,
        perfilabogado: {
          include: {
            especialidad: true,
            estudio: true,
            disponibilidadabogado: true
          }
        }
      },
      orderBy: { creado_el: 'desc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
};

const getUserById = async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(req.params.id, 10) },
      include: {
        persona: true,
        role: true,
        perfilabogado: {
          include: {
            especialidad: true,
            estudio: true,
            disponibilidadabogado: true
          }
        }
      }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    res.json({ success: true, user: usuario });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuario' });
  }
};

// ===== Crear =====
const createUser = async (req, res) => {
  try {
    // Payload del frontend:
    // { persona:{...}, rol_id, clave?, abogado_info? }
    const { persona, rol_id, clave, abogado_info } = req.body || {};
    if (!persona || !rol_id || !clave) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }
    const {
      dni, telefono, correo, primer_nombre, segundo_nombre,
      apellido_paterno, apellido_materno, direccion
    } = persona;

    if (!dni || !correo || !primer_nombre || !apellido_paterno) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos en persona' });
    }

    const normalizedDni = String(dni).trim();
    const dniError = await validateDni(normalizedDni);
    if (dniError) return res.status(400).json({ success: false, message: dniError });

    // Unicidad de persona
    const [dniExist, correoExist] = await Promise.all([
      prisma.persona.findUnique({ where: { dni: normalizedDni } }),
      prisma.persona.findUnique({ where: { correo } })
    ]);
    if (dniExist)   return res.status(400).json({ success: false, message: 'El DNI ya está registrado' });
    if (correoExist) return res.status(400).json({ success: false, message: 'El email ya está registrado' });

    const result = await prisma.$transaction(async (tx) => {
      const personaCreated = await tx.persona.create({
        data: {
          dni: normalizedDni,
          telefono: telefono || null,
          correo,
          primer_nombre,
          segundo_nombre: segundo_nombre || null,
          apellido_paterno,
          apellido_materno: apellido_materno || null,
          direccion: direccion || null
        }
      });

      const usuarioCreated = await tx.usuario.create({
        data: {
          persona_id: personaCreated.id,
          rol_id: parseInt(rol_id, 10),
          clave, // asumes hash en otro nivel; si no, hashea aquí
          telefono_verificado: false
        }
      });

      // Si no es abogado, termina aquí
      const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id, 10) } });
      if (!rol || rol.codigo !== 'abogado' || !abogado_info) {
        return tx.usuario.findUnique({
          where: { id: usuarioCreated.id },
          include: { persona: true, role: true }
        });
      }

      // === Crear/Conectar Especialidad ===
      let especialidadId = null;
      if (abogado_info.especialidad) {
        const nombre = abogado_info.especialidad.trim();
        if (nombre) {
          const esp = await tx.especialidad.upsert({
            where: { nombre },
            update: {},
            create: { nombre }
          });
          especialidadId = esp.id;
        }
      }

      // === Upsert Estudio (por RUC si viene, si no crear sin RUC) ===
      const e = abogado_info.estudio || {};
      let estudioRow;
      if (e.ruc && e.ruc.trim() !== '') {
        estudioRow = await tx.estudio.upsert({
          where: { ruc: e.ruc },
          update: {
            nombre_comercial: e.nombre || null,
            pais: e.pais || null,
            ciudad: e.ciudad || null,
            correo_contacto: e.correo || null,
            telefono: e.telefono || null,
            direccion: e.direccion || null
          },
          create: {
            ruc: e.ruc,
            nombre_comercial: e.nombre || null,
            pais: e.pais || null,
            ciudad: e.ciudad || null,
            correo_contacto: e.correo || null,
            telefono: e.telefono || null,
            direccion: e.direccion || null
          }
        });
      } else {
        // sin RUC: crea uno nuevo “anónimo”
        estudioRow = await tx.estudio.create({
          data: {
            nombre_comercial: e.nombre || null,
            pais: e.pais || null,
            ciudad: e.ciudad || null,
            correo_contacto: e.correo || null,
            telefono: e.telefono || null,
            direccion: e.direccion || null
          }
        });
      }

      // === Crear perfilabogado ===
      await tx.perfilabogado.create({
        data: {
          usuario_id: usuarioCreated.id,
          estudio_id: estudioRow.id,
          especialidad_id: especialidadId,
          tarifa_base: abogado_info.tarifabase ?? null,
          duracion_minutos: abogado_info.duracionMinutos ?? 60,
          direccion_atencion: abogado_info.direccionAtencion || null,
          bio: abogado_info.biografia || null,
        }
      });

      const disp = (abogado_info.disponibilidad || [])
        .map(s => {
          const dia = dayNameToNum(s.dia);               // 1..7
          const ini = hhmmToTimeDate(s.hora_inicio);     // <-- Date válido
          const fin = hhmmToTimeDate(s.hora_fin);        // <-- Date válido
          if (!dia || !ini || !fin) return null;         // descarta slots incompletos
          return { dia, ini, fin };
        })
        .filter(Boolean);

      if (disp.length) {
        await tx.disponibilidadabogado.createMany({
          data: disp.map(s => ({
            abogado_id: usuarioCreated.id,  // o userId en update
            dia_semana: s.dia,
            hora_inicio: s.ini,             // <-- Date
            hora_fin: s.fin                 // <-- Date
          })),
          skipDuplicates: true
        });
      }

      return tx.usuario.findUnique({
        where: { id: usuarioCreated.id },
        include: {
          persona: true,
          role: true,
          perfilabogado: {
            include: { especialidad: true, estudio: true, disponibilidadabogado: true }
          }
        }
      });
    });

    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', user: result });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ success: false, message: 'Error creando usuario' });
  }
};

// ===== Actualizar =====
const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { persona, rol_id, abogado_info } = req.body || {};

    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: userId },
      include: { persona: true, role: true, perfilabogado: true }
    });
    if (!usuarioActual) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    // Validaciones de unicidad si cambian DNI o correo
    if (persona?.dni && persona.dni.trim() !== usuarioActual.persona.dni) {
      const dniError = await validateDni(persona.dni.trim());
      if (dniError) return res.status(400).json({ success: false, message: dniError });
      const dniExists = await prisma.persona.findUnique({ where: { dni: persona.dni.trim() } });
      if (dniExists) return res.status(400).json({ success: false, message: 'El DNI ya está registrado por otro usuario' });
    }
    if (persona?.correo && persona.correo !== usuarioActual.persona.correo) {
      const emailExists = await prisma.persona.findUnique({ where: { correo: persona.correo } });
      if (emailExists) return res.status(400).json({ success: false, message: 'El email ya está registrado por otro usuario' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Actualizar usuario/rol
      if (rol_id) {
        await tx.usuario.update({
          where: { id: userId },
          data: { rol_id: parseInt(rol_id, 10) }
        });
      }

      // Actualizar persona
      if (persona) {
        const {
          dni, telefono, correo, primer_nombre, segundo_nombre,
          apellido_paterno, apellido_materno, direccion
        } = persona;
        await tx.persona.update({
          where: { id: usuarioActual.persona_id },
          data: {
            dni: dni ?? undefined,
            telefono: telefono ?? undefined,
            correo: correo ?? undefined,
            primer_nombre: primer_nombre ?? undefined,
            segundo_nombre: segundo_nombre ?? undefined,
            apellido_paterno: apellido_paterno ?? undefined,
            apellido_materno: apellido_materno ?? undefined,
            direccion: direccion ?? undefined
          }
        });
      }

      // Si el rol es abogado y viene info, upsert de perfil/estudio/especialidad/disponibilidad
      const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id || usuarioActual.rol_id, 10) } });
      const isAbogado = rol?.codigo === 'abogado';

      if (isAbogado && abogado_info) {
        // Especialidad
        let especialidadId = null;
        if (abogado_info.especialidad) {
          const nombre = abogado_info.especialidad.trim();
          if (nombre) {
            const esp = await tx.especialidad.upsert({
              where: { nombre },
              update: {},
              create: { nombre }
            });
            especialidadId = esp.id;
          }
        }

        // Estudio
        const e = abogado_info.estudio || {};
        let estudioId = null;
        if (e.ruc && e.ruc.trim() !== '') {
          const est = await tx.estudio.upsert({
            where: { ruc: e.ruc },
            update: {
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null
            },
            create: {
              ruc: e.ruc,
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null
            }
          });
          estudioId = est.id;
        } else {
          // si ya tiene perfil con estudio, reutilizar; si no, crear uno nuevo sin RUC
          if (usuarioActual.perfilabogado?.estudio_id) {
            const est = await tx.estudio.update({
              where: { id: usuarioActual.perfilabogado.estudio_id },
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null
              }
            });
            estudioId = est.id;
          } else {
            const est = await tx.estudio.create({
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null
              }
            });
            estudioId = est.id;
          }
        }

        // Upsert perfil
        await tx.perfilabogado.upsert({
          where: { usuario_id: userId },
          update: {
            estudio_id: estudioId,
            especialidad_id: especialidadId,
            tarifa_base: abogado_info.tarifabase ?? null,
            duracion_minutos: abogado_info.duracionMinutos ?? 60,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null
          },
          create: {
            usuario_id: userId,
            estudio_id: estudioId,
            especialidad_id: especialidadId,
            tarifa_base: abogado_info.tarifabase ?? null,
            duracion_minutos: abogado_info.duracionMinutos ?? 60,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null
          }
        });

        // Reemplazar disponibilidad
        
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
        const disp = (abogado_info.disponibilidad || [])
          .map(s => {
            const dia = dayNameToNum(s.dia);               // 1..7
            const ini = hhmmToTimeDate(s.hora_inicio);     // <-- Date válido
            const fin = hhmmToTimeDate(s.hora_fin);        // <-- Date válido
            if (!dia || !ini || !fin) return null;         // descarta slots incompletos
            return { dia, ini, fin };
          })
          .filter(Boolean);

          if (disp.length) {
            await tx.disponibilidadabogado.createMany({
              data: disp.map(s => ({
                abogado_id: userId,
                dia_semana: s.dia,
                hora_inicio: s.ini,             // <-- Date
                hora_fin: s.fin                 // <-- Date
              })),
              skipDuplicates: true
            });
          }
      } else {
        // Si dejó de ser abogado: limpia perfil y disponibilidad
        if (usuarioActual.perfilabogado) {
          await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
          await tx.perfilabogado.delete({ where: { usuario_id: userId } });
        }
      }

      return tx.usuario.findUnique({
        where: { id: userId },
        include: {
          persona: true,
          role: true,
          perfilabogado: { include: { especialidad: true, estudio: true, disponibilidadabogado: true } }
        }
      });
    });

    res.json({ success: true, message: 'Usuario actualizado exitosamente', user: updated });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ success: false, message: 'Error actualizando usuario' });
  }
};

// ===== Eliminar =====
const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { persona: true, perfilabogado: true }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    await prisma.$transaction(async (tx) => {
      // Si es abogado, borra primero disponibilidad y perfil (relaciones con NoAction)
      if (usuario.perfilabogado) {
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: id } });
        await tx.perfilabogado.delete({ where: { usuario_id: id } });
      }
      await tx.usuario.delete({ where: { id } });
      await tx.persona.delete({ where: { id: usuario.persona_id } });
    });

    res.json({ success: true, message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ success: false, message: 'Error eliminando usuario' });
  }
};

module.exports = {
  // listados
  getAllUsers,
  getUserById,
  getRoles,
  // CRUD
  createUser,
  updateUser,
  deleteUser,
  // auxiliares
  lookupDni,
  fetchDniInfo
};
