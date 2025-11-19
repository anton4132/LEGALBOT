# Flujo manual: Endpoint LegalBot `/api/agent/chat`

Estos pasos permiten verificar que el agente complete su ciclo completo (clasificación → retrieval → respuesta) y que los errores se propaguen al cliente.

## Prerrequisitos
- Variables de entorno para `LLAMA_API_URL`, `EMBEDDINGS_API_URL`, `QDRANT_URL`, `QDRANT_COLLECTION` y sus API keys configuradas.
- Servidor backend en marcha (`npm run dev` desde `backend/`).

## Caso feliz
1. Ejecuta:
   ```bash
   curl -X POST http://localhost:3000/api/agent/chat \
     -H 'Content-Type: application/json' \
     -d '{"threadId":"demo-user-1","message":"Necesito ayuda con el pago de horas extras no reconocidas"}'
   ```
2. Debes recibir un `200` con:
   - `reply`: texto generado por LegalBot.
   - `contextDocs`: listado de fragmentos recuperados (puede estar vacío si Qdrant no encuentra coincidencias, pero la llamada no debe fallar).
   - `classifiedSpecialty`: objeto `{ id, nombre, confidence }` coherente con Derecho Laboral.
   - `errors`: arreglo vacío o con advertencias informativas.

## Validaciones del payload
1. Ejecuta sin `message`:
   ```bash
   curl -X POST http://localhost:3000/api/agent/chat \
     -H 'Content-Type: application/json' \
     -d '{}'
   ```
2. Respuesta esperada: `400` con `error` indicando que `message` es obligatorio.
3. Ejecuta con `threadId` numérico:
   ```bash
   curl -X POST http://localhost:3000/api/agent/chat \
     -H 'Content-Type: application/json' \
     -d '{"threadId":123,"message":"¿Qué hago si mi empleador no paga CTS?"}'
   ```
4. Respuesta esperada: `400` avisando que `threadId` debe ser string.

## Robustez ante fallos externos
1. Simula la caída de Qdrant (por ejemplo, deteniendo el contenedor o cambiando temporalmente `QDRANT_URL`).
2. Repite el caso feliz; el endpoint debe seguir respondiendo `200` con `errors` describiendo la falla y `contextDocs` vacío.
