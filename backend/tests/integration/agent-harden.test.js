const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const originalLoad = Module._load;
const originalEnv = { ...process.env };

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

test.beforeEach(() => {
  process.env.LLAMA_API_URL = 'http://llama.local';
  process.env.EMBEDDINGS_API_URL = 'http://embed.local';
  process.env.QDRANT_URL = 'http://qdrant.local';
  process.env.QDRANT_COLLECTION = 'legal';
  delete require.cache[require.resolve('../../src/agent/legalbotGraph')];
});

test.afterEach(() => {
  Module._load = originalLoad;
  Object.assign(process.env, originalEnv);
});

test('clasificacion se repara cuando el modelo devuelve JSONL corrupto', async () => {
  let chatCalls = 0;
  let embeddingCalls = 0;
  let searchCalls = 0;

  Module._load = function patched(request, parent, isMain) {
    if (request === 'axios') {
      return {
        post: async (url, body) => {
          if (url.includes('llama.local')) {
            chatCalls += 1;
            if (chatCalls === 1) {
              return { data: 'id:1 nombre:Derecho Penal' };
            }
            if (chatCalls === 2) {
              return { data: { message: { content: '{"id":1,"nombre":"Derecho Penal","confidence":0.8}' } } };
            }
            return { data: { message: { content: 'respuesta final clara' } } };
          }
          if (url.includes('embed.local')) {
            embeddingCalls += 1;
            return { data: { embedding: [0.1, 0.2] } };
          }
          if (url.includes('qdrant.local')) {
            searchCalls += 1;
            return {
              data: {
                result: [
                  { id: '1', payload: { text: 'fragmento legal' }, score: 0.9 },
                ],
              },
            };
          }
          throw new Error(`unexpected url ${url}`);
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };

  const { legalbotChat } = require('../../src/agent/legalbotGraph');

  const req = { body: { message: '¿Es delito X?' }, headers: {} };
  const res = createMockResponse();

  await legalbotChat(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.reply.includes('respuesta final'));
  assert.equal(res.body.classifiedSpecialty.id, 1);
  assert.equal(chatCalls >= 2, true, 'se debe reintentar clasificación');
  assert.equal(embeddingCalls, 1);
  assert.equal(searchCalls, 1);
});

test('qdrant maneja error 400 con corrección y registra error', async () => {
  let searchCalls = 0;

  Module._load = function patched(request, parent, isMain) {
    if (request === 'axios') {
      return {
        post: async (url, body) => {
          if (url.includes('llama.local')) {
            return { data: { message: { content: '{"id":4,"nombre":"Derecho Laboral","confidence":0.5}' } } };
          }
          if (url.includes('embed.local')) {
            return { data: { embedding: [1, 'bad', 0.3] } };
          }
          if (url.includes('qdrant.local')) {
            searchCalls += 1;
            if (searchCalls === 1) {
              const error = new Error('payload error');
              error.response = { status: 400, data: { error: 'invalid vector' } };
              throw error;
            }
            return {
              data: {
                result: [
                  { id: '2', payload: { text: 'doc alterno' }, score: 0.5 },
                ],
              },
            };
          }
          throw new Error(`unexpected url ${url}`);
        },
      };
    }
    return originalLoad(request, parent, isMain);
  };

  const { legalbotChat } = require('../../src/agent/legalbotGraph');
  const req = { body: { message: 'Consulta laboral' }, headers: {} };
  const res = createMockResponse();

  await legalbotChat(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.contextDocs));
  assert.equal(res.body.contextDocs.length, 1);
  assert.ok(Array.isArray(res.body.errors));
  assert.equal(searchCalls, 2, 'se reintenta tras error 400');
});
