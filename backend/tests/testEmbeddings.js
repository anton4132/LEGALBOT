// testEmbeddings.js
require("dotenv").config();
const axios = require("axios");

async function testEmb() {
  const url =
    process.env.OLLAMA_URL
      ? `${process.env.OLLAMA_URL.replace(/\/+$/, "")}/api/embeddings`
      : process.env.EMBEDDINGS_API_URL;

  if (!url) {
    console.error("No hay OLLAMA_URL ni EMBEDDINGS_API_URL definidos.");
    return;
  }

  const embedModel =
    process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDINGS_MODEL;

  const headers = {
    "Content-Type": "application/json",
  };
  if (process.env.EMBEDDINGS_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.EMBEDDINGS_API_KEY}`;
  }

  console.log("Probando embeddings en:", url);
  const body = process.env.OLLAMA_URL
    ? {
        model: embedModel ?? "mxbai-embed-large",
        prompt: "Necesito ayuda con un contrato laboral",
      }
    : {
        input: "Necesito ayuda con un contrato laboral",
        ...(embedModel ? { model: embedModel } : {}),
      };

  const resp = await axios.post(url, body, { headers });
  console.log("Respuesta completa:\n", JSON.stringify(resp.data, null, 2));
}

testEmb().catch((e) => {
  console.error("Error en testEmb:", e.message);
});
