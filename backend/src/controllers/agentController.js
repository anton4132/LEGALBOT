const { legalbotApp } = require("../agent/legalbotgraph");

const sendMessage = async (req, res) => {
  try {
    const { threadId, message } = req.body;

    const inputState = {
      messages: [{ role: "user", content: message }],
      // otros campos que definas en State (si aplica)
    };

    const config = {
      configurable: {
        thread_id: threadId || "anon", // o lo que ya estás usando
      },
    };

    const result = await legalbotApp.invoke(inputState, config);

    res.json({
      ok: true,
      data: result,
    });
  } catch (err) {
    console.error("Error en sendMessage:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { sendMessage };
