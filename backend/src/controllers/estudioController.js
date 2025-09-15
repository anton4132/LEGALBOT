const { prisma } = require('../config/database');

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
      take: 10
    });
    res.json(rows);
  } catch (error) {
    console.error('Error buscando estudios:', error);
    res.status(500).json({ message: 'Error buscando estudios' });
  }
};

const createEstudio = async (req, res) => {
  try {
    const data = req.body || {};
    const created = await prisma.estudio.create({
      data: {
        ruc: data.ruc ?? null,
        nombre_comercial: data.nombre_comercial ?? null,
        pais: data.pais ?? null,
        ciudad: data.ciudad ?? null,
        correo_contacto: data.correo_contacto ?? null,
        telefono: data.telefono ?? null,
        direccion: data.direccion ?? null,
        activo: false
      }
    });
    res.status(201).json(created);
  } catch (error) {
    console.error('Error creando estudio:', error);
    res.status(500).json({ message: 'Error creando estudio' });
  }
};

module.exports = { searchEstudios, createEstudio };