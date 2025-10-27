const nodemailer = require('nodemailer');

let cachedTransporter;
let cachedTransportMode = null;
let simulatedWarningLogged = false;

function logSimulatedTransport(reason) {
  if (simulatedWarningLogged) return;
  const message = reason
    ? `SMTP no está configurado correctamente (${reason}); usando modo simulado.`
    : 'SMTP no está configurado; usando modo simulado.';
  console.warn(message);
  if (typeof process.emitWarning === 'function') {
    process.emitWarning(message, { code: 'SMTP_SIMULATED_TRANSPORT' });
  }
  simulatedWarningLogged = true;
}

const toBool = (value) => {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y'].includes(value.trim().toLowerCase());
  }
  return Boolean(value);
};

const buildTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const smtpUrl = process.env.SMTP_URL;
  if (smtpUrl && smtpUrl.trim().length > 0) {
    cachedTransporter = nodemailer.createTransport(smtpUrl.trim());
    cachedTransporter.isSimulated = false;
    cachedTransportMode = 'url';
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0) || 587;
  const secure = toBool(process.env.SMTP_SECURE) || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
    cachedTransporter.isSimulated = true;
    cachedTransportMode = 'simulated';
    const missing = [
      !host ? 'SMTP_HOST' : null,
      !user ? 'SMTP_USER' : null,
      !pass ? 'SMTP_PASS' : null,
    ].filter(Boolean).join(', ');
    logSimulatedTransport(missing ? `faltan variables: ${missing}` : null);
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: host.trim(),
    port,
    secure,
    auth: { user: user.trim(), pass },
  });
  cachedTransporter.isSimulated = false;
  cachedTransportMode = 'host';

  return cachedTransporter;
};

const getFromAddress = () => {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  if (from && from.trim().length > 0) {
    return from.trim();
  }
  return 'no-reply@legalbot.pe';
};

const sendMail = async ({ to, subject, text, html }) => {
  const transporter = buildTransporter();
  const mailOptions = {
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mailOptions);

  const isSimulated = transporter.isSimulated
    || Boolean(transporter.options && transporter.options.jsonTransport);

  if (isSimulated) {
    const modeLabel = cachedTransportMode || 'simulado';
    console.info(`[SMTP:${modeLabel}] Correo simulado enviado a ${mailOptions.to}:`, info.message);
  }

  return info;
};

const minutesLabel = (minutes) => {
  if (!minutes || Number.isNaN(minutes)) {
    return '';
  }
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
};

const sendPasswordRecoveryCodeEmail = async ({ to, code, nombre, minutosExpiracion }) => {
  const subject = 'Código de recuperación de contraseña';
  const expirationText = minutesLabel(minutosExpiracion);
  const greetingName = nombre && nombre.trim().length > 0 ? nombre.trim() : 'usuario';

  const textLines = [
    `Hola ${greetingName},`,
    '',
    'Recibimos una solicitud para restablecer tu contraseña en LegalBot.',
    `Tu código de verificación es: ${code}`,
  ];

  if (expirationText) {
    textLines.push(`Este código vence en ${expirationText}.`);
  }

  textLines.push('', 'Si no solicitaste este cambio, puedes ignorar este mensaje.');

  const text = textLines.join('\n');

  const html = `
    <p>Hola ${greetingName},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en <strong>LegalBot</strong>.</p>
    <p>Tu código de verificación es:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
    ${
      expirationText
        ? `<p>Este código vence en <strong>${expirationText}</strong>.</p>`
        : ''
    }
    <p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
  `;

  await sendMail({ to, subject, text, html });
};


const sendEmailVerificationCodeEmail = async ({ to, code, minutosExpiracion }) => {
  const subject = 'Verifica tu correo electrónico';
  const expirationText = minutesLabel(minutosExpiracion);

  const textLines = [
    'Hola,',
    '',
    'Estamos verificando que este correo electrónico te pertenece.',
    `Tu código de verificación es: ${code}`,
  ];

  if (expirationText) {
    textLines.push(`Este código vence en ${expirationText}.`);
  }

  textLines.push('', 'Si no solicitaste este código, puedes ignorar este mensaje.');

  const text = textLines.join('\n');

  const html = `
    <p>Hola,</p>
    <p>Estamos verificando que este correo electrónico te pertenece.</p>
    <p>Tu código de verificación es:</p>
    <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p>
    ${
      expirationText
        ? `<p>Este código vence en <strong>${expirationText}</strong>.</p>`
        : ''
    }
    <p>Si no solicitaste este código, puedes ignorar este mensaje.</p>
  `;

  await sendMail({ to, subject, text, html });
};

module.exports = {
  sendPasswordRecoveryCodeEmail,
    sendEmailVerificationCodeEmail,

};