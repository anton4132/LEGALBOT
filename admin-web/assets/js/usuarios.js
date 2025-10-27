let users = [];
let roles = [];
let especialidades = [];
let currentUserId = null;
let isEditing = false;
let currentAvailability = [];
let currentVerificationUserId = null;
let currentVerificationPersonaId = null;
let verificationModalInstance = null;
let verificationLoading = false;
let currentVerificationEstado = null;
let verificationActionsLocked = false;


let filteredUsers = [];
const USERS_DEFAULT_PAGE_SIZE = 10;
const usersPaginationState = { page: 1, pageSize: USERS_DEFAULT_PAGE_SIZE, totalItems: 0 };
let currentSearchTerm = '';
let currentRoleFilter = '';

const ubigeoCache = {
  departamentos: null,
  provincias: new Map(),
  distritos: new Map(),
};

let userFormState = null;


const API_BASE_URL = '/api';

const SignupValidation = window.SignupValidation;
if (!SignupValidation) {
  throw new Error('SignupValidation utilities not loaded.');
}

const {
  normalizeDigits,
  normalizeEmail,
  normalizePhone,
  validateDni,
  validateEmail,
  validatePhone,
  validatePasswordPair,
  messages: signupMessages,
} = SignupValidation;

/* ------------------ Utils API ------------------ */
async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');

  const isFormDataBody = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});

  if (!isFormDataBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include',
  });
  let data = null;
  try { data = await resp.json(); } catch { /* puede no haber body */ }
  if (!resp.ok) {
    const msg = data?.message || `Error HTTP ${resp.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

/* ----------------- Sanitizadores ---------------- */
const onlyDigits       = (s) => normalizeDigits(s);
const trimOrUndefined  = (s) => { const t = String(s ?? '').trim(); return t === '' ? undefined : t; };
const toTimeDB         = (hhmm) => {
  if (!hhmm) return null;
  const [hh, mm] = hhmm.split(':');
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) return null;
  return `${hh}:${mm}:00`;
};
// Convierte valores de tiempo provenientes de la BD (Date u "HH:MM:SS") a "HH:MM"
const fromTimeDB       = (t) => {
  if (!t) return '';
  if (typeof t === 'string') {
    const timePart = t.includes('T') ? t.substring(11,16) : t.substring(0,5);
    return /^\d{2}:\d{2}$/.test(timePart) ? timePart : '';

  }
  const d = new Date(t);
  if (isNaN(d)) return '';
  const hh = String(d.getUTCHours()).padStart(2,'0');
  const mm = String(d.getUTCMinutes()).padStart(2,'0');
  return `${hh}:${mm}`;
};

const isRUC            = (s) => /^\d{11}$/.test(String(s ?? '').trim());
const formatDate       = (d) => new Date(d).toLocaleDateString('es-PE', { year:'numeric', month:'2-digit', day:'2-digit' });

const formatDateTime   = (d) => d ? new Date(d).toLocaleString('es-PE', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}) : '';



const formatFileSize   = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};


const VERIFICATION_STATE_CLASSES = {
  PENDIENTE: 'bg-warning text-dark',
  OBSERVADA: 'bg-info text-dark',
  APROBADA: 'bg-success',
  RECHAZADA: 'bg-danger',
  NONE: 'bg-secondary',
};

function personaNombreCompleto(persona = {}) {
  return [persona.primer_nombre, persona.segundo_nombre, persona.apellido_paterno, persona.apellido_materno]
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
const LAWYER_ROLE_CODE = 'abogado';
const PANEL_ALLOWED_ROLE_ORDER = ['cliente', 'admin'];
const PANEL_ALLOWED_ROLE_CODES = new Set(PANEL_ALLOWED_ROLE_ORDER);

const STEP_COUNT = 3;

const EMAIL_STATUS_LABELS = {
  [SignupValidation.VerificationStatus.NOT_REQUESTED]: 'Debes verificar el correo antes de continuar.',
  [SignupValidation.VerificationStatus.CODE_SENT]: 'Hemos enviado un código de verificación al correo ingresado.',
  [SignupValidation.VerificationStatus.MISMATCH]: 'El correo cambió después de solicitar el código. Solicita uno nuevo.',
  [SignupValidation.VerificationStatus.EXPIRED]: 'El código ha expirado. Solicita uno nuevo para continuar.',
  [SignupValidation.VerificationStatus.VERIFIED]: 'Correo verificado correctamente.',
};

const EMAIL_STATUS_CLASSES = {
  [SignupValidation.VerificationStatus.NOT_REQUESTED]: 'text-muted',
  [SignupValidation.VerificationStatus.CODE_SENT]: 'text-primary',
  [SignupValidation.VerificationStatus.MISMATCH]: 'text-warning',
  [SignupValidation.VerificationStatus.EXPIRED]: 'text-warning',
  [SignupValidation.VerificationStatus.VERIFIED]: 'text-success fw-semibold',
};

function createInitialEmailState() {
  return {
    sending: false,
    verifying: false,
    validating: false,
    codeRequested: false,
    emailUsedForCode: null,
    verifiedEmail: null,
    codeSentAt: null,
    codeExpiresAt: null,
    status: SignupValidation.VerificationStatus.NOT_REQUESTED,
  };
}

function createInitialDniState() {
  return {
    loading: false,
    normalized: '',
    lookup: null,
    lastConsulted: null,
    error: null,
  };
}

function createInitialUbigeoState() {
  return {
    selectedDepartamento: '',
    selectedProvincia: '',
    selectedDistrito: '',
    loadingDepartamentos: false,
    loadingProvincias: false,
    loadingDistritos: false,
  };
}

function createInitialVerificationState() {
  return {
    dniMatch: false,
    conflictsCleared: false,
    dniLookup: null,
    emailVerification: null,
  };
}

function ensureUserFormState() {
  if (!userFormState) {
    resetUserFormState();
  }
  return userFormState;
}

function resetUserFormState() {
  userFormState = {
    step: 1,
    isEditing: false,
    email: createInitialEmailState(),
    dni: createInitialDniState(),
    ubigeo: createInitialUbigeoState(),
    verification: createInitialVerificationState(),
    conflictsMessage: null,
    personaId: null,
  };
  return userFormState;
}

function getPanelAllowedRoles() {
  if (!Array.isArray(roles) || !roles.length) return [];
  const roleMap = new Map(
    roles
      .filter(role => role && typeof role.codigo === 'string')
      .map(role => [String(role.codigo).toLowerCase(), role])
  );
  return PANEL_ALLOWED_ROLE_ORDER
    .map(code => roleMap.get(code))
    .filter(Boolean);
}

function describeRoleAvailability() {
  const normalizedRoles = Array.isArray(roles) ? roles : [];
  const available = normalizedRoles
    .filter(role => role && typeof role.codigo === 'string')
    .map(role => ({ codigo: String(role.codigo).toLowerCase(), role }));
  const availableCodes = new Map(available.map(item => [item.codigo, item.role]));
  const missing = PANEL_ALLOWED_ROLE_ORDER.filter(code => !availableCodes.has(code));
  return { availableRoles: available.map(item => item.role), missingCodes: missing };
}

function updateRoleAvailabilityFeedback() {
  const element = document.getElementById('roleAvailabilityFeedback');
  if (!element) return;

  element.classList.remove('text-muted', 'text-warning', 'text-success');

  const { missingCodes } = describeRoleAvailability();

  if (!Array.isArray(roles) || !roles.length) {
    element.textContent = 'No se recibieron roles desde la API. Verifica la configuración.';
    element.classList.remove('d-none');
    element.classList.add('text-warning');
    return;
  }

  if (missingCodes.length) {
    const humanList = missingCodes.map(code => code.toUpperCase()).join(', ');
    element.textContent = `Faltan los roles requeridos: ${humanList}. Puedes continuar con los roles disponibles.`;
    element.classList.remove('d-none');
    element.classList.add('text-warning');
    return;
  }

  element.textContent = 'Roles de cliente y administrador disponibles para su asignación.';
  element.classList.remove('d-none');
  element.classList.add('text-success');
}

function showPersonaValidationNotice(message = null, tone = 'warning') {
  const element = document.getElementById('personaValidationNotice');
  if (!element) return;
  element.classList.remove('alert-warning', 'alert-info', 'alert-danger', 'alert-success');
  if (!message) {
    element.textContent = '';
    element.classList.add('d-none');
    return;
  }
  element.textContent = message;
  element.classList.remove('d-none');
  element.classList.add(`alert-${tone}`);
}

function updatePersonaValidationState({ triggerAlert = false } = {}) {
  const roleCode = getSelectedRoleCode();
  const canRunValidations = shouldRunPersonaValidations(roleCode);
  const state = ensureUserFormState();
  const isLoadingDni = state?.dni?.loading ?? false;
  const reniecButton = document.getElementById('dniLookupButton');

  if (reniecButton) {
    reniecButton.disabled = isLoadingDni || !canRunValidations;
  }

  let notice = null;
  if (!roleCode) {
    notice = 'Selecciona un rol de cliente o administrador para habilitar las validaciones de RENIEC y duplicados.';
  } else if (!canRunValidations) {
    notice = 'El rol seleccionado no requiere validaciones de persona desde este panel.';
  }

  if (notice) {
    showPersonaValidationNotice(notice, 'warning');
    if (triggerAlert) {
      setStepAlert('contactStepAlert', notice, 'warning');
    }
  } else {
    showPersonaValidationNotice(null);
  }
}

function normalizeArchivoRecord(record) {
  if (!record) return null;

  if (typeof record === 'string') {
    const trimmed = record.trim();
    if (!trimmed) return null;
    return normalizeArchivoRecord({ ruta: trimmed });
  }

  const rutaRaw = record.ruta ?? '';
  const ruta = typeof rutaRaw === 'string' ? rutaRaw.trim() : '';
  const explicitUrl = typeof record.url === 'string' ? record.url.trim() : '';

  const preferUrl = explicitUrl || ruta;
  const resolvePath = (value) => {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/')) return value;
    return `/${value}`;
  };

  const normalizedReference = resolvePath(preferUrl);
  const fullUrl = explicitUrl
    || (normalizedReference
      ? /^https?:\/\//i.test(normalizedReference)
        ? normalizedReference
        : `https://blob.vercel-storage.com${normalizedReference}`
      : null);

  const hasMetadata = record.id != null
    || (record.tamano != null && !Number.isNaN(Number(record.tamano)))
    || (typeof record.tipo === 'string' && record.tipo.trim() !== '');

  const isAbsoluteLink = /^https?:\/\//i.test(fullUrl || explicitUrl || ruta);

  return {
    id: record.id ?? null,
    ruta,
    tamano: record.tamano ?? null,
    tipo: record.tipo ?? null,
    url: fullUrl,
    isLinkOnly: !hasMetadata && isAbsoluteLink,
    hasMetadata,
  };
}


function inferArchivoMimeType(record) {
  if (!record) return '';
  const explicitType = String(record.tipo ?? '').trim().toLowerCase();
  if (explicitType) return explicitType;

  const reference = String(record.url ?? record.ruta ?? '').trim();
  if (!reference) return '';
  const sanitized = reference.includes('?') ? reference.split('?')[0] : reference;
  const segments = sanitized.split('.');
  const extension = segments.length > 1 ? segments.pop().toLowerCase() : '';
  if (!extension) return '';

  const extensionMap = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    jpe: 'image/jpeg',
    jfif: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
    svgz: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    avif: 'image/avif',
    txt: 'text/plain',
    csv: 'text/csv',
    rtf: 'application/rtf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    m4v: 'video/x-m4v',
    mkv: 'video/x-matroska',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    oga: 'audio/ogg',
    ogg: 'audio/ogg',
    pdfa: 'application/pdf',
  };

  return extensionMap[extension] ?? '';
}

function getRoleCode(user) {
  return (user?.role?.codigo || '').toLowerCase();
}

function getLawyerAccountsByPersona(personaId) {
  if (personaId == null) return [];
  return users.filter((u) => u.persona_id === personaId && getRoleCode(u) === LAWYER_ROLE_CODE);
}

function personaHasLawyerAccount(personaId) {
  return getLawyerAccountsByPersona(personaId).length > 0;
}

function personaHasActiveLawyerAccount(personaId) {
  return getLawyerAccountsByPersona(personaId).some((u) => u.activo);
}

function getDeleteRestrictionReason(user) {
  const roleCode = getRoleCode(user);
  if (roleCode === LAWYER_ROLE_CODE) {
    return 'No puedes eliminar una cuenta con rol de abogado.';
  }
  const verification = mapVerificationFromUser(user);
  if (verification.exists) {
    return 'No puedes eliminar a un cliente que envió credenciales de verificación.';
  }
  if (personaHasLawyerAccount(user?.persona_id)) {
    return 'No puedes eliminar a un cliente que tiene una cuenta de abogado asociada.';
  }
  return null;
}

function mapColegiaturaRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    numero: record.numero,
    fecha_emision: record.fecha_emision,
    fecha_vigencia_hasta: record.fecha_vigencia_hasta,
    colegio: record.colegio ? { nombre: record.colegio.nombre, region: record.colegio.region } : null,
    carnet_archivo: normalizeArchivoRecord(record.carnet_archivo),
  };
}

function mapVerificationFromUser(user) {
  const persona = user?.persona ?? {};
  const verification = persona.verificacionabogado ?? null;
  const colegiatura = verification?.colegiatura ?? persona.colegiatura ?? null;

  if (!verification) {
    return {
      exists: false,
      estado: null,
      linkedin_url: null,
      observaciones: null,
      creado_el: null,
      actualizado_el: null,
      aprobado_el: null,
      titulo: null,
      colegiatura: mapColegiaturaRecord(colegiatura),
    };
  }

  return {
    exists: true,
    id: verification.id,
    persona_id: verification.persona_id,
    estado: verification.estado,
    linkedin_url: verification.linkedin_url,
    observaciones: verification.observaciones,
    creado_el: verification.creado_el,
    actualizado_el: verification.actualizado_el,
    aprobado_el: verification.aprobado_el,
    titulo: normalizeArchivoRecord(verification.titulo),
    colegiatura: mapColegiaturaRecord(colegiatura),
  };
}

function verificationBadgeInfo(verification) {
  if (!verification || !verification.estado) {
    return { text: 'Sin postulación', className: VERIFICATION_STATE_CLASSES.NONE };
  }
  const estado = verification.estado;
  const className = VERIFICATION_STATE_CLASSES[estado] || VERIFICATION_STATE_CLASSES.NONE;
  return { text: estado, className };
}


function renderArchivoLink(containerId, archivo, { fallbackLabel, emptyText = 'No disponible' } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.textContent = '';
  container.classList.remove('text-muted', 'd-none', 'text-break');

  if (!archivo || !(archivo.url || archivo.ruta)) {
    container.textContent = emptyText;
    container.classList.add('text-muted');
    return;
  }

  if (!archivo.isLinkOnly) {
    container.classList.add('d-none');
    return;
  }

  const href = archivo.url || archivo.ruta;
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = href;
  link.className = 'link-primary fw-semibold text-break';
  container.classList.add('text-break');
  container.appendChild(link);
}
/* ----------------- Bootstrap ------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await Promise.allSettled([loadRoles(), loadEspecialidades()]);
    await loadUsers();
  } catch (e) {
    showAlert(`Error inicializando: ${e.message}`, 'danger');
  } finally {
    setupEventListeners();
  }
});

function logout() {
  // implementar si corresponde
  console.log("Cerrando sesión...");
}

/* --------------- Listeners UI ------------------ */
function setupEventListeners() {
  document.getElementById('searchInput')?.addEventListener('input', handleSearchInput);
  document.getElementById('filterType')?.addEventListener('change', handleFilterChange);
  const form = document.getElementById('userForm');
  form?.addEventListener('submit', (e) => { e.preventDefault(); });

  document.getElementById('dni')?.addEventListener('blur', handleDniLookup);
  document.getElementById('dni')?.addEventListener('input', handleDniInputChange);
  document.getElementById('dniLookupButton')?.addEventListener('click', () => handleDniLookup());

  document.getElementById('telefono')?.addEventListener('blur', handleTelefonoBlur);
  document.getElementById('telefono')?.addEventListener('input', () => {
    ensureUserFormState().verification.conflictsCleared = false;
  });

  document.getElementById('email')?.addEventListener('input', handleEmailInputChange);
  document.getElementById('emailSendCodeButton')?.addEventListener('click', handleEmailSendCode);
  document.getElementById('emailVerifyCodeButton')?.addEventListener('click', handleEmailVerifyCode);
  document.getElementById('emailCodigo')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleEmailVerifyCode();
    }
  });

  document.getElementById('ubigeoDepartamento')?.addEventListener('change', handleDepartamentoChange);
  document.getElementById('ubigeoProvincia')?.addEventListener('change', handleProvinciaChange);
  document.getElementById('ubigeoDistrito')?.addEventListener('change', handleDistritoChange);

  document.getElementById('lineaExactaDireccion')?.addEventListener('input', () => {
    ensureUserFormState().verification.conflictsCleared = false;
  });
  document.getElementById('rol')?.addEventListener('change', () => {
    ensureUserFormState().verification.conflictsCleared = false;
    updatePersonaValidationState();
  });

  document.getElementById('nextStepButton')?.addEventListener('click', handleNextStep);
  document.getElementById('prevStepButton')?.addEventListener('click', handlePrevStep);
  document.getElementById('saveUserButton')?.addEventListener('click', saveUser);
  document.getElementById('triggerChangePassword')?.addEventListener('click', enablePasswordEdition);

  document.getElementById('verificacionAprobarBtn')?.addEventListener('click', () => handleVerificationAction('APROBADA'));
  document.getElementById('verificacionRechazarBtn')?.addEventListener('click', () => handleVerificationAction('RECHAZADA'));
  document.getElementById('verificacionObservarBtn')?.addEventListener('click', () => handleVerificationAction('OBSERVADA'));

  document.getElementById('verificacionDisableLawyerBtn')?.addEventListener('click', handleDisableLawyerFromModal);
  // Estudio: búsqueda de existentes
}

/* --------------- Paginación / filtros ----------- */
function handleSearchInput(event) {
  currentSearchTerm = (event?.target?.value || '').toLowerCase();
  usersPaginationState.page = 1;
  filterUsers();
}

function handleFilterChange(event) {
  currentRoleFilter = (event?.target?.value || '').toLowerCase();
  usersPaginationState.page = 1;
  filterUsers();
}

function getPaginatedUsers() {
  const { page, pageSize } = usersPaginationState;
  const start = (page - 1) * pageSize;
  return filteredUsers.slice(start, start + pageSize);
}

function updateUsersCountLabel() {
  const label = document.getElementById('usersCountLabel');
  const wrapper = document.getElementById('usersPaginationWrapper');
  if (!label || !wrapper) return;

  const total = filteredUsers.length;
  if (!users.length) {
    label.textContent = 'No hay usuarios registrados.';
    wrapper.classList.add('d-none');
    return;
  }

  if (!total) {
    label.textContent = 'No se encontraron usuarios con los filtros seleccionados.';
    wrapper.classList.remove('d-none');
    return;
  }

  const { page, pageSize } = usersPaginationState;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(start + pageSize - 1, total);
  label.textContent = `Mostrando ${start}-${end} de ${total} usuarios`;
  wrapper.classList.remove('d-none');
}

function renderUsersPagination() {
  const container = document.getElementById('usersPagination');
  if (!container) return;

  const total = filteredUsers.length;
  const { page, pageSize } = usersPaginationState;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (total <= pageSize) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const createItem = (label, disabled, targetPage) => {
    const li = document.createElement('li');
    li.className = `page-item ${disabled ? 'disabled' : ''}`;
    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'page-link';
    link.textContent = label;
    if (!disabled) {
      link.addEventListener('click', () => goToUsersPage(targetPage));
    }
    li.appendChild(link);
    return li;
  };

  container.appendChild(createItem('Anterior', page <= 1, Math.max(1, page - 1)));

  const infoItem = document.createElement('li');
  infoItem.className = 'page-item disabled';
  const infoLink = document.createElement('span');
  infoLink.className = 'page-link text-muted';
  infoLink.textContent = `Página ${page} de ${totalPages}`;
  infoItem.appendChild(infoLink);
  container.appendChild(infoItem);

  container.appendChild(createItem('Siguiente', page >= totalPages, Math.min(totalPages, page + 1)));
}

function goToUsersPage(targetPage) {
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPaginationState.pageSize));
  const page = Math.min(Math.max(1, targetPage), totalPages);
  if (page === usersPaginationState.page) return;
  usersPaginationState.page = page;
  renderUsersTable(getPaginatedUsers());
  renderUsersPagination();
  updateUsersCountLabel();
}

/* ----------------- Data loaders ---------------- */
async function loadUsers() {
  try {
    const data = await apiFetch('/users'); // array o {items:[]}
    const arr = Array.isArray(data) ? data : (data.items ?? []);
    const meta = Array.isArray(data) ? null : (data.meta ?? data.pagination ?? null);

    users = arr.map((u) => {
      const rawRoleId = u.role_id ?? u.rol_id ?? u.roleId ?? null;
      const normalizedRoleId = rawRoleId != null ? Number(rawRoleId) : null;
      const resolvedRole = u.role
        ?? roles.find((r) => r.id === normalizedRoleId)
        ?? (normalizedRoleId != null
          ? { id: normalizedRoleId, codigo: 'desconocido', nombre: 'Desconocido' }
          : null);
      const mapped = {
        ...u,
        role_id: normalizedRoleId,
        role: resolvedRole,
      };
      if (!('rol_id' in mapped) && normalizedRoleId != null) {
        mapped.rol_id = normalizedRoleId;
      }
      return mapped;
    });

    filteredUsers = [...users];
    usersPaginationState.totalItems = filteredUsers.length;
    if (meta?.pageSize) usersPaginationState.pageSize = Number(meta.pageSize) || USERS_DEFAULT_PAGE_SIZE;
    if (meta?.page) usersPaginationState.page = Number(meta.page) || 1;
    if (meta?.total != null && Number.isFinite(Number(meta.total))) {
      usersPaginationState.totalItems = Number(meta.total);
    }
    filterUsers();
  } catch (e) {
    showAlert(`No se pudieron cargar usuarios: ${e.message}`, 'danger');
    users = [];
    filteredUsers = [];
    renderUsersTable([]);
    updateUsersCountLabel();
    renderUsersPagination();
  }
}

async function loadRoles() {
  let loadError = null;
  try {
    const data = await apiFetch('/roles'); // [{id,codigo,nombre}]
    const list = Array.isArray(data)
      ? data
      : (Array.isArray(data?.data) ? data.data : (data.items ?? []));
    roles = list;
    if (data?.warning) {
      showAlert(data.warning, 'warning');
    } else if (!roles.length) {
      showAlert('No se recibieron roles desde la API. Verifica la configuración.', 'warning');
    }
  } catch (error) {
    loadError = error;
    roles = [];
    showAlert(`No se pudieron cargar roles: ${error.message}`, 'danger');
  } finally {
    populateRoleSelects();
    updateRoleAvailabilityFeedback();
    updatePersonaValidationState();
    if (!loadError) {
      validatePanelRolesAvailability();
    }
  }
}

async function loadEspecialidades() {
  try {
    const data = await apiFetch('/especialidades'); // [{id, nombre}]
    especialidades = Array.isArray(data) ? data : (data.items ?? []);
  } catch (error) {
    especialidades = [];
    showAlert(`No se pudieron cargar especialidades: ${error.message}`, 'danger');
  }
}

/* ----------------- Poblar selects -------------- */
function populateRoleSelects() {
  const filterSelect = document.getElementById('filterType');
  configureUserRoleSelect();
  const allowedRoles = getPanelAllowedRoles();
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Todos los tipos</option>';
    allowedRoles.forEach(role => {
      const option = document.createElement('option');
      option.value = (role?.codigo || '').toLowerCase();
      option.textContent = role?.nombre ?? role?.codigo ?? '';
      filterSelect.appendChild(option);
    });
    filterSelect.disabled = !allowedRoles.length;
  }
}

function configureUserRoleSelect({ selectedRoleId = null } = {}) {
  const select = document.getElementById('rol');
  if (!select) return;

  const resolvedSelectedId = selectedRoleId != null
    ? Number(selectedRoleId)
    : (select.value ? Number(select.value) : null);

  const allowedRoles = getPanelAllowedRoles();

  select.innerHTML = '<option value="">Seleccionar tipo</option>';
  allowedRoles.forEach((role) => {
    if (!role) return;
    const option = document.createElement('option');
    option.value = role.id;
    option.textContent = role.nombre;
    option.dataset.codigo = role.codigo;
    option.disabled = false;
    select.appendChild(option);
  });

  if (!allowedRoles.length) {
    select.disabled = true;
  }

  const disallowed = roles
    .filter(role => role && !PANEL_ALLOWED_ROLE_CODES.has((role.codigo || '').toLowerCase()))
    .sort((a, b) => String(a?.nombre ?? '').localeCompare(String(b?.nombre ?? ''), 'es', { sensitivity: 'base' }));

  disallowed.forEach((role) => {
    const option = document.createElement('option');
    option.value = role.id;
    option.textContent = `${role.nombre} (no disponible)`;
    option.dataset.codigo = role.codigo;
    option.disabled = true;
    select.appendChild(option);
  });

  if (resolvedSelectedId != null) {
    select.value = String(resolvedSelectedId);
  } else {
    select.value = '';
  }

  if (allowedRoles.length) {
    select.disabled = false;
  }

  updatePersonaValidationState();
}

function validatePanelRolesAvailability() {
  const { missingCodes } = describeRoleAvailability();
  if (missingCodes.length) {
    const humanList = missingCodes.map(code => code.toUpperCase()).join(', ');
    showAlert(`Advertencia: los roles ${humanList} no están disponibles en la API. Verifica la configuración del backend para exponerlos.`, 'warning');
  }
}

function getSelectedRoleCode() {
  const select = document.getElementById('rol');
  const option = select?.options[select.selectedIndex];
  return (option?.dataset?.codigo || '').toLowerCase();
}

function shouldRunPersonaValidations(roleCode = getSelectedRoleCode()) {
  return PANEL_ALLOWED_ROLE_CODES.has((roleCode || '').toLowerCase());
}

/* ----------------- Render/filters -------------- */
function getRoleBadge(code) {
  const roleColors = { cliente: 'bg-primary', abogado: 'bg-success', admin: 'bg-danger' };
  return roleColors[code] || 'bg-secondary';
}

function renderUsersTable(usersToRender) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!usersToRender.length) {
    const emptyMessage = users.length
      ? 'No se encontraron usuarios con los filtros actuales.'
      : 'No hay usuarios registrados todavía.';
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-4">${escapeHtml(emptyMessage)}</td></tr>`;
    return;
  }

  tbody.innerHTML = usersToRender.map(user => {
    const p = user.persona ?? {};
    const roleCode = getRoleCode(user);
    const badgeClass = getRoleBadge(user.role?.codigo);
    const verificationInfo = verificationBadgeInfo(mapVerificationFromUser(user));
    const verificationBadge = `<span class="badge ${verificationInfo.className}">${escapeHtml(verificationInfo.text)}</span>`;
    const isLawyer = roleCode === LAWYER_ROLE_CODE;
    const activeBadge = user.activo ? '' : ' <span class="badge bg-secondary">Deshabilitado</span>';
    const disableTitle = isLawyer
      ? (user.activo ? 'Deshabilitar cuenta de abogado' : 'Cuenta de abogado deshabilitada')
      : '';
    const disableButton = isLawyer
      ? `<button class="btn btn-sm btn-outline-dark me-1" title="${escapeHtml(disableTitle)}" ${user.activo ? `onclick="disableLawyer(${user.id})"` : 'disabled'}><i class="bi bi-person-slash"></i></button>`
      : '';
    const abogadoActions = isLawyer
      ? `
        <button class="btn btn-sm btn-outline-primary me-1" title="Especialidades" onclick="openEspecialidadesModal(${user.id})"><i class="bi bi-stars"></i></button>
        <button class="btn btn-sm btn-outline-secondary me-1" title="Estudio" onclick="openEstudioModal(${user.id})"><i class="bi bi-building"></i></button>
        <button class="btn btn-sm btn-outline-info me-1" title="Disponibilidad" onclick="openDisponibilidadModal(${user.id})"><i class="bi bi-calendar-week"></i></button>
        ${disableButton}
      `
      : '';

    const verificationButton = p.id
      ? `<button class="btn btn-sm btn-outline-success me-1" title="Revisar verificación" onclick="openVerificacionModal(${user.id})"><i class="bi bi-patch-check"></i></button>`
      : '';

    const editButton = isLawyer
      ? `<button class="btn btn-sm btn-outline-secondary me-1" title="Las cuentas de abogado se gestionan desde la app del profesional" disabled><i class="bi bi-pencil"></i></button>`
      : `<button class="btn btn-sm btn-warning me-1" title="Editar" onclick="editUser(${user.id})"><i class="bi bi-pencil"></i></button>`;

    const deleteReason = getDeleteRestrictionReason(user);
    const deleteButton = deleteReason
      ? `<button class="btn btn-sm btn-outline-secondary" title="${escapeHtml(deleteReason)}" disabled><i class="bi bi-trash"></i></button>`
      : `<button class="btn btn-sm btn-danger" title="Eliminar" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button>`;

    return `
      <tr>
        <td>${(p.primer_nombre ?? '')} ${(p.apellido_paterno ?? '')}</td>
        <td>${p.dni ?? ''}</td>
        <td>${p.telefono ?? 'N/A'}</td>
        <td>${p.correo ?? ''}</td>
        <td><span class="badge ${badgeClass}">${user.role?.nombre ?? ''}</span>${activeBadge}</td>
        <td>${verificationBadge}</td>
        <td>${user.creado_el ? formatDate(user.creado_el) : ''}</td>
        <td class="text-center">
          <div class="btn-group">
            ${editButton}
            ${verificationButton}${abogadoActions}
            ${deleteButton}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsers() {
  const normalizedTerm = currentSearchTerm.trim().toLowerCase();
  const normalizedFilter = currentRoleFilter.trim().toLowerCase();

  filteredUsers = users.filter(user => {
    const p = user.persona ?? {};
    const hay = `${p.primer_nombre ?? ''} ${p.apellido_paterno ?? ''} ${p.dni ?? ''} ${p.telefono ?? ''} ${p.correo ?? ''}`.toLowerCase();
    const searchMatch = !normalizedTerm || hay.includes(normalizedTerm);
    const roleCode = (user.role?.codigo || '').toLowerCase();
    const typeMatch = !normalizedFilter || roleCode === normalizedFilter;
    return searchMatch && typeMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPaginationState.pageSize));
  if (usersPaginationState.page > totalPages) {
    usersPaginationState.page = totalPages;
  }

  usersPaginationState.totalItems = filteredUsers.length;

  renderUsersTable(getPaginatedUsers());
  renderUsersPagination();
  updateUsersCountLabel();
}

/* ----------------- Wizard helpers -------------- */
function setStepAlert(elementId, message = null, type = 'info') {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.classList.remove('alert-info', 'alert-success', 'alert-danger', 'alert-warning');
  if (!message) {
    element.textContent = '';
    element.classList.add('d-none');
    return;
  }
  element.textContent = message;
  element.classList.remove('d-none');
  element.classList.add(`alert-${type}`);
}

function resetStepAlerts() {
  ['contactStepAlert', 'identityStepAlert', 'securityStepAlert'].forEach(id => setStepAlert(id, null));
}

function updateStepIndicator(currentStep) {
  const items = document.querySelectorAll('#userFormStepIndicator .step-indicator-item');
  items.forEach((item) => {
    const stepIndex = Number(item.dataset.step);
    const badge = item.querySelector('.badge');
    if (stepIndex === currentStep) {
      item.classList.add('active');
      item.classList.remove('text-muted');
      if (badge) {
        badge.classList.remove('bg-secondary');
        badge.classList.add('bg-primary');
      }
    } else {
      item.classList.remove('active');
      item.classList.add('text-muted');
      if (badge) {
        badge.classList.remove('bg-primary');
        badge.classList.add('bg-secondary');
      }
    }
  });
}

function setFormStep(step) {
  const state = ensureUserFormState();
  const normalized = Math.min(Math.max(1, Number(step) || 1), STEP_COUNT);
  state.step = normalized;
  const sections = document.querySelectorAll('.signup-step');
  sections.forEach(section => {
    const sectionStep = Number(section.dataset.step);
    if (sectionStep === normalized) {
      section.classList.remove('d-none');
    } else {
      section.classList.add('d-none');
    }
  });
  const prevButton = document.getElementById('prevStepButton');
  const nextButton = document.getElementById('nextStepButton');
  const saveButton = document.getElementById('saveUserButton');
  prevButton?.classList.toggle('d-none', normalized <= 1);
  nextButton?.classList.toggle('d-none', normalized >= STEP_COUNT);
  saveButton?.classList.toggle('d-none', normalized < STEP_COUNT);
  updateStepIndicator(normalized);
}

async function handleNextStep() {
  const state = ensureUserFormState();
  if (state.step === 1) {
    const ok = await processContactStep();
    if (!ok) return;
  }
  if (state.step === 2) {
    setStepAlert('identityStepAlert', 'Identidad confirmada.', 'success');
  }
  setFormStep(state.step + 1);
}

function handlePrevStep() {
  const state = ensureUserFormState();
  if (state.step <= 1) return;
  setFormStep(state.step - 1);
}

function handleTelefonoBlur(event) {
  const input = event?.target || event?.currentTarget;
  if (!input) return;
  const result = validatePhone(input.value);
  input.value = result.normalized || '';
  ensureUserFormState().verification.conflictsCleared = false;
  if (!result.valid && input.value) {
    setStepAlert('contactStepAlert', result.error || signupMessages.phoneInvalid, 'danger');
    showFieldError('telefonoFeedback', result.error || signupMessages.phoneInvalid);
  } else {
    showFieldError('telefonoFeedback', null);
  }
}

function handleDniInputChange(event) {
  const input = event?.target || event?.currentTarget;
  if (!input) return;
  const formatted = SignupValidation.formatDni
    ? SignupValidation.formatDni(input.value)
    : normalizeDigits(input.value).slice(0, 8);
  if (input.value !== formatted) input.value = formatted;
  const state = ensureUserFormState();
  if (state.dni.lastConsulted && state.dni.lastConsulted !== formatted) {
    state.dni.lookup = null;
    state.dni.error = null;
    state.dni.lastConsulted = null;
    state.verification.dniMatch = false;
    state.verification.dniLookup = null;
    state.verification.conflictsCleared = false;
    clearPersonalInfoFields();
    showFieldError('dniLookupFeedback', null);
  }
}

function updateDniLookupLoading(isLoading) {
  const button = document.getElementById('dniLookupButton');
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Consultando...';
  } else {
    const canRun = shouldRunPersonaValidations();
    button.disabled = !canRun;
    button.innerHTML = 'Consultar RENIEC';
  }
}

function showFieldError(elementId, message) {
  const element = document.getElementById(elementId);
  if (!element) return;
  if (!message) {
    element.textContent = '';
    element.classList.add('d-none');
  } else {
    element.textContent = message;
    element.classList.remove('d-none');
  }
}

function setButtonBusy(button, busy, { loadingText = 'Procesando...' } = {}) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalContent) {
      button.dataset.originalContent = button.innerHTML;
    }
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
  } else if (button.dataset.originalContent) {
    button.innerHTML = button.dataset.originalContent;
    delete button.dataset.originalContent;
  }
}

function clearPersonalInfoFields() {
  ['primerNombre', 'segundoNombre', 'apellidoPaterno', 'apellidoMaterno'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

function fillPersonalInfoFieldsFromLookup(data = {}) {
  const mapping = {
    primerNombre: data.primer_nombre ?? data.primerNombre,
    segundoNombre: data.segundo_nombre ?? data.segundoNombre,
    apellidoPaterno: data.apellido_paterno ?? data.apellidoPaterno,
    apellidoMaterno: data.apellido_materno ?? data.apellidoMaterno,
  };
  Object.entries(mapping).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input) input.value = value ? String(value).trim() : '';
  });
}

function updateEmailButtonsState() {
  const state = ensureUserFormState().email;
  const sendBtn = document.getElementById('emailSendCodeButton');
  const verifyBtn = document.getElementById('emailVerifyCodeButton');
  const codeInput = document.getElementById('emailCodigo');
  const isBusy = state.sending || state.validating;
  if (sendBtn) sendBtn.disabled = isBusy;
  if (verifyBtn) verifyBtn.disabled = state.verifying || !state.codeRequested;
  if (codeInput) codeInput.disabled = !state.codeRequested && state.status !== SignupValidation.VerificationStatus.VERIFIED;
}

function updateEmailVerificationStatusUI() {
  const state = ensureUserFormState().email;
  const emailInput = document.getElementById('email');
  const statusElement = document.getElementById('emailVerificationStatus');
  if (!statusElement) return;
  const normalizedEmail = normalizeEmail(emailInput?.value || '');
  state.status = SignupValidation.getEmailVerificationStatus({
    codeRequested: state.codeRequested,
    currentEmail: normalizedEmail,
    emailUsedForCode: state.emailUsedForCode,
    verifiedEmail: state.verifiedEmail,
    expiresAt: state.codeExpiresAt,
  });
  const text = EMAIL_STATUS_LABELS[state.status] || EMAIL_STATUS_LABELS[SignupValidation.VerificationStatus.NOT_REQUESTED];
  statusElement.textContent = text;
  statusElement.className = `small mt-1 ${EMAIL_STATUS_CLASSES[state.status] || 'text-muted'}`;
}

function resetUbigeoSelectors() {
  const state = ensureUserFormState();
  state.ubigeo.selectedDepartamento = '';
  state.ubigeo.selectedProvincia = '';
  state.ubigeo.selectedDistrito = '';
  populateDepartamentoSelect();
  populateProvinciaSelect();
  populateDistritoSelect();
}

function getSelectedUbigeoCodigo() {
  const state = ensureUserFormState();
  return state.ubigeo.selectedDistrito || '';
}

async function processContactStep() {
  const state = ensureUserFormState();
  const dniInput = document.getElementById('dni');
  const telefonoInput = document.getElementById('telefono');
  const emailInput = document.getElementById('email');
  const lineaInput = document.getElementById('lineaExactaDireccion');
  const rolSelect = document.getElementById('rol');

  const dniValidation = validateDni(dniInput?.value);
  if (!dniValidation.valid) {
    showFieldError('dniLookupFeedback', dniValidation.error || signupMessages.dniInvalid);
    setStepAlert('contactStepAlert', dniValidation.error || signupMessages.dniInvalid, 'danger');
    dniInput?.focus();
    return false;
  }

  if (!state.dni.lookup || state.dni.lastConsulted !== dniValidation.normalized) {
    await handleDniLookup();
    if (!state.dni.lookup) {
      return false;
    }
  }

  const phoneValidation = validatePhone(telefonoInput?.value);
  if (!phoneValidation.valid) {
    showFieldError('telefonoFeedback', phoneValidation.error || signupMessages.phoneInvalid);
    setStepAlert('contactStepAlert', phoneValidation.error || signupMessages.phoneInvalid, 'danger');
    telefonoInput?.focus();
    return false;
  }
  telefonoInput.value = phoneValidation.normalized;

  const emailValidation = validateEmail(emailInput?.value);
  if (!emailValidation.valid) {
    showFieldError('emailFeedback', emailValidation.error || signupMessages.emailInvalid);
    setStepAlert('contactStepAlert', emailValidation.error || signupMessages.emailInvalid, 'danger');
    emailInput?.focus();
    return false;
  }

  updateEmailVerificationStatusUI();
  if (state.email.status !== SignupValidation.VerificationStatus.VERIFIED) {
    const message = 'Debes verificar el correo antes de continuar.';
    showFieldError('emailCodeError', message);
    setStepAlert('contactStepAlert', message, 'danger');
    return false;
  }

  if (!state.ubigeo.selectedDepartamento || !state.ubigeo.selectedProvincia || !state.ubigeo.selectedDistrito) {
    const message = 'Selecciona departamento, provincia y distrito.';
    setStepAlert('contactStepAlert', message, 'danger');
    return false;
  }

  if (lineaInput) lineaInput.value = lineaInput.value.trim();
  if (!lineaInput?.value) {
    const message = 'Ingresa la dirección exacta.';
    setStepAlert('contactStepAlert', message, 'danger');
    lineaInput?.focus();
    return false;
  }

  if (!rolSelect?.value) {
    const message = 'Selecciona un tipo de usuario válido.';
    setStepAlert('contactStepAlert', message, 'danger');
    rolSelect?.focus();
    return false;
  }

  const normalizedEmail = normalizeEmail(emailInput.value);
  const personaIdForExclusion = state.personaId ?? state.dni.lookup?.personaId ?? null;
  const conflictMessage = await ensureNoPersonaConflicts({
    dni: dniValidation.normalized,
    telefono: phoneValidation.normalized,
    correo: normalizedEmail,
    excludeUserId: isEditing ? currentUserId : null,
    excludePersonaId: isEditing ? personaIdForExclusion : null,
  });

  if (conflictMessage) {
    setStepAlert('contactStepAlert', conflictMessage, 'danger');
    return false;
  }

  state.verification.dniMatch = true;
  state.verification.conflictsCleared = true;
  state.verification.emailVerification = {
    email: normalizedEmail,
    verifiedAt: new Date().toISOString(),
  };
  setStepAlert('contactStepAlert', 'Datos de contacto verificados correctamente.', 'success');
  setStepAlert('identityStepAlert', 'Verifica que los datos coincidan con el DNI consultado.', 'info');
  return true;
}

function preparePasswordFieldsForCreation() {
  const fields = document.getElementById('password-fields');
  const changeButton = document.getElementById('change-password-button');
  const claveInput = document.getElementById('clave');
  const confirmarInput = document.getElementById('confirmarClave');
  fields?.classList.remove('d-none');
  changeButton?.classList.add('d-none');
  if (claveInput) {
    claveInput.value = '';
    claveInput.required = true;
    claveInput.disabled = false;
  }
  if (confirmarInput) {
    confirmarInput.value = '';
    confirmarInput.required = true;
    confirmarInput.disabled = false;
  }
}

function preparePasswordFieldsForEdition() {
  const fields = document.getElementById('password-fields');
  const changeButton = document.getElementById('change-password-button');
  const claveInput = document.getElementById('clave');
  const confirmarInput = document.getElementById('confirmarClave');
  fields?.classList.add('d-none');
  changeButton?.classList.remove('d-none');
  if (claveInput) {
    claveInput.value = '';
    claveInput.required = false;
    claveInput.disabled = true;
  }
  if (confirmarInput) {
    confirmarInput.value = '';
    confirmarInput.required = false;
    confirmarInput.disabled = true;
  }
}

function enablePasswordEdition() {
  const fields = document.getElementById('password-fields');
  const changeButton = document.getElementById('change-password-button');
  fields?.classList.remove('d-none');
  changeButton?.classList.add('d-none');
  const claveInput = document.getElementById('clave');
  const confirmarInput = document.getElementById('confirmarClave');
  if (claveInput) {
    claveInput.disabled = false;
    claveInput.required = true;
    claveInput.focus();
  }
  if (confirmarInput) {
    confirmarInput.disabled = false;
    confirmarInput.required = true;
  }
}

function handleEmailInputChange(event) {
  const input = event?.target || event?.currentTarget;
  const value = input?.value ?? '';
  const normalizedEmail = normalizeEmail(value);
  const state = ensureUserFormState().email;
  if (state.verifiedEmail && normalizedEmail !== state.verifiedEmail) {
    state.verifiedEmail = null;
  }
  if (state.emailUsedForCode && normalizedEmail !== state.emailUsedForCode) {
    state.codeRequested = false;
    state.emailUsedForCode = null;
    state.codeSentAt = null;
    state.codeExpiresAt = null;
    const codeInput = document.getElementById('emailCodigo');
    if (codeInput) codeInput.value = '';
  }
  showFieldError('emailFeedback', null);
  showFieldError('emailCodeError', null);
  state.verification.conflictsCleared = false;
  state.verification.emailVerification = null;
  updateEmailVerificationStatusUI();
  updateEmailButtonsState();
}

async function handleEmailSendCode() {
  const state = ensureUserFormState().email;
  if (state.sending || state.validating) return;
  const emailInput = document.getElementById('email');
  const sendBtn = document.getElementById('emailSendCodeButton');
  const validation = validateEmail(emailInput?.value);
  if (!validation.valid) {
    showFieldError('emailFeedback', validation.error || signupMessages.emailInvalid);
    setStepAlert('contactStepAlert', validation.error || signupMessages.emailInvalid, 'danger');
    return;
  }

  const normalizedEmail = validation.normalized;
  ensureUserFormState().verification.conflictsCleared = false;
  ensureUserFormState().verification.emailVerification = null;
  setButtonBusy(sendBtn, true, { loadingText: 'Solicitando código...' });
  state.validating = true;
  updateEmailButtonsState();
  try {
    await apiFetch('/auth/email/validate', {
      method: 'POST',
      body: JSON.stringify({ correo: normalizedEmail }),
    });
    state.validating = false;
    state.sending = true;
    updateEmailButtonsState();

    const response = await apiFetch('/auth/email/request-code', {
      method: 'POST',
      body: JSON.stringify({ correo: normalizedEmail }),
    });

    const expirationRaw = response?.expiracion;
    state.codeRequested = true;
    state.emailUsedForCode = normalizedEmail;
    state.codeSentAt = new Date();
    state.codeExpiresAt = expirationRaw ? new Date(expirationRaw) : null;
    state.status = SignupValidation.VerificationStatus.CODE_SENT;
    state.verifiedEmail = null;
    setStepAlert('contactStepAlert', `Se envió un código de verificación a ${normalizedEmail}.`, 'success');
    showFieldError('emailFeedback', null);
    showFieldError('emailCodeError', null);
    updateEmailVerificationStatusUI();
    const codeInput = document.getElementById('emailCodigo');
    if (codeInput) {
      codeInput.disabled = false;
      codeInput.focus();
    }
  } catch (error) {
    const message = `${error?.message || 'No se pudo enviar el código de verificación.'} Puedes intentar solicitarlo nuevamente.`;
    showFieldError('emailFeedback', message);
    setStepAlert('contactStepAlert', message, 'danger');
  } finally {
    state.validating = false;
    state.sending = false;
    updateEmailButtonsState();
    updateEmailVerificationStatusUI();
    setButtonBusy(sendBtn, false);
  }
}

async function handleEmailVerifyCode() {
  const state = ensureUserFormState().email;
  if (state.verifying) return;

  const emailInput = document.getElementById('email');
  const codeInput = document.getElementById('emailCodigo');
  const verifyBtn = document.getElementById('emailVerifyCodeButton');
  const validation = validateEmail(emailInput?.value);
  if (!validation.valid) {
    showFieldError('emailFeedback', validation.error || signupMessages.emailInvalid);
    setStepAlert('contactStepAlert', validation.error || signupMessages.emailInvalid, 'danger');
    return;
  }

  const normalizedEmail = validation.normalized;
  if (!state.codeRequested || state.emailUsedForCode !== normalizedEmail) {
    const message = 'Solicita un código de verificación para el correo actual.';
    showFieldError('emailCodeError', message);
    setStepAlert('contactStepAlert', message, 'warning');
    return;
  }

  const code = normalizeDigits(codeInput?.value || '');
  if (!SignupValidation.isValidEmailCode(code)) {
    const message = signupMessages.emailCodeShort;
    showFieldError('emailCodeError', message);
    setStepAlert('contactStepAlert', message, 'danger');
    return;
  }

  state.verifying = true;
  setButtonBusy(verifyBtn, true, { loadingText: 'Validando código...' });
  updateEmailButtonsState();
  try {
    await apiFetch('/auth/email/verify-code', {
      method: 'POST',
      body: JSON.stringify({ correo: normalizedEmail, codigo: code }),
    });
    state.verifiedEmail = normalizedEmail;
    state.status = SignupValidation.VerificationStatus.VERIFIED;
    ensureUserFormState().verification.emailVerification = {
      email: normalizedEmail,
      verifiedAt: new Date().toISOString(),
    };
    showFieldError('emailCodeError', null);
    setStepAlert('contactStepAlert', 'Correo verificado correctamente.', 'success');
  } catch (error) {
    const message = `${error?.message || 'Código incorrecto o expirado.'} Puedes ingresar un nuevo código e intentarlo nuevamente.`;
    state.verifiedEmail = null;
    showFieldError('emailCodeError', message);
    setStepAlert('contactStepAlert', message, 'danger');
  } finally {
    state.verifying = false;
    updateEmailButtonsState();
    updateEmailVerificationStatusUI();
    setButtonBusy(verifyBtn, false);
  }
}

async function ensureDepartamentosLoaded() {
  const state = ensureUserFormState();
  if (ubigeoCache.departamentos) {
    populateDepartamentoSelect();
    return ubigeoCache.departamentos;
  }
  const select = document.getElementById('ubigeoDepartamento');
  if (select) {
    select.disabled = true;
    select.innerHTML = '<option value="">Cargando...</option>';
  }
  state.ubigeo.loadingDepartamentos = true;
  try {
    const data = await apiFetch('/ubigeo/departamentos');
    const list = Array.isArray(data)
      ? data
      : (Array.isArray(data?.data) ? data.data : (data.items ?? []));
    ubigeoCache.departamentos = list;
    if (data?.warning) {
      setStepAlert('contactStepAlert', data.warning, 'warning');
    }
  } catch (error) {
    ubigeoCache.departamentos = [];
    setStepAlert('contactStepAlert', `No se pudieron cargar los departamentos: ${error.message}. Puedes volver a abrir el selector para reintentar.`, 'danger');
  } finally {
    state.ubigeo.loadingDepartamentos = false;
    populateDepartamentoSelect();
  }
  return ubigeoCache.departamentos;
}

async function loadProvinciasForDepartamento(departamentoCodigo) {
  const state = ensureUserFormState();
  const select = document.getElementById('ubigeoProvincia');
  if (!departamentoCodigo) {
    state.ubigeo.selectedProvincia = '';
    state.ubigeo.selectedDistrito = '';
    populateProvinciaSelect();
    populateDistritoSelect();
    return [];
  }
  if (!ubigeoCache.provincias.has(departamentoCodigo)) {
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Cargando...</option>';
    }
    state.ubigeo.loadingProvincias = true;
    try {
      const data = await apiFetch(`/ubigeo/departamentos/${departamentoCodigo}/provincias`);
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : (data.items ?? []));
      ubigeoCache.provincias.set(departamentoCodigo, list);
      if (data?.warning) {
        setStepAlert('contactStepAlert', data.warning, 'warning');
      }
    } catch (error) {
      ubigeoCache.provincias.set(departamentoCodigo, []);
      setStepAlert('contactStepAlert', `No se pudieron cargar las provincias: ${error.message}. Selecciona nuevamente el departamento para reintentar.`, 'danger');
    } finally {
      state.ubigeo.loadingProvincias = false;
    }
  }
  populateProvinciaSelect(departamentoCodigo);
  populateDistritoSelect();
  return ubigeoCache.provincias.get(departamentoCodigo) || [];
}

async function loadDistritosForProvincia(provinciaCodigo) {
  const state = ensureUserFormState();
  const select = document.getElementById('ubigeoDistrito');
  if (!provinciaCodigo) {
    state.ubigeo.selectedDistrito = '';
    populateDistritoSelect();
    return [];
  }
  if (!ubigeoCache.distritos.has(provinciaCodigo)) {
    if (select) {
      select.disabled = true;
      select.innerHTML = '<option value="">Cargando...</option>';
    }
    state.ubigeo.loadingDistritos = true;
    try {
      const data = await apiFetch(`/ubigeo/provincias/${provinciaCodigo}/distritos`);
      const list = Array.isArray(data)
        ? data
        : (Array.isArray(data?.data) ? data.data : (data.items ?? []));
      ubigeoCache.distritos.set(provinciaCodigo, list);
      if (data?.warning) {
        setStepAlert('contactStepAlert', data.warning, 'warning');
      }
    } catch (error) {
      ubigeoCache.distritos.set(provinciaCodigo, []);
      setStepAlert('contactStepAlert', `No se pudieron cargar los distritos: ${error.message}. Selecciona nuevamente la provincia para reintentar.`, 'danger');
    } finally {
      state.ubigeo.loadingDistritos = false;
    }
  }
  populateDistritoSelect(provinciaCodigo);
  return ubigeoCache.distritos.get(provinciaCodigo) || [];
}

function populateDepartamentoSelect() {
  const select = document.getElementById('ubigeoDepartamento');
  if (!select) return;
  const state = ensureUserFormState();
  const options = ubigeoCache.departamentos || [];
  select.innerHTML = '<option value="">Seleccionar</option>';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.codigo;
    option.textContent = opt.nombre;
    select.appendChild(option);
  });
  select.disabled = state.ubigeo.loadingDepartamentos || !options.length;
  if (state.ubigeo.selectedDepartamento) {
    select.value = state.ubigeo.selectedDepartamento;
  }
}

function populateProvinciaSelect(departamentoCodigo = ensureUserFormState().ubigeo.selectedDepartamento) {
  const select = document.getElementById('ubigeoProvincia');
  if (!select) return;
  const state = ensureUserFormState();
  const options = departamentoCodigo ? (ubigeoCache.provincias.get(departamentoCodigo) || []) : [];
  select.innerHTML = '<option value="">Seleccionar</option>';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.codigo;
    option.textContent = opt.nombre;
    select.appendChild(option);
  });
  select.disabled = !departamentoCodigo || !options.length || state.ubigeo.loadingProvincias;
  if (state.ubigeo.selectedProvincia && !select.disabled) {
    select.value = state.ubigeo.selectedProvincia;
  }
}

function populateDistritoSelect(provinciaCodigo = ensureUserFormState().ubigeo.selectedProvincia) {
  const select = document.getElementById('ubigeoDistrito');
  if (!select) return;
  const state = ensureUserFormState();
  const options = provinciaCodigo ? (ubigeoCache.distritos.get(provinciaCodigo) || []) : [];
  select.innerHTML = '<option value="">Seleccionar</option>';
  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.codigo;
    option.textContent = opt.nombre;
    select.appendChild(option);
  });
  select.disabled = !provinciaCodigo || !options.length || state.ubigeo.loadingDistritos;
  if (state.ubigeo.selectedDistrito && !select.disabled) {
    select.value = state.ubigeo.selectedDistrito;
  }
}

async function handleDepartamentoChange(event) {
  const code = (event?.target?.value || '').trim();
  const state = ensureUserFormState();
  state.ubigeo.selectedDepartamento = code;
  state.ubigeo.selectedProvincia = '';
  state.ubigeo.selectedDistrito = '';
  state.verification.conflictsCleared = false;
  await loadProvinciasForDepartamento(code);
}

async function handleProvinciaChange(event) {
  const code = (event?.target?.value || '').trim();
  const state = ensureUserFormState();
  state.ubigeo.selectedProvincia = code;
  state.ubigeo.selectedDistrito = '';
  state.verification.conflictsCleared = false;
  await loadDistritosForProvincia(code);
}

function handleDistritoChange(event) {
  const code = (event?.target?.value || '').trim();
  const state = ensureUserFormState();
  state.ubigeo.selectedDistrito = code;
  state.verification.conflictsCleared = false;
}

async function setUbigeoFromCodigo(codigo) {
  if (!codigo) {
    resetUbigeoSelectors();
    return;
  }
  const state = ensureUserFormState();
  const departamento = codigo.slice(0, 2);
  const provincia = codigo.slice(0, 4);
  const distrito = codigo.slice(0, 6);
  state.ubigeo.selectedDepartamento = departamento;
  await ensureDepartamentosLoaded();
  await loadProvinciasForDepartamento(departamento);
  state.ubigeo.selectedProvincia = provincia;
  await loadDistritosForProvincia(provincia);
  state.ubigeo.selectedDistrito = distrito;
  populateDepartamentoSelect();
  populateProvinciaSelect(departamento);
  populateDistritoSelect(provincia);
}

/* ----------------- DNI lookup ------------------ */
async function handleDniLookup(event) {
  if (!shouldRunPersonaValidations()) {
    updatePersonaValidationState({ triggerAlert: true });
    return;
  }
  const input = event?.target || event?.currentTarget || document.getElementById('dni');
  if (!input) return;

  const formatted = SignupValidation.formatDni
    ? SignupValidation.formatDni(input.value)
    : normalizeDigits(input.value).slice(0, 8);
  input.value = formatted;

  const dniResult = validateDni(formatted);
  if (!dniResult.valid) {
    showFieldError('dniLookupFeedback', dniResult.error || signupMessages.dniInvalid);
    setStepAlert('contactStepAlert', dniResult.error || signupMessages.dniInvalid, 'danger');
    clearPersonalInfoFields();
    return;
  }

  const dni = dniResult.normalized;
  const state = ensureUserFormState();
  if (state.dni.loading) return;
  if (state.dni.lookup && state.dni.lastConsulted === dni) {
    return;
  }

  state.dni.loading = true;
  state.dni.error = null;
  updateDniLookupLoading(true);
  try {
    const data = await apiFetch(`/dni/${dni}`);
    if (data?.success && data?.data) {
      const d = data.data;
      fillPersonalInfoFieldsFromLookup(d);
      state.dni.lookup = {
        numero: dni,
        primerNombre: d.primer_nombre ?? '',
        segundoNombre: d.segundo_nombre ?? '',
        apellidoPaterno: d.apellido_paterno ?? '',
        apellidoMaterno: d.apellido_materno ?? '',
        personaId: null,
      };
      state.dni.lastConsulted = dni;
      state.dni.normalized = dni;
      state.verification.dniLookup = state.dni.lookup;
      state.verification.dniMatch = true;
      showFieldError('dniLookupFeedback', null);
      setStepAlert('contactStepAlert', 'DNI validado con RENIEC.', 'success');
    } else {
      throw new Error('No se encontró información del DNI.');
    }
  } catch (error) {
    const message = `${error?.message || 'Error consultando DNI.'} Puedes intentar consultar nuevamente.`;
    state.dni.lookup = null;
    state.dni.lastConsulted = null;
    state.dni.error = message;
    state.verification.dniLookup = null;
    state.verification.dniMatch = false;
    clearPersonalInfoFields();
    showFieldError('dniLookupFeedback', message);
    setStepAlert('contactStepAlert', message, 'danger');
  } finally {
    state.dni.loading = false;
    updateDniLookupLoading(false);
  }
}

/* ----------------- Modal usuario ---------------- */
function openUserModal() {
  isEditing = false;
  currentUserId = null;
  resetUserFormState();
  const form = document.getElementById('userForm');
  form?.reset();
  resetStepAlerts();
  document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
 const userIdInput = document.getElementById('userId');
  if (userIdInput) {
    userIdInput.value = '';
  }
  setValue('dni', '');
  setValue('telefono', '');
  setValue('email', '');
  setValue('emailCodigo', '');
  setValue('lineaExactaDireccion', '');
  clearPersonalInfoFields();
  preparePasswordFieldsForCreation();
  configureUserRoleSelect({ selectedRoleId: null });
  ensureDepartamentosLoaded();
  resetUbigeoSelectors();
  updateEmailVerificationStatusUI();
  updateEmailButtonsState();
  setFormStep(1);
}

async function editUser(userId) {
  try {
    const data = await apiFetch(`/users/${userId}`); // espera { ... , role, persona, perfilabogado? }
    const user = data?.user || data;
    if (!user) throw new Error('Usuario no encontrado');

    currentUserId = userId;
    isEditing = true;
    resetUserFormState();
    const form = document.getElementById('userForm');
    form?.reset();
    resetStepAlerts();

    document.getElementById('userModalLabel').textContent = 'Editar Usuario';

    const persona = user.persona ?? {};
    ensureUserFormState().personaId = persona.id ?? null;
    setValue('userId', user.id);
    setValue('dni', persona.dni);
    setValue('telefono', persona.telefono);
    setValue('email', persona.correo);
    setValue('emailCodigo', '');
    setValue('lineaExactaDireccion', persona.linea_exacta_direccion ?? persona.direccion ?? '');

    fillPersonalInfoFieldsFromLookup({
      primer_nombre: persona.primer_nombre,
      segundo_nombre: persona.segundo_nombre,
      apellido_paterno: persona.apellido_paterno,
      apellido_materno: persona.apellido_materno,
    });

    const emailState = ensureUserFormState().email;
    if (persona.correo) {
      emailState.verifiedEmail = normalizeEmail(persona.correo);
      emailState.codeRequested = false;
      emailState.emailUsedForCode = null;
    }
    updateEmailVerificationStatusUI();
    updateEmailButtonsState();

    const dniState = ensureUserFormState().dni;
    if (persona.dni) {
      dniState.normalized = persona.dni;
      dniState.lookup = {
        numero: persona.dni,
        primerNombre: persona.primer_nombre ?? '',
        segundoNombre: persona.segundo_nombre ?? '',
        apellidoPaterno: persona.apellido_paterno ?? '',
        apellidoMaterno: persona.apellido_materno ?? '',
        personaId: persona.id ?? null,
      };
      dniState.lastConsulted = persona.dni;
      ensureUserFormState().verification.dniMatch = true;
      ensureUserFormState().verification.dniLookup = dniState.lookup;
    } else {
      clearPersonalInfoFields();
    }

    ensureUserFormState().verification.conflictsCleared = true;
    ensureUserFormState().verification.emailVerification = {
      email: persona.correo ? normalizeEmail(persona.correo) : null,
      verifiedAt: new Date().toISOString(),
    };

    configureUserRoleSelect({ selectedRoleId: user.role_id ?? user.rol_id });

    await ensureDepartamentosLoaded();
    if (persona.direccion_id) {
      await setUbigeoFromCodigo(persona.direccion_id);
    } else {
      resetUbigeoSelectors();
    }

    preparePasswordFieldsForEdition();
    setFormStep(1);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
  } catch (e) {
    showAlert(`Error obteniendo usuario: ${e.message}`, 'danger');
  }
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el == null) return;
  el.value = (val ?? '').toString();
}

/* ----------------- Guardar usuario -------------- */
async function saveUser() {
  const form = document.getElementById('userForm');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }

  const state = ensureUserFormState();
  if (!state.verification.dniMatch || !state.verification.conflictsCleared) {
    setFormStep(1);
    setStepAlert('contactStepAlert', 'Completa la verificación de contacto e identidad antes de guardar.', 'danger');
    return;
  }

  const dniResult = validateDni(document.getElementById('dni')?.value);
  if (!dniResult.valid) {
    setFormStep(1);
    setStepAlert('contactStepAlert', dniResult.error || signupMessages.dniInvalid, 'danger');
    return;
  }
  const dni = dniResult.normalized;

  const emailResult = validateEmail(document.getElementById('email')?.value);
  if (!emailResult.valid) {
    setFormStep(1);
    setStepAlert('contactStepAlert', emailResult.error || signupMessages.emailInvalid, 'danger');
    return;
  }
  const email = emailResult.normalized;

  const phoneResult = validatePhone(document.getElementById('telefono')?.value);
  if (!phoneResult.valid) {
    setFormStep(1);
    setStepAlert('contactStepAlert', phoneResult.error || signupMessages.phoneInvalid, 'danger');
    return;
  }
  const telefonoNormalizado = phoneResult.normalized;

  // contraseña en creación
  let claveToSend;
  const pwContainer = document.getElementById('password-fields');
  if (pwContainer && !pwContainer.classList.contains('d-none')) {
    const clave = document.getElementById('clave')?.value || '';
    const confirmar = document.getElementById('confirmarClave')?.value || '';
    const passwordValidation = validatePasswordPair(clave, confirmar, { requireBoth: true });
    if (!passwordValidation.valid) {
      setFormStep(3);
      setStepAlert('securityStepAlert', passwordValidation.error || signupMessages.passwordShort, 'danger');
      return;
    }
    claveToSend = passwordValidation.password;
  }

  const rolSelect = document.getElementById('rol');
  const rolId = parseInt(rolSelect?.value || '', 10);
  const rolCodigo = getSelectedRoleCode();
  if (!rolId || Number.isNaN(rolId)) return showAlert('Selecciona un rol válido.', 'danger');
  if (!shouldRunPersonaValidations(rolCodigo)) {
    updatePersonaValidationState({ triggerAlert: true });
    return showAlert('Solo se pueden gestionar cuentas de clientes o administradores desde este panel.', 'danger');
  }

  const direccionId = getSelectedUbigeoCodigo();
  if (!direccionId) {
    setFormStep(1);
    setStepAlert('contactStepAlert', 'Selecciona el distrito del usuario.', 'danger');
    return;
  }

  const lineaExacta = trimOrUndefined(document.getElementById('lineaExactaDireccion')?.value);
  if (!lineaExacta) {
    setFormStep(1);
    setStepAlert('contactStepAlert', 'Ingresa la dirección exacta.', 'danger');
    return;
  }

  const personaPayload = {
    dni,
    telefono: telefonoNormalizado,
    correo: email,
    primer_nombre: trimOrUndefined(document.getElementById('primerNombre')?.value),
    segundo_nombre: trimOrUndefined(document.getElementById('segundoNombre')?.value),
    apellido_paterno: trimOrUndefined(document.getElementById('apellidoPaterno')?.value),
    apellido_materno: trimOrUndefined(document.getElementById('apellidoMaterno')?.value),
    linea_exacta_direccion: lineaExacta,
    direccion_id: direccionId,
  };

  const payloadUser = { persona: personaPayload, role_id: rolId, rol_id: rolId };
  if (claveToSend) payloadUser.clave = claveToSend;

  const currentUser = isEditing ? users.find(u => u.id === currentUserId) : null;
  const excludePersonaId = currentUser?.persona_id ?? currentUser?.persona?.id ?? state.personaId ?? null;

  const saveBtn = document.getElementById('saveUserButton');
  const originalSaveDisabled = saveBtn?.disabled ?? false;
  if (saveBtn) {
    saveBtn.disabled = true;
    setButtonBusy(saveBtn, true, { loadingText: isEditing ? 'Actualizando...' : 'Creando...' });
  }

  try {
    if (shouldRunPersonaValidations(rolCodigo)) {
      const conflictMessage = await ensureNoPersonaConflicts({
        dni,
        telefono: telefonoNormalizado,
        correo: email,
        excludeUserId: isEditing ? currentUserId : null,
        excludePersonaId,
      });
      if (conflictMessage) {
        setFormStep(1);
        setStepAlert('contactStepAlert', conflictMessage, 'danger');
        return;
      }
    }

    let saved;
    if (isEditing && currentUserId != null) {
      saved = await apiFetch(`/users/${currentUserId}`, { method: 'PUT', body: JSON.stringify(payloadUser) });
    } else {
      saved = await apiFetch('/users', { method: 'POST', body: JSON.stringify(payloadUser) });
      const createdUserId = saved?.user?.id ?? saved?.id;
      if (createdUserId != null) {
        currentUserId = createdUserId;
      }
    }

    const successMessage = saved?.message
      || (isEditing ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.');
    showAlert(successMessage, 'success');
    await loadUsers();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
  } catch (e) {
    const message = `${e?.message || 'Error guardando usuario'}. Corrige los datos o inténtalo nuevamente.`;
    setStepAlert('securityStepAlert', message, 'danger');
    showAlert(message, 'danger');
  } finally {
    if (saveBtn) {
      setButtonBusy(saveBtn, false);
      saveBtn.disabled = originalSaveDisabled;
    }
  }
}

async function ensureNoPersonaConflicts({ dni, telefono, correo, excludeUserId = null, excludePersonaId = null }) {
  const params = new URLSearchParams();
  if (dni) params.set('dni', dni);
  if (telefono) params.set('telefono', telefono);
  if (correo) params.set('correo', correo);
  if (excludeUserId != null) params.set('excludeUserId', excludeUserId);
  if (excludePersonaId != null) params.set('excludePersonaId', excludePersonaId);

  if (!params.toString()) return null;

  const response = await apiFetch(`/users/persona/conflicts?${params.toString()}`);
  const conflicts = response?.conflicts || {};

  const conflictDescriptions = [];
  if (conflicts.dni) conflictDescriptions.push('el DNI ingresado');
  if (conflicts.telefono) conflictDescriptions.push('el teléfono ingresado');
  if (conflicts.correo) conflictDescriptions.push('el correo electrónico ingresado');

  if (!conflictDescriptions.length) return null;

  if (conflictDescriptions.length === 1) {
    return `Ya existe un usuario registrado con ${conflictDescriptions[0]}.`;
  }

  const last = conflictDescriptions.pop();
  return `Ya existe un usuario registrado con ${conflictDescriptions.join(', ')} y ${last}.`;
}

/* ----------------- Especialidades --------------- */
async function openEspecialidadesModal(userId) {
  currentUserId = userId;
  // cargar actuales
  try {
    const data = await apiFetch(`/users/${userId}/especialidades`); // {ids:[...]} o [{id,...}]
    const ids = Array.isArray(data)
      ? data.map(e => e.especialidad_id ?? e.id)
      : (data.ids ?? []);
    renderEspecialidadesReadOnly(ids);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('especialidadesModal')).show();
  } catch (e) {
    showAlert(`No se pudieron cargar especialidades: ${e.message}`, 'danger');
  }
}

function renderEspecialidadesReadOnly(ids) {
  const cont = document.getElementById('especialidadesActuales');
  if (!cont) return;
  if (!ids.length) {
    cont.innerHTML = '<span class="text-muted">Sin especialidades registradas.</span>';
    return;
  }
  cont.innerHTML = ids.map(id => {
    const esp = especialidades.find(e => e.id === id);
    const nombre = esp ? escapeHtml(esp.nombre) : `ID ${escapeHtml(String(id))}`;
    return `<span class="badge bg-secondary me-2 mb-2">${nombre}</span>`;
  }).join('');
}

/* ----------------- Estudio + vínculo ------------- */
function openEstudioModal(userId) {
  currentUserId = userId;
  // limpiar
  setValue('estudioUserId', userId);
  setValue('estudioId', '');
  ['buscarEstudio','estudioRuc','estudioNombre','estudioPais','estudioCiudad','estudioCorreo','estudioTelefono','estudioDireccion','rolEnEstudio']
    .forEach(id => setValue(id, ''));
  const chk = document.getElementById('estudioPrincipal'); if (chk) chk.checked = false;
  const sugerencias = document.getElementById('sugerenciasEstudio');
  if (sugerencias) sugerencias.innerHTML = '';

  apiFetch(`/users/${userId}/estudios`).then(list => {
    const arr = Array.isArray(list) ? list : (list.items ?? []);
    if (sugerencias) {
      if (!arr.length) {
        sugerencias.innerHTML = '<div class="list-group-item text-muted">Sin estudios registrados</div>';
      } else {
        sugerencias.innerHTML = arr.map(v => {
          const estudio = v.estudio ?? {};
          const nombre = escapeHtml(estudio.nombre_comercial ?? `ID ${v.estudio_id}`);
          const rol = v.rol_en_estudio ? ` – ${escapeHtml(v.rol_en_estudio)}` : '';
          const principalBadge = v.principal ? '<span class="badge bg-primary ms-2">Principal</span>' : '';
          return `<div class="list-group-item d-flex justify-content-between align-items-start">
            <div>
              <div class="fw-semibold">${nombre}${rol}</div>
              <small class="text-muted">RUC: ${escapeHtml(estudio.ruc ?? 'N/A')}</small>
            </div>
            ${principalBadge}
          </div>`;
        }).join('');
      }
    }

    const principal = arr.find(v => v.principal) ?? arr[0];
    if (principal) {
      setValue('estudioId', principal.estudio_id);
      setValue('rolEnEstudio', principal.rol_en_estudio ?? '');
      const chk2 = document.getElementById('estudioPrincipal'); if (chk2) chk2.checked = !!principal.principal;
      const est = principal.estudio ?? {};
      setValue('estudioRuc', est.ruc);
      setValue('estudioNombre', est.nombre_comercial);
      setValue('estudioPais', est.pais);
      setValue('estudioCiudad', est.ciudad);
      setValue('estudioCorreo', est.correo_contacto);
      setValue('estudioTelefono', est.telefono);
      setValue('estudioDireccion', est.direccion);
    }
  }).catch(() => {
    if (sugerencias) {
      sugerencias.innerHTML = '<div class="list-group-item text-muted">No se pudo cargar la información del estudio.</div>';
    }
  });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('estudioModal')).show();
}


/* ----------------- Disponibilidad ---------------- */
async function openDisponibilidadModal(userId) {
  currentUserId = userId;
  try {
    const data = await apiFetch(`/users/${userId}/disponibilidad`);

    currentAvailability = Array.isArray(data) ? data : (data.items ?? []);
    renderSchedule(currentAvailability);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('disponibilidadModal')).show();
  } catch (e) {
    showAlert(`No se pudo cargar la disponibilidad: ${e.message}`, 'danger');
  }
}

function renderSchedule(availability = []) {
  const container = document.getElementById('schedule-container');
  if (!container) return;
  if (!availability.length) {
    container.innerHTML = '<div class="text-muted p-3">Sin horarios registrados.</div>';
    return;
  }

  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hours = Array.from({length: 14}, (_, i) => 8 + i); // 08:00 a 21:00
  let html = '<div class="schedule-header"></div>' + days.map(d => `<div class="schedule-header">${d}</div>`).join('');
  hours.forEach(hour => {
    html += `<div class="schedule-time">${String(hour).padStart(2,'0')}:00</div>`;
    days.forEach((_, dayIndex) => { html += `<div class="schedule-slot" id="slot-${dayIndex + 1}-${hour}"></div>`; });
  });
  container.innerHTML = html;

  availability.forEach(slot => {
    const day = Number(slot.dia_semana);
    const start = fromTimeDB(slot.hora_inicio);
    const end   = fromTimeDB(slot.hora_fin);
    if (!start || !end || Number.isNaN(day)) return;

    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    if (Number.isNaN(sh) || Number.isNaN(eh)) return;

    const durationHours = (eh + (em || 0)/60) - (sh + (sm || 0)/60);
    const cell = document.getElementById(`slot-${day}-${sh}`);
    if (cell && durationHours > 0) {
      const block = document.createElement('div');
      block.className = 'availability-block';
      block.style.top = `${((sm || 0) / 60) * 100}%`;
      block.style.height = `${durationHours * 100}%`;
      block.textContent = `${start} - ${end}`;
      cell.appendChild(block);
    }
  });
}


/* ----------------- Verificación de abogado -------- */
function openVerificacionModal(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    showAlert('Usuario no encontrado.', 'danger');
    return;
  }

  currentVerificationUserId = userId;
  currentVerificationPersonaId = user.persona?.id ?? null;
  verificationModalInstance = bootstrap.Modal.getOrCreateInstance(document.getElementById('verificacionModal'));
  populateVerificationModal(user);
  verificationModalInstance.show();
}

function setVerificationButtonsEnabled(enabled) {
  ['verificacionAprobarBtn', 'verificacionRechazarBtn', 'verificacionObservarBtn'].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = !enabled;
  });
}

function setVerificationLoading(isLoading) {
  verificationLoading = isLoading;
  const indicator = document.getElementById('verificacionSavingIndicator');
  if (indicator) indicator.classList.toggle('d-none', !isLoading);
  if (isLoading) {
    setVerificationButtonsEnabled(false);
  } else {
    updateVerificationControls();

  }
}


function updateVerificationControls() {
  const disableBtn = document.getElementById('verificacionDisableLawyerBtn');
  const notice = document.getElementById('verificacionDisableNotice');
  const user = users.find(u => u.id === currentVerificationUserId);

  if (!user) {
    verificationActionsLocked = false;
    setVerificationButtonsEnabled(false);
    if (disableBtn) {
      disableBtn.classList.add('d-none');
      disableBtn.disabled = true;
      disableBtn.dataset.userId = '';
    }
    if (notice) {
      notice.textContent = '';
      notice.classList.add('d-none');
    }
    return;
  }

  const verification = mapVerificationFromUser(user);
  const personaId = user.persona?.id ?? user.persona_id ?? null;
  const hasApplication = Boolean(verification.exists && personaId != null);
  const hasLawyerAccount = personaId != null ? personaHasLawyerAccount(personaId) : false;
  const hasActiveLawyer = personaId != null ? personaHasActiveLawyerAccount(personaId) : false;

  verificationActionsLocked = hasApplication && hasLawyerAccount;

  if (disableBtn) {
    if (hasLawyerAccount) {
      disableBtn.classList.remove('d-none');
      const activeAccount = hasActiveLawyer
        ? getLawyerAccountsByPersona(personaId).find((u) => u.activo)
        : null;
      disableBtn.dataset.userId = activeAccount ? String(activeAccount.id) : '';
      disableBtn.disabled = !activeAccount;
    } else {
      disableBtn.classList.add('d-none');
      disableBtn.disabled = true;
      disableBtn.dataset.userId = '';
    }
  }

  if (notice) {
    if (hasLawyerAccount) {
      const message = hasActiveLawyer
        ? 'La persona ya cuenta con acceso de abogado aprobado. Deshabilita la cuenta para impedir su ingreso. El estado de la postulación no puede modificarse desde aquí.'
        : 'La cuenta de abogado se encuentra deshabilitada. El estado de la postulación permanece aprobado y no puede modificarse desde aquí.';
      notice.textContent = message;
      notice.classList.remove('d-none');
    } else {
      notice.textContent = '';
      notice.classList.add('d-none');
    }
  }

  const canModify = hasApplication && !verificationLoading && !hasLawyerAccount;
  setVerificationButtonsEnabled(canModify);
}


function populateVerificationModal(user) {
  const persona = user.persona ?? {};
  const verification = mapVerificationFromUser(user);
  currentVerificationEstado = verification.estado || null;

  const nameEl = document.getElementById('verificacionNombre');
  if (nameEl) {
    const nombre = personaNombreCompleto(persona) || '(sin nombre)';
    const dni = persona.dni ? ` · DNI ${persona.dni}` : '';
    nameEl.textContent = `${nombre}${dni}`;
  }

  const badgeEl = document.getElementById('verificacionEstadoBadge');
  const badgeInfo = verificationBadgeInfo(verification);
  if (badgeEl) {
    badgeEl.className = `badge ${badgeInfo.className}`;
    badgeEl.textContent = badgeInfo.text;
  }

  const emptyNotice = document.getElementById('verificacionEmptyNotice');
  const dataSection = document.getElementById('verificacionDataSection');
  const commentSection = document.getElementById('verificacionComentarioSection');
  const obsPrevias = document.getElementById('verificacionObservacionesPrevias');
  const obsInput = document.getElementById('verificacionObservacionesInput');

  const hasPersona = !!persona.id;
  const hasApplication = verification.exists && hasPersona;

  emptyNotice?.classList.toggle('d-none', hasApplication);
  dataSection?.classList.toggle('d-none', !hasApplication);
  commentSection?.classList.toggle('d-none', !hasApplication);

  if (!hasPersona) {
    setVerificationButtonsEnabled(false);
    currentVerificationPersonaId = null;
    if (obsInput) obsInput.value = '';
    if (obsPrevias) obsPrevias.classList.add('d-none');
    updateVerificationControls();

    return;
  }

  currentVerificationPersonaId = persona.id;

  if (!hasApplication) {
    setVerificationButtonsEnabled(false);
    if (obsInput) obsInput.value = '';
    if (obsPrevias) obsPrevias.classList.add('d-none');
    updateVerificationControls();

    return;
  }


  const setText = (id, value, emptyText = 'No registrado') => {
    const el = document.getElementById(id);
    if (!el) return;
    if (value) {
      el.textContent = value;
      el.classList.remove('text-muted');
    } else {
      el.textContent = emptyText;
      el.classList.add('text-muted');
    }
  };

  const setLink = (id, url, label, emptyText = 'No disponible') => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.classList.remove('text-muted');
    if (!url) {
      el.textContent = emptyText;
      el.classList.add('text-muted');
      return;
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.textContent = label || url;
    el.appendChild(anchor);
  };


  const setFilePreview = (id, record) => {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    container.classList.add('d-none');
    container.classList.remove('text-muted');

    if (!record || record.isLinkOnly) return;
    const url = record.url || record.ruta;
    if (!url) return;

    const type = inferArchivoMimeType(record) || String(record.tipo || '').toLowerCase();
    let previewElement = null;

    if (type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Vista previa del archivo';
      img.className = 'img-fluid rounded border';
      img.loading = 'lazy';
      previewElement = img;
    } else if (type.startsWith('video/')) {
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.className = 'w-100 rounded border';
      video.setAttribute('playsinline', 'true');
      previewElement = video;
    } else if (type.startsWith('audio/')) {
      const audio = document.createElement('audio');
      audio.src = url;
      audio.controls = true;
      audio.className = 'w-100';
      previewElement = audio;
    } else {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.width = '100%';
      iframe.height = '420';
      iframe.className = 'border rounded w-100';
      iframe.loading = 'lazy';
      iframe.title = 'Vista previa del archivo adjunto';
      previewElement = iframe;
    }

    if (!previewElement) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'd-flex flex-column gap-2';
    wrapper.appendChild(previewElement);

    const actions = document.createElement('div');
    actions.className = 'd-flex flex-wrap gap-2';
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.target = '_blank';
    downloadLink.rel = 'noopener';
    downloadLink.className = 'btn btn-outline-secondary btn-sm';
    downloadLink.textContent = 'Descargar';
    downloadLink.setAttribute('download', '');
    actions.appendChild(downloadLink);
    wrapper.appendChild(actions);

    const helper = document.createElement('p');
    helper.className = 'small text-muted mb-0';
    helper.textContent = 'Si la vista previa no carga correctamente, utiliza la opción Descargar.';
    wrapper.appendChild(helper);

    container.appendChild(wrapper);
    container.classList.remove('d-none');

  
  };


  setLink('verificacionLinkedin', verification.linkedin_url, verification.linkedin_url);

  const tituloArchivo = verification.titulo;
  renderArchivoLink('verificacionTituloArchivo', tituloArchivo);
  setFilePreview('verificacionTituloPreview', tituloArchivo);


  const colegiatura = verification.colegiatura;
  setText('verificacionColegioNombre', colegiatura?.colegio?.nombre);
  setText('verificacionColegioRegion', colegiatura?.colegio?.region, 'Sin región');
  setText('verificacionNumeroColegiatura', colegiatura?.numero);
  setText('verificacionFechaEmision', colegiatura?.fecha_emision ? formatDate(colegiatura.fecha_emision) : '', 'No registrada');
  setText('verificacionFechaVigencia', colegiatura?.fecha_vigencia_hasta ? formatDate(colegiatura.fecha_vigencia_hasta) : '', 'No registrada');

  const carnetArchivo = colegiatura?.carnet_archivo;
  renderArchivoLink('verificacionCarnetArchivo', carnetArchivo);
  setFilePreview('verificacionCarnetPreview', carnetArchivo);

  const actualizado = verification.actualizado_el || verification.creado_el;
  setText('verificacionActualizado', actualizado ? formatDateTime(actualizado) : '', 'Sin actualizar');

  if (obsPrevias) {
    if (verification.observaciones) {
      obsPrevias.textContent = verification.observaciones;
      obsPrevias.classList.remove('d-none');
    } else {
      obsPrevias.textContent = '';
      obsPrevias.classList.add('d-none');
    }
  }

  if (obsInput) {
    obsInput.value = verification.observaciones ?? '';
  }
  updateVerificationControls();
}

async function handleDisableLawyerFromModal() {
  const btn = document.getElementById('verificacionDisableLawyerBtn');
  const userIdStr = btn?.dataset.userId || '';
  const lawyerId = parseInt(userIdStr, 10);

  if (!btn || Number.isNaN(lawyerId)) {
    showAlert('No se encontró una cuenta de abogado activa para deshabilitar.', 'warning');
    return;
  }

  await disableLawyer(lawyerId);
}

async function disableLawyer(userId, options = {}) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    showAlert('No se encontró la cuenta de abogado.', 'danger');
    return;
  }

  if (!user.activo) {
    if (!options.silent) {
      showAlert('La cuenta de abogado ya está deshabilitada.', 'info');
    }
    return;
  }

  const confirmMessage = options.confirmMessage || '¿Deseas deshabilitar el acceso de esta cuenta de abogado?';
  if (options.askConfirm !== false && !window.confirm(confirmMessage)) {
    return;
  }

  try {
    await apiFetch(`/users/${userId}/activo`, {
      method: 'PATCH',
      body: JSON.stringify({ activo: false }),
    });

    users = users.map((u) => (u.id === userId ? { ...u, activo: false } : u));

    if (!options.silent) {
      showAlert('Cuenta de abogado deshabilitada.', 'success');
    }

    filterUsers();

    if (currentVerificationUserId != null) {
      const currentUser = users.find((u) => u.id === currentVerificationUserId);
      if (currentUser) {
        populateVerificationModal(currentUser);
      } else {
        updateVerificationControls();
      }
    } else {
      updateVerificationControls();
    }
  } catch (e) {
    showAlert(`Error deshabilitando abogado: ${e.message}`, 'danger');
  }
}

async function handleVerificationAction(estado) {
  if (verificationLoading) return;

  if (verificationActionsLocked) {
    showAlert('Esta persona ya cuenta con un rol de abogado. Deshabilita su cuenta de abogado para restringir el acceso.', 'warning');
    return;
  }


  const personaId = currentVerificationPersonaId;
  if (!personaId) {
    showAlert('No hay una postulación asociada para este usuario.', 'danger');
    return;
  }

  const user = users.find(u => u.id === currentVerificationUserId);
  if (!user) {
    showAlert('Usuario no encontrado.', 'danger');
    return;
  }

  const verification = mapVerificationFromUser(user);
  const obsInput = document.getElementById('verificacionObservacionesInput');
  const observaciones = (obsInput?.value ?? '').trim();

  if (estado === 'OBSERVADA' && !observaciones) {
    showAlert('Debes ingresar un comentario para marcar como OBSERVADA.', 'danger');
    obsInput?.focus();
    return;
  }

  const payload = { estado };
  if (observaciones) {
    payload.observaciones = observaciones;
  }

  const isFinal = verification.estado === 'APROBADA' || verification.estado === 'RECHAZADA';
  if (isFinal && estado !== verification.estado) {
    const confirmForce = window.confirm('La postulación ya se marcó como finalizada. ¿Deseas forzar el cambio de estado?');
    if (!confirmForce) {
      return;
    }
    payload.force = true;
  }

  try {
    setVerificationLoading(true);
    const result = await apiFetch(`/lawyers/applications/${personaId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });

    if (result?.application) {
      applyVerificationUpdate(currentVerificationUserId, result.application);
      const updatedUser = users.find(u => u.id === currentVerificationUserId);
      if (updatedUser) {
        populateVerificationModal(updatedUser);
      }
      renderUsersTable(users);
      showAlert('Estado de verificación actualizado.', 'success');
    } else {
      showAlert('No se recibió la postulación actualizada.', 'warning');
    }
  } catch (e) {
    showAlert(`Error actualizando verificación: ${e.message}`, 'danger');
  } finally {
    setVerificationLoading(false);
  }
}

function applyVerificationUpdate(userId, application) {
  const idx = users.findIndex(u => u.id === userId);
  if (idx === -1) return;

  const user = users[idx];
  user.persona = user.persona ?? {};

  const normalizedTitulo = normalizeArchivoRecord(application.tituloArchivo);
  const normalizedCarnet = normalizeArchivoRecord(application.colegiatura?.carnetArchivo);


  const colegiatura = application.colegiatura
    ? {
        id: application.colegiatura.id,
        persona_id: application.colegiatura.personaId ?? user.persona.id,
        colegio_id: application.colegiatura.colegioId,
        numero: application.colegiatura.numero,
        fecha_emision: application.colegiatura.fechaEmision,
        fecha_vigencia_hasta: application.colegiatura.fechaVigenciaHasta,
        carnet_archivo_id: application.colegiatura.carnetArchivoId ?? normalizedCarnet?.id ?? null,
        carnet_archivo: normalizedCarnet,
        colegio: application.colegiatura.colegio
          ? {
              id: application.colegiatura.colegio.id,
              nombre: application.colegiatura.colegio.nombre,
              region: application.colegiatura.colegio.region,
            }
          : null,
      }
    : null;

  user.persona.verificacionabogado = {
    id: application.id,
    persona_id: application.personaId,
    estado: application.estado,
    linkedin_url: application.linkedinUrl,
    observaciones: application.observaciones,
    aprobado_el: application.aprobadoEl,
    creado_el: application.creadoEl,
    actualizado_el: application.actualizadoEl,
    titulo_archivo_id: application.tituloArchivoId ?? normalizedTitulo?.id ?? null,
    titulo: normalizedTitulo,
    colegiatura_id: colegiatura?.id ?? null,
    colegiatura,
  };

  if (colegiatura) {
    user.persona.colegiatura = colegiatura;
  }
}


/* ----------------- Delete usuario ---------------- */
function deleteUser(userId) {
  const user = users.find((u) => u.id === userId);
  if (!user) {
    showAlert('Usuario no encontrado.', 'danger');
    return;
  }

  const restriction = getDeleteRestrictionReason(user);
  if (restriction) {
    showAlert(restriction, 'warning');
    return;
  }
  currentUserId = userId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
  try {
    if (currentUserId == null) return showAlert('No se seleccionó usuario.', 'danger');
    await apiFetch(`/users/${currentUserId}`, { method: 'DELETE' });
    showAlert('Usuario eliminado con éxito.', 'success');
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    await loadUsers();
  } catch (e) {
    showAlert(`Error eliminando usuario: ${e.message}`, 'danger');
  }
}

/* ----------------- Helpers UI ------------------- */
function showAlert(message, type = 'info', isHTML = false) {
  let alertContainer = document.getElementById('alerts-container');
  if (!alertContainer) {
    alertContainer = document.createElement('div');
    alertContainer.id = 'alerts-container';
    alertContainer.style.position = 'fixed';
    alertContainer.style.top = '20px';
    alertContainer.style.right = '20px';
    alertContainer.style.zIndex = '9999';
    document.body.appendChild(alertContainer);
  }
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.style.minWidth = '320px';
  const closeBtn = `<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  alertDiv.innerHTML = isHTML ? `${message} ${closeBtn}` : `${escapeHtml(String(message))} ${closeBtn}`;
  alertContainer.appendChild(alertDiv);
  setTimeout(() => { try { new bootstrap.Alert(alertDiv).close(); } catch {} }, 5000);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function unescapeHtml(s) {
  const t = document.createElement('textarea'); t.innerHTML = s; return t.value;
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}
