# LegalBot Hardening

Este módulo documenta la configuración para los flujos de recuperación, timeouts y reintentos añadidos al agente LegalBot.

## Variables de entorno clave
- `LLAMA_TIMEOUT_MS`: tiempo máximo para llamadas al modelo de chat (por defecto 120000 ms).
- `CLASSIFY_TIMEOUT_MS`: tiempo máximo específico para la clasificación de especialidad (por defecto 20000 ms).
- `CLASSIFY_MAX_ATTEMPTS`: número de intentos para clasificar y reparar salidas corruptas (por defecto 3).
- `EMBEDDINGS_TIMEOUT_MS`: timeout para el servicio de embeddings.
- `EMBEDDINGS_MAX_ATTEMPTS`: reintentos para embeddings (por defecto 3) con backoff configurable vía `EMBEDDINGS_BACKOFF_MS`.
- `QDRANT_TIMEOUT_MS`: timeout para búsquedas en Qdrant (por defecto 20000 ms).
- `QDRANT_MAX_ATTEMPTS`: reintentos frente a errores transitorios (por defecto 3) usando `QDRANT_BACKOFF_MS` como base.

## Estrategias de corrección
- **Normalización de respuestas LLM**: las respuestas se leen de forma defensiva (content/text/output) y se fuerza `stream: false` salvo que el endpoint soporte streaming.
- **Clasificación tolerante a fallos**: el parser utiliza `safeParse` con detección de JSONL y reintentos. Si la salida es inválida, se reconsulta al modelo con un prompt de reparación antes de continuar.
- **Embeddings y Qdrant**: se validan URLs y colecciones, se normalizan vectores y se reintenta con backoff ante timeouts/429/5xx. Para errores 400 se corrige el payload una vez antes de fallar.
- **Logging estructurado**: cada error conserva `step`, `requestId`, intento, latencia y detalles del endpoint o payload para poder reproducir el fallo y facilitar correcciones automáticas o manuales.

Los tests de integración en `backend/tests/integration/agent-harden.test.js` simulan fallos de parsing y errores 400 de Qdrant para validar que las rutas de recuperación devuelven respuestas coherentes o errores informativos sin dejar el estado inconsistente.
