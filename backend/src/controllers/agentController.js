const { legalbotApp, legalbotChat } = require("../agent/legalbotGraph");

// Exponemos legalbotApp por si se requiere en pruebas unitarias u otros servicios.
const sendMessage = async (req, res) => {
  if (req && res) {
    return legalbotChat(req, res);
  }

  throw new Error(
    "sendMessage debe ser utilizado como handler de Express y recibe (req, res)."
  );
};

module.exports = { sendMessage, legalbotApp };
