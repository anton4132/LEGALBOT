(function (global) {
  const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  const INVALID_DNI_SEQUENCES = ['00000000', '11111111', '12345678', '87654321'];
  const PHONE_MIN_LENGTH = 6;
  const PHONE_MAX_LENGTH = 10;
  const EMAIL_CODE_MIN_LENGTH = 6;

  const VerificationStatus = Object.freeze({
    NOT_REQUESTED: 'not_requested',
    CODE_SENT: 'code_sent',
    VERIFIED: 'verified',
    EXPIRED: 'expired',
    MISMATCH: 'mismatch',
  });

  const messages = Object.freeze({
    dniInvalid: 'Ingresa un DNI válido',
    dniSequence: 'El DNI proporcionado no es válido.',
    emailInvalid: 'Ingresa un correo electrónico válido',
    phoneInvalid: 'Ingresa un número de teléfono válido',
    passwordMissing: 'Por favor completa ambos campos de contraseña',
    passwordShort: 'La clave debe tener al menos 6 caracteres',
    passwordMismatch: 'Las claves no coinciden',
    emailCodeMissing: 'Ingresa el código de verificación',
    emailCodeShort: `El código debe tener al menos ${EMAIL_CODE_MIN_LENGTH} dígitos`,
  });

  function normalizeDigits(value) {
    return String(value ?? '').replace(/\D+/g, '');
  }

  function limitLength(value, maxLength) {
    if (!maxLength) return value;
    return String(value ?? '').slice(0, maxLength);
  }

  function formatDni(value) {
    return limitLength(normalizeDigits(value), 8);
  }

  function validateDni(value) {
    const normalized = formatDni(value);
    if (normalized.length !== 8) {
      return { valid: false, normalized, error: messages.dniInvalid };
    }
    if (INVALID_DNI_SEQUENCES.includes(normalized)) {
      return { valid: false, normalized, error: messages.dniSequence };
    }
    return { valid: true, normalized, error: null };
  }

  function normalizeEmail(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function validateEmail(value) {
    const normalized = normalizeEmail(value);
    if (!normalized || !EMAIL_REGEX.test(normalized)) {
      return { valid: false, normalized, error: messages.emailInvalid };
    }
    return { valid: true, normalized, error: null };
  }

  function normalizePhone(value) {
    return limitLength(normalizeDigits(value), PHONE_MAX_LENGTH);
  }

  function validatePhone(value) {
    const normalized = normalizePhone(value);
    if (!normalized || normalized.length < PHONE_MIN_LENGTH) {
      return { valid: false, normalized, error: messages.phoneInvalid };
    }
    return { valid: true, normalized, error: null };
  }

  function isValidEmailCode(value) {
    const normalized = normalizeDigits(value);
    return normalized.length >= EMAIL_CODE_MIN_LENGTH;
  }

  function validatePasswordPair(password, confirmPassword, { requireBoth = true } = {}) {
    const passwordValue = String(password ?? '');
    const confirmValue = String(confirmPassword ?? '');

    if (requireBoth && (!passwordValue.trim() || !confirmValue.trim())) {
      return { valid: false, error: messages.passwordMissing };
    }

    if (passwordValue.length < 6) {
      return { valid: false, error: messages.passwordShort };
    }

    if (confirmValue && passwordValue !== confirmValue) {
      return { valid: false, error: messages.passwordMismatch };
    }

    return { valid: true, error: null, password: passwordValue };
  }

  function getEmailVerificationStatus({
    codeRequested = false,
    currentEmail,
    emailUsedForCode,
    verifiedEmail,
    expiresAt,
    now = new Date(),
  } = {}) {
    const normalizedCurrent = normalizeEmail(currentEmail);
    const normalizedUsed = normalizeEmail(emailUsedForCode);
    const normalizedVerified = normalizeEmail(verifiedEmail);

    if (!codeRequested && !normalizedVerified) {
      return VerificationStatus.NOT_REQUESTED;
    }

    if (normalizedVerified && normalizedCurrent === normalizedVerified) {
      return VerificationStatus.VERIFIED;
    }

    if (codeRequested && normalizedCurrent && normalizedUsed && normalizedCurrent !== normalizedUsed) {
      return VerificationStatus.MISMATCH;
    }

    if (expiresAt) {
      const expirationDate = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
      if (!Number.isNaN(expirationDate.getTime()) && now > expirationDate) {
        return VerificationStatus.EXPIRED;
      }
    }

    return codeRequested ? VerificationStatus.CODE_SENT : VerificationStatus.NOT_REQUESTED;
  }

  const api = Object.freeze({
    EMAIL_REGEX,
    INVALID_DNI_SEQUENCES,
    PHONE_MIN_LENGTH,
    PHONE_MAX_LENGTH,
    EMAIL_CODE_MIN_LENGTH,
    VerificationStatus,
    messages,
    normalizeDigits,
    formatDni,
    normalizeEmail,
    validateEmail,
    normalizePhone,
    validatePhone,
    validateDni,
    validatePasswordPair,
    isValidEmailCode,
    getEmailVerificationStatus,
  });

  global.SignupValidation = api;
})(window);
