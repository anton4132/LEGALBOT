const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  if (request === '@prisma/client') {
    return { PrismaClient: class PrismaClient {} };
  }
  return originalLoad(request, parent, isMain);
};

const prismaStub = {
  direccion: {
    findMany: async () => {
      throw new Error('direccion.findMany stub not configured');
    },
  },
  perfilabogado: {
    findMany: async () => {
      throw new Error('perfilabogado.findMany stub not configured');
    },
  },
};

const originalGlobalPrisma = global.prisma;
global.prisma = prismaStub;

const userController = require('../src/controllers/userController');
const { prisma } = require('../src/config/database');

function createMockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test.after(() => {
  if (originalGlobalPrisma === undefined) {
    delete global.prisma;
  } else {
    global.prisma = originalGlobalPrisma;
  }
  Module._load = originalLoad;
});

test('listLawyerLocations usa el padrón general de ubicaciones incluso sin estudios activos', async (t) => {
  const padronRows = [
    {
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
      ubigeo_codigo: '150122',
    },
    {
      departamento: 'Cusco',
      provincia: 'Cusco',
      distrito: 'San Sebastián',
      ubigeo_codigo: '080106',
    },
  ];

  const originalFindMany = prisma.direccion.findMany;
  let calls = 0;
  prisma.direccion.findMany = async (args) => {
    calls += 1;
    assert.equal(calls, 1, 'solo se debe consultar el padrón general una vez');
    assert.ok(args);
    assert.deepEqual(args.where, {
      departamento: { not: '' },
      provincia: { not: '' },
      distrito: { not: '' },
    });
    return padronRows;
  };

  const res = createMockResponse();

  try {
    await userController.listLawyerLocations({}, res);
  } finally {
    prisma.direccion.findMany = originalFindMany;
  }

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body));

  const cuscoEntry = res.body.find((departamento) => departamento.departamento === 'Cusco');
  assert.ok(cuscoEntry, 'el catálogo debe incluir departamentos aunque no existan estudios activos');
  const cuscoProvince = cuscoEntry.provincias.find((provincia) => provincia.provincia === 'Cusco');
  assert.ok(cuscoProvince, 'la provincia del padrón debe preservarse');
  const hasSanSebastian = cuscoProvince.distritos.some((distrito) => distrito.distrito === 'San Sebastián');
  assert.ok(hasSanSebastian, 'los distritos del padrón general deben incluirse en el catálogo');
});

test('searchPublicLawyers restringe resultados a estudios activos en la ubicación solicitada', async (t) => {
  const originalFindMany = prisma.perfilabogado.findMany;
  let capturedArgs;
  prisma.perfilabogado.findMany = async (args) => {
    capturedArgs = args;
    return [];
  };

  const req = {
    query: {
      specialtyId: '7',
      departamento: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
    },
  };

  const res = createMockResponse();
  try {
    await userController.searchPublicLawyers(req, res);
  } finally {
    prisma.perfilabogado.findMany = originalFindMany;
  }

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, []);
  assert.ok(capturedArgs, 'se debe invocar a prisma.perfilabogado.findMany');

  assert.deepEqual(capturedArgs.where.especialidades, {
    some: { especialidad_id: 7 },
  });

  assert.deepEqual(capturedArgs.where.usuario.abogadoestudios, {
    some: {
      activo: true,
      estudio: {
        activo: true,
        direccion: {
          is: {
            departamento: { equals: 'Lima', mode: 'insensitive' },
            provincia: { equals: 'Lima', mode: 'insensitive' },
            distrito: { equals: 'Miraflores', mode: 'insensitive' },
          },
        },
      },
    },
  });
});
