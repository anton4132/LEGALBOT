const { prisma } = require('../config/database');
const {
  validateDni,
  ensureEspecialidades,
  hhmmToTimeDate,
  upsertAbogadoEstudio,
} = require('./userController');

// Registro de usuarios desde la aplicación móvil
const register = async (req, res) => {
  try {
    const { rolCodigo, persona, usuario, perfilAbogado } = req.body || {};
    if (!rolCodigo || !persona || !usuario?.clave) {
      return res.status(400).json({ success: false, message: 'Faltan campos requeridos' });
    }

    const role = await prisma.role.findUnique({ where: { codigo: rolCodigo } });
    if (!role || !['abogado', 'cliente'].includes(role.codigo)) {
      return res.status(400).json({ success: false, message: 'Rol inválido' });
    }

    const normalizedDni = String(persona.dni || '').trim();
    const dniError = await validateDni(normalizedDni);
    if (dniError) return res.status(400).json({ success: false, message: dniError });

    const result = await prisma.$transaction(async (tx) => {
      const personaRow = await tx.persona.create({
        data: {
          dni: normalizedDni,
          telefono: persona.telefono || null,
          correo: persona.correo,
          primer_nombre: persona.primer_nombre,
          segundo_nombre: persona.segundo_nombre || null,
          apellido_paterno: persona.apellido_paterno,
          apellido_materno: persona.apellido_materno || null,
          direccion: persona.direccion || null,
        },
      });

      const userRow = await tx.usuario.create({
        data: {
          persona_id: personaRow.id,
          rol_id: role.id,
          clave: usuario.clave,
          telefono_verificado: false,
        },
      });

      if (rolCodigo === 'abogado' && perfilAbogado) {
        await tx.perfilabogado.create({
          data: {
            usuario_id: userRow.id,
            tarifa_base: perfilAbogado.tarifa_base ?? null,
            duracion_minutos: perfilAbogado.duracion_minutos ?? 60,
            direccion_atencion: perfilAbogado.direccion_atencion || null,
            bio: perfilAbogado.bio || null,
          },
        });

        const espIds = await ensureEspecialidades(tx, {
          especialidadesIds: perfilAbogado.especialidades_ids,
        });
        if (espIds.length) {
          await tx.perfilabogado_especialidad.createMany({
            data: espIds.map((id) => ({
              perfilabogado_id: userRow.id,
              especialidad_id: id,
            })),
            skipDuplicates: true,
          });
        }

        const disp = Array.isArray(perfilAbogado.disponibilidad)
          ? perfilAbogado.disponibilidad
              .map((s) => {
                const dia = parseInt(s.dia_semana, 10);
                const ini = hhmmToTimeDate(s.hora_inicio);
                const fin = hhmmToTimeDate(s.hora_fin);
                if (!dia || !ini || !fin) return null;
                return { dia, ini, fin };
              })
              .filter(Boolean)
          : [];
        if (disp.length) {
          await tx.disponibilidadabogado.createMany({
            data: disp.map((s) => ({
              abogado_id: userRow.id,
              dia_semana: s.dia,
              hora_inicio: s.ini,
              hora_fin: s.fin,
            })),
            skipDuplicates: true,
          });
        }

        if (perfilAbogado.estudio) {
          await upsertAbogadoEstudio(tx, userRow.id, perfilAbogado.estudio);
        }
      }

      return tx.usuario.findUnique({
        where: { id: userRow.id },
        include: {
          persona: true,
          role: true,
          perfilabogado: {
            include: {
              disponibilidadabogado: true,
              especialidades: { include: { especialidad: true } },
            },
          },
          abogadoestudios: {
            include: { estudio: true },
            where: { activo: true },
            orderBy: { principal: 'desc' },
          },
        },
      });
    });

    const user = result?.perfilabogado
      ? {
          ...result,
          perfilabogado: {
            ...result.perfilabogado,
            especialidades: (result.perfilabogado.especialidades || []).map((pe) => pe.especialidad),
          },
        }
      : result;

    res.status(201).json({ success: true, message: 'Registro exitoso', user });
  } catch (error) {
    console.error('Error registrando usuario:', error);
    res.status(500).json({ success: false, message: 'Error registrando usuario' });
  }
};

module.exports = { register };