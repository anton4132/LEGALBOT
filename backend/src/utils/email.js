const nodemailer = require('nodemailer');

let cachedTransporter;

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
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 0) || 587;
  const secure = toBool(process.env.SMTP_SECURE) || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host && !user && !pass) {
    cachedTransporter = nodemailer.createTransport({ jsonTransport: true });
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });

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

  if (transporter.options && transporter.options.jsonTransport) {
    console.info('Correo simulado (jsonTransport):', info.message);
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

module.exports = {
  sendPasswordRecoveryCodeEmail,
};