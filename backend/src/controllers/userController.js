// controllers/userController.js
const { prisma } = require('../config/database');

// ========== Utiles comunes ==========
const INVALID_DNI_SEQUENCES = ['00000000', '11111111', '12345678', '87654321'];

function validateDniFormat(dni) {
  if (!/^\d{8}$/.test(dni)) return 'El DNI debe contener exactamente 8 dígitos';
  if (INVALID_DNI_SEQUENCES.includes(dni)) return 'El DNI proporcionado no es válido';
  return null;
}

function dayNameToNum(name) {
  const map = {
    'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Miercoles': 3,
    'Jueves': 4, 'Viernes': 5, 'Sábado': 6, 'Sabado': 6, 'Domingo': 7
  };
  return map[name] || null;
}

function hhmmToTimeDate(t) {
  if (!t) return null;
  const [hh, mm] = String(t).split(':');
  if (hh == null || mm == null) return null;
  // Devuelve Date local (Postgres TIME ignora fecha)
  return new Date(1970, 0, 1, parseInt(hh, 10), parseInt(mm, 10), 0, 0);
}

// ========== API Perú (opcional) ==========
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

// ========== Endpoints auxiliares ==========
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

// ========== Helpers de dominio (abogado) ==========

// Asegura especialidades y devuelve array de IDs (acepta varios formatos de entrada)
async function ensureEspecialidades(tx, abogado_info = {}) {
  const ids = new Set();

  // Preferencia 1: arreglo de IDs ya existentes
  const idsEnviados = Array.isArray(abogado_info.especialidadesIds)
    ? abogado_info.especialidadesIds.map(Number).filter(n => !Number.isNaN(n))
    : [];

  if (idsEnviados.length) {
    const existentes = await tx.especialidad.findMany({
      where: { id: { in: idsEnviados } },
      select: { id: true }
    });
    existentes.forEach(e => ids.add(e.id));
  }

  // Preferencia 2: arreglo de nombres
  const nombres = Array.isArray(abogado_info.especialidadesNombres)
    ? abogado_info.especialidadesNombres.map(s => String(s).trim()).filter(Boolean)
    : [];

  for (const nombre of nombres) {
    const esp = await tx.especialidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
    ids.add(esp.id);
  }

  // Compatibilidad legacy: un solo nombre en `especialidad`
  if (abogado_info.especialidad && String(abogado_info.especialidad).trim()) {
    const nombre = String(abogado_info.especialidad).trim();
    const esp = await tx.especialidad.upsert({
      where: { nombre },
      update: {},
      create: { nombre }
    });
    ids.add(esp.id);
  }

  return Array.from(ids);
}

// Crea/actualiza el vínculo USUARIO-ESTUDIO (abogadoestudio) y devuelve {estudioId, abogadoEstudioId}
async function upsertAbogadoEstudio(tx, userId, estudioInput = {}, vinculoInput = {}) {
  const e = estudioInput || {};
  const v = vinculoInput || {};
  const hasData = ['ruc', 'nombre', 'nombre_comercial', 'pais', 'ciudad', 'correo', 'correo_contacto', 'telefono', 'direccion']
    .some(k => e[k] && String(e[k]).trim() !== '');
  if (!hasData) return null; // nada que hacer

  // Upsert de estudio por RUC si viene; si no, crea nuevo
  let estudio;
  if (e.ruc && String(e.ruc).trim() !== '') {
    estudio = await tx.estudio.upsert({
      where: { ruc: e.ruc },
      update: {
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      },
      create: {
        ruc: e.ruc,
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      }
    });
  } else {
    estudio = await tx.estudio.create({
      data: {
        nombre_comercial: e.nombre || e.nombre_comercial || null,
        pais: e.pais || null,
        ciudad: e.ciudad || null,
        correo_contacto: e.correo || e.correo_contacto || null,
        telefono: e.telefono || null,
        direccion: e.direccion || null
      }
    });
  }

  // Upsert de abogadoestudio (único por usuario-estudio)
  const principal = !!(v.principal ?? e.principal);
  const rol_en_estudio = v.rol_en_estudio ?? e.rol_en_estudio ?? null;

  // Ver si existe el vínculo
  const existing = await tx.abogadoestudio.findFirst({
    where: { usuario_id: userId, estudio_id: estudio.id }
  });

  let vinculo;
  if (existing) {
    vinculo = await tx.abogadoestudio.update({
      where: { id: existing.id },
      data: {
        rol_en_estudio,
        principal,
        activo: true
      }
    });
  } else {
    vinculo = await tx.abogadoestudio.create({
      data: {
        usuario_id: userId,
        estudio_id: estudio.id,
        rol_en_estudio,
        principal,
        activo: true
      }
    });
  }

  // Si marcó principal, desmarca los demás
  if (principal) {
    await tx.abogadoestudio.updateMany({
      where: { usuario_id: userId, id: { not: vinculo.id } },
      data: { principal: false }
    });
  }

  return { estudioId: estudio.id, abogadoEstudioId: vinculo.id };
}

// Sincroniza la tabla pivote perfilabogado_especialidad
async function syncPerfilEspecialidades(tx, userId, nuevosIds = []) {
  const actuales = await tx.perfilabogado_especialidad.findMany({
    where: { perfilabogado_id: userId },
    select: { especialidad_id: true }
  });
  const setActual = new Set(actuales.map(a => a.especialidad_id));
  const setNuevo = new Set(nuevosIds);

  const porBorrar = [...setActual].filter(x => !setNuevo.has(x));
  const porCrear = [...setNuevo].filter(x => !setActual.has(x));

  await tx.perfilabogado_especialidad.deleteMany({
    where: { perfilabogado_id: userId, especialidad_id: { in: porBorrar } }
  });
  if (porCrear.length) {
    await tx.perfilabogado_especialidad.createMany({
      data: porCrear.map(eid => ({ perfilabogado_id: userId, especialidad_id: eid })),
      skipDuplicates: true
    });
  }
}

// ========== Listar / Obtener ==========
const getAllUsers = async (_req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: {
        persona: true,
        role: true,
        perfilabogado: {
          include: {
            disponibilidadabogado: true,
            especialidades: { include: { especialidad: true } }
          }
        },
        abogadoestudios: {
          include: { estudio: true },
          where: { activo: true },
          orderBy: { principal: 'desc' }
        }
      },
      orderBy: { creado_el: 'desc' }
    });

    // Aplana especialidades para facilitar al front
    const data = usuarios.map(u => ({
      ...u,
      perfilabogado: u.perfilabogado
        ? {
            ...u.perfilabogado,
            especialidades: (u.perfilabogado.especialidades || []).map(pe => pe.especialidad)
          }
        : null
    }));

    res.json(data);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuarios' });
  }
};

const getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ success: false, message: 'ID inválido' });

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: {
        persona: true,
        role: true,
        perfilabogado: {
          include: {
            disponibilidadabogado: true,
            especialidades: { include: { especialidad: true } }
          }
        },
        abogadoestudios: {
          include: { estudio: true },
          where: { activo: true },
          orderBy: { principal: 'desc' }
        }
      }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const data = usuario.perfilabogado
      ? {
          ...usuario,
          perfilabogado: {
            ...usuario.perfilabogado,
            especialidades: (usuario.perfilabogado.especialidades || []).map(pe => pe.especialidad)
          }
        }
      : usuario;

    res.json({ success: true, user: data });
  } catch (error) {
    console.error('Error obteniendo usuario:', error);
    res.status(500).json({ success: false, message: 'Error obteniendo usuario' });
  }
};

// ========== Crear ==========
const createUser = async (req, res) => {
  try {
    // Payload del frontend:
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
          clave, // OJO: hashea en tu capa de servicio si aún no
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



      // === Upsert perfilabogado (sin estudio/especialidad directos; van por otras tablas) ===
      await tx.perfilabogado.create({
        data: {
          usuario_id: usuarioCreated.id,
          tarifa_base: abogado_info.tarifabase ?? null,
          duracion_minutos: abogado_info.duracionMinutos ?? 60,
          direccion_atencion: abogado_info.direccionAtencion || null,
          bio: abogado_info.biografia || null
        }
      });

      // === Especialidades ===
      const nombresEspecialidades = Array.isArray(abogado_info.especialidades)
        ? abogado_info.especialidades
        : (abogado_info.especialidad ? [abogado_info.especialidad] : []);
      if (nombresEspecialidades.length) {
        const especialidadRows = await Promise.all(
          nombresEspecialidades
            .map(n => n && n.trim())
            .filter(Boolean)
            .map(nombre =>
              tx.especialidad.upsert({
                where: { nombre },
                update: {},
                create: { nombre }
              })
            )
        );
        await tx.perfilabogado_especialidad.createMany({
          data: especialidadRows.map(esp => ({
            perfilabogado_id: usuarioCreated.id,
            especialidad_id: esp.id
          })),
          skipDuplicates: true
        });
      }

      // === Estudio + vínculo abogadoestudio ===
      const e = abogado_info.estudio || {};
      if (Object.keys(e).length) {
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
              direccion: e.direccion || null,
              activo: e.activo ?? false
            },
            create: {
              ruc: e.ruc,
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null,
              activo: e.activo ?? false
            }
          });
        } else {
          estudioRow = await tx.estudio.create({
            data: {
              nombre_comercial: e.nombre || null,
              pais: e.pais || null,
              ciudad: e.ciudad || null,
              correo_contacto: e.correo || null,
              telefono: e.telefono || null,
              direccion: e.direccion || null,
              activo: e.activo ?? false
            }
          });
        }

        await tx.abogadoestudio.create({
          data: {
            usuario_id: usuarioCreated.id,
            estudio_id: estudioRow.id,
            principal: true,
            rol_en_estudio: e.rol || null,
            activo: true
          }
        });
      }

      // === Disponibilidad ===
      const disp = (abogado_info.disponibilidad || [])
        .map(s => {
          const dia = dayNameToNum(s.dia);
          const ini = hhmmToTimeDate(s.hora_inicio);
          const fin = hhmmToTimeDate(s.hora_fin);
          if (!dia || !ini || !fin) return null;
          return { dia, ini, fin };
        })
        .filter(Boolean);

      if (disp.length) {
        await tx.disponibilidadabogado.createMany({
          data: disp.map(s => ({
            abogado_id: usuarioCreated.id,
            dia_semana: s.dia,
            hora_inicio: s.ini,
            hora_fin: s.fin
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
            include: {
              disponibilidadabogado: true,
              especialidades: { include: { especialidad: true } }
            }
          },
          abogadoestudios: {
            include: { estudio: true },
            where: { activo: true },
            orderBy: { principal: 'desc' }
          }
        }
      });
    });

    // Aplana especialidades
    const user = result?.perfilabogado
      ? {
          ...result,
          perfilabogado: {
            ...result.perfilabogado,
            especialidades: (result.perfilabogado.especialidades || []).map(pe => pe.especialidad)
          }
        }
      : result;

    res.status(201).json({ success: true, message: 'Usuario creado exitosamente', user });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ success: false, message: 'Error creando usuario' });
  }
};

// ========== Actualizar ==========
const updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { persona, rol_id, abogado_info } = req.body || {};

    const usuarioActual = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        persona: true,
        role: true,
        perfilabogado: true,
        abogadoestudios: true 
      }
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

      // Rol final (si no enviaron, usa el actual)
      const rol = await tx.role.findUnique({ where: { id: parseInt(rol_id || usuarioActual.rol_id, 10) } });
      const isAbogado = rol?.codigo === 'abogado';

      if (isAbogado && abogado_info) {
        // Upsert perfil (sin columnas inexistentes)
        await tx.perfilabogado.upsert({
          where: { usuario_id: userId },
          update: {
            tarifa_base: abogado_info.tarifabase ?? null,
            duracion_minutos: abogado_info.duracionMinutos ?? 60,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null,
            place_id_api: abogado_info.placeIdApi || null
          },
          create: {
            usuario_id: userId,
            tarifa_base: abogado_info.tarifabase ?? null,
            duracion_minutos: abogado_info.duracionMinutos ?? 60,
            direccion_atencion: abogado_info.direccionAtencion || null,
            bio: abogado_info.biografia || null,
            place_id_api: abogado_info.placeIdApi || null
          }
        });

        // Especialidades (sync)
        await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: userId } });
        const nombresEspecialidades = Array.isArray(abogado_info.especialidades)
          ? abogado_info.especialidades
          : (abogado_info.especialidad ? [abogado_info.especialidad] : []);
        if (nombresEspecialidades.length) {
          const especialidadRows = await Promise.all(
            nombresEspecialidades
              .map(n => n && n.trim())
              .filter(Boolean)
              .map(nombre =>
                tx.especialidad.upsert({
                  where: { nombre },
                  update: {},
                  create: { nombre }
                })
              )
          );
          await tx.perfilabogado_especialidad.createMany({
            data: especialidadRows.map(esp => ({
              perfilabogado_id: userId,
              especialidad_id: esp.id
            })),
            skipDuplicates: true
          });
        }

        // Estudio (vínculo abogadoestudio)
        const e = abogado_info.estudio || {};
        if (Object.keys(e).length) {
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
                direccion: e.direccion || null,
                activo: e.activo ?? false
              },
              create: {
                ruc: e.ruc,
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          } else if (usuarioActual.abogadoestudios?.[0]) {
            estudioRow = await tx.estudio.update({
              where: { id: usuarioActual.abogadoestudios[0].estudio_id },
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          } else {
            estudioRow = await tx.estudio.create({
              data: {
                nombre_comercial: e.nombre || null,
                pais: e.pais || null,
                ciudad: e.ciudad || null,
                correo_contacto: e.correo || null,
                telefono: e.telefono || null,
                direccion: e.direccion || null,
                activo: e.activo ?? false
              }
            });
          }

          await tx.abogadoestudio.deleteMany({ where: { usuario_id: userId } });
          await tx.abogadoestudio.create({
            data: {
              usuario_id: userId,
              estudio_id: estudioRow.id,
              principal: true,
              rol_en_estudio: e.rol || null,
              activo: true
            }
          });
        }

        // Reemplazar disponibilidad
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
        const disp = (abogado_info.disponibilidad || [])
          .map(s => {
            const dia = dayNameToNum(s.dia);
            const ini = hhmmToTimeDate(s.hora_inicio);
            const fin = hhmmToTimeDate(s.hora_fin);
            if (!dia || !ini || !fin) return null;
            return { dia, ini, fin };
          })
          .filter(Boolean);

        if (disp.length) {
          await tx.disponibilidadabogado.createMany({
            data: disp.map(s => ({
              abogado_id: userId,
              dia_semana: s.dia,
              hora_inicio: s.ini,
              hora_fin: s.fin
            })),
            skipDuplicates: true
          });
        }
      } else {
        // Si dejó de ser abogado: limpia perfil, especialidades, disponibilidad y estudios
         await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: userId } });
         await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
         await tx.abogadoestudio.deleteMany({ where: { usuario_id: userId } });
        if (usuarioActual.perfilabogado) {
          await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: userId } });
          await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: userId } });
          await tx.perfilabogado.delete({ where: { usuario_id: userId } });
        }
        await tx.abogadoestudio.updateMany({
          where: { usuario_id: userId },
          data: { activo: false, principal: false }
        });
      }

      return tx.usuario.findUnique({
        where: { id: userId },
        include: {
          persona: true,
          role: true,
          perfilabogado: {
            include: {
              disponibilidadabogado: true,
              especialidades: { include: { especialidad: true } }
            }
          },
          abogadoestudios: {
            include: { estudio: true },
            where: { activo: true },
            orderBy: { principal: 'desc' }
          }
        }
      });
    });

    const user = updated?.perfilabogado
      ? {
          ...updated,
          perfilabogado: {
            ...updated.perfilabogado,
            especialidades: (updated.perfilabogado.especialidades || []).map(pe => pe.especialidad)
          }
        }
      : updated;

    res.json({ success: true, message: 'Usuario actualizado exitosamente', user });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ success: false, message: 'Error actualizando usuario' });
  }
};

// ========== Eliminar ==========
const deleteUser = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const usuario = await prisma.usuario.findUnique({
      where: { id },
      include: { persona: true, perfilabogado: true, abogadoestudios: true }
    });
    if (!usuario) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    await prisma.$transaction(async (tx) => {
      // Si es abogado, limpia dependencias manuales
      if (usuario.perfilabogado) {
        
        await tx.disponibilidadabogado.deleteMany({ where: { abogado_id: id } });
        await tx.perfilabogado_especialidad.deleteMany({ where: { perfilabogado_id: id } });
        await tx.perfilabogado.delete({ where: { usuario_id: id } });
      }
      // Desactiva vínculos con estudios (por si no hiciera cascade en DB)
      await tx.abogadoestudio.deleteMany({ where: { usuario_id: id } });

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
