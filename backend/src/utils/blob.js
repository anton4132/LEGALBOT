const DEFAULT_BLOB_API_BASE_URL = 'https://blob.vercel-storage.com';
const DEFAULT_BLOB_PUBLIC_BASE_URL = DEFAULT_BLOB_API_BASE_URL;
const DEFAULT_BLOB_RW_TOKEN = 'vercel_blob_rw_w2ZXDcCJ4vCxIR4r_IXP5uJAzwiSiY17yZ2uUbMrIUdVx5H';

const TOKEN_PREFIX_PATTERN = /^vercel_blob_[a-z]+_([a-z0-9]+)_/i;

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveBlobToken() {
  const candidates = [
    process.env.BLOB_READ_WRITE_TOKEN,
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN,
    process.env.BLOB_RW_TOKEN,
    process.env.VERCEL_BLOB_RW_TOKEN,
    process.env.BLOB_TOKEN,
    process.env.VERCEL_BLOB_TOKEN,
  ];

  for (const candidate of candidates) {
    const trimmed = trimString(candidate);
    if (trimmed) {
      return trimmed;
    }
  }

  return DEFAULT_BLOB_RW_TOKEN;
}

function derivePublicBaseUrlFromToken(token) {
  const match = TOKEN_PREFIX_PATTERN.exec(trimString(token));
  if (match && match[1]) {
    return `https://${match[1]}.public.blob.vercel-storage.com`;
  }
  return null;
}

function resolveBlobPublicBaseUrl() {
  const candidates = [
    process.env.BLOB_PUBLIC_BASE_URL,
    process.env.VERCEL_BLOB_PUBLIC_BASE_URL,
    process.env.VERCEL_BLOB_PUBLIC_URL,
  ];

  for (const candidate of candidates) {
    const trimmed = trimString(candidate);
    if (trimmed) {
      return trimmed.replace(/\/+$/, '');
    }
  }

  const derived = derivePublicBaseUrlFromToken(resolveBlobToken());
  if (derived) {
    return derived;
  }

  return DEFAULT_BLOB_PUBLIC_BASE_URL;
}

function resolveBlobPublicUrl(pathOrUrl) {
  const sanitized = trimString(pathOrUrl);
  if (!sanitized) {
    return null;
  }
  if (/^https?:\/\//i.test(sanitized)) {
    return sanitized;
  }
  const normalized = sanitized.startsWith('/') ? sanitized : `/${sanitized}`;
  return `${resolveBlobPublicBaseUrl()}${normalized}`;
}

function normalizeBlobPath(pathOrUrl) {
  const sanitized = trimString(pathOrUrl);
  if (!sanitized) {
    return null;
  }
  if (/^https?:\/\//i.test(sanitized)) {
    try {
      const url = new URL(sanitized);
      return url.pathname.replace(/^\//, '');
    } catch {
      return sanitized.replace(/^\//, '');
    }
  }
  return sanitized.replace(/^\//, '');
}

module.exports = {
  BLOB_API_BASE_URL: DEFAULT_BLOB_API_BASE_URL,
  DEFAULT_BLOB_PUBLIC_BASE_URL,
  DEFAULT_BLOB_RW_TOKEN,
  resolveBlobToken,
  resolveBlobPublicBaseUrl,
  resolveBlobPublicUrl,
  normalizeBlobPath,
};