const { prisma } = require('../config/database');

const sanitizeString = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mapEstudioResponse = (estudio) => {
  if (!estudio) return estudio;
  const { direccion, ...rest } = estudio;
  const direccionData = direccion || {};
  const direccionUbigeoCodigo =
    sanitizeString(rest.direccion_id) ||
    sanitizeString(direccionData.ubigeo_codigo);

  return {
    ...rest,
    direccion,
    direccion_ubigeo_codigo: direccionUbigeoCodigo,
    linea_exacta_direccion:
      sanitizeString(rest.linea_exacta_direccion) || null,
    departamento:
      sanitizeString(rest.departamento) ||
      sanitizeString(direccionData.departamento) ||
      null,
    provincia:
      sanitizeString(rest.provincia) ||
      sanitizeString(direccionData.provincia) ||
      null,
    distrito:
      sanitizeString(rest.distrito) ||
      sanitizeString(direccionData.distrito) ||
      null,
  };
};


const searchEstudios = async (req, res) => {
  try {
    const term = String(req.query.search || '').trim();
    if (!term) return res.json([]);
    const rows = await prisma.estudio.findMany({
      where: {
        OR: [
          { ruc: { contains: term } },
          { nombre_comercial: { contains: term, mode: 'insensitive' } }
        ]
      },
      orderBy: { nombre_comercial: 'asc' },
      take: 10,
      include: {
        direccion: true
      }
    });
    res.json(rows.map(mapEstudioResponse));
  } catch (error) {
    console.error('Error buscando estudios:', error);
    res.status(500).json({ message: 'Error buscando estudios' });
  }
};

const createEstudio = async (req, res) => {
  try {
    const data = req.body || {};
    const direccionId =
      sanitizeString(data.direccion_id) ||
      sanitizeString(data.direccionUbigeoCodigo);
    const lineaExacta = sanitizeString(data.linea_exacta_direccion);

    if (!direccionId) {
      return res
        .status(400)
        .json({ message: 'El campo direccion_id es obligatorio.' });
    }

    if (!lineaExacta) {
      return res
        .status(400)
        .json({ message: 'La dirección exacta es obligatoria.' });
    }

    const created = await prisma.estudio.create({
      data: {
        ruc: sanitizeString(data.ruc),
        nombre_comercial: sanitizeString(data.nombre_comercial),
        correo_contacto: sanitizeString(data.correo_contacto),
        telefono: sanitizeString(data.telefono),
        direccion_id: direccionId,
        linea_exacta_direccion: lineaExacta,
        activo: false

      },
      include: {
        direccion: true
      }
    });
    res.status(201).json(mapEstudioResponse(created));
  } catch (error) {
    console.error('Error creando estudio:', error);
    res.status(500).json({ message: 'Error creando estudio' });
  }
};

module.exports = { searchEstudios, createEstudio };