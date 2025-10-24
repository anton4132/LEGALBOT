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


const API_BASE_URL = '/api';

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
const onlyDigits       = (s) => String(s ?? '').replace(/\D+/g, '');
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

const isEmail          = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s ?? '').trim());
const isDNI            = (s) => /^\d{8}$/.test(String(s ?? '').trim());
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
const PANEL_ALLOWED_ROLE_CODES = new Set(['cliente', 'admin']);

function getPanelAllowedRoles() {
  return roles.filter((role) => PANEL_ALLOWED_ROLE_CODES.has((role?.codigo || '').toLowerCase()));
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
    await Promise.all([loadRoles(), loadEspecialidades()]);
    await loadUsers();
    setupEventListeners();
  } catch (e) {
    showAlert(`Error inicializando: ${e.message}`, 'danger');
  }
});

function logout() {
  // implementar si corresponde
  console.log("Cerrando sesión...");
}

/* --------------- Listeners UI ------------------ */
function setupEventListeners() {
  document.getElementById('searchInput')?.addEventListener('input', filterUsers);
  document.getElementById('filterType')?.addEventListener('change', filterUsers);
  document.getElementById('userForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
  document.getElementById('dni')?.addEventListener('blur', handleDniLookup);

  document.getElementById('verificacionAprobarBtn')?.addEventListener('click', () => handleVerificationAction('APROBADA'));
  document.getElementById('verificacionRechazarBtn')?.addEventListener('click', () => handleVerificationAction('RECHAZADA'));
  document.getElementById('verificacionObservarBtn')?.addEventListener('click', () => handleVerificationAction('OBSERVADA'));

  document.getElementById('verificacionDisableLawyerBtn')?.addEventListener('click', handleDisableLawyerFromModal);
  // Estudio: búsqueda de existentes
}

/* ----------------- Data loaders ---------------- */
async function loadUsers() {
  try {
    const data = await apiFetch('/users'); // array o {items:[]}
    const arr = Array.isArray(data) ? data : (data.items ?? []);
    // Asegura role normalizado
    users = arr.map(u => ({
      ...u,
      role: u.role ?? roles.find(r => r.id === u.rol_id) ?? { id: u.rol_id, codigo: 'desconocido', nombre: 'Desconocido' }
    }));
    filterUsers();
  } catch (e) {
    showAlert(`No se pudieron cargar usuarios: ${e.message}`, 'danger');
    renderUsersTable([]);
  }
}

async function loadRoles() {
  const data = await apiFetch('/roles'); // [{id,codigo,nombre}]
  roles = Array.isArray(data) ? data : (data.items ?? []);
  if (!roles.length) throw new Error('No se recibieron roles');
  populateRoleSelects();
}

async function loadEspecialidades() {
  const data = await apiFetch('/especialidades'); // [{id, nombre}]
  especialidades = Array.isArray(data) ? data : (data.items ?? []);
}

/* ----------------- Poblar selects -------------- */
function populateRoleSelects() {
  const filterSelect = document.getElementById('filterType');
  configureUserRoleSelect();
  const allowedRoles = getPanelAllowedRoles().sort((a, b) => {
    const nameA = String(a?.nombre ?? '').toLowerCase();
    const nameB = String(b?.nombre ?? '').toLowerCase();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Todos los tipos</option>';
    allowedRoles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.codigo;
      option.textContent = role.nombre;
      filterSelect.appendChild(option);
    });
  }
}

function configureUserRoleSelect({ selectedRoleId = null } = {}) {
  const select = document.getElementById('rol');
  if (!select) return;

  const resolvedSelectedId = selectedRoleId != null
    ? Number(selectedRoleId)
    : (select.value ? Number(select.value) : null);

  const allowedRoles = getPanelAllowedRoles();
  const options = [...allowedRoles];

  options.sort((a, b) => {
    const nameA = String(a?.nombre ?? '').toLowerCase();
    const nameB = String(b?.nombre ?? '').toLowerCase();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });

  select.innerHTML = '<option value="">Seleccionar tipo</option>';
  options.forEach((role) => {
    if (!role) return;
    const option = document.createElement('option');
    option.value = role.id;
    option.textContent = role.nombre;
    option.dataset.codigo = role.codigo;
    if (!PANEL_ALLOWED_ROLE_CODES.has((role.codigo || '').toLowerCase())) {
      option.disabled = true;
    }
    select.appendChild(option);
  });

  if (resolvedSelectedId != null) {
    select.value = String(resolvedSelectedId);
  } else {
    select.value = '';
  }

  select.disabled = false;
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
    tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted p-4">No se encontraron usuarios</td></tr>`;
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
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filterType = document.getElementById('filterType')?.value || '';

  const filtered = users.filter(user => {
    const p = user.persona ?? {};
    const hay = `${p.primer_nombre ?? ''} ${p.apellido_paterno ?? ''} ${p.dni ?? ''} ${p.telefono ?? ''}`.toLowerCase();
    const searchMatch = hay.includes(searchTerm);
    const typeMatch = !filterType || (user.role?.codigo === filterType);
    return searchMatch && typeMatch;
  });

  renderUsersTable(filtered);
}

/* ----------------- DNI lookup ------------------ */
async function handleDniLookup() {
  if (!shouldRunPersonaValidations()) return;
  const dni = this.value.trim();
  if (!isDNI(dni)) return;
  try {
    const data = await apiFetch(`/dni/${dni}`);
    if (data?.success && data?.data) {
      const d = data.data;
      document.getElementById('primerNombre').value    = d.primer_nombre || '';
      document.getElementById('segundoNombre').value   = d.segundo_nombre || '';
      document.getElementById('apellidoPaterno').value = d.apellido_paterno || '';
      document.getElementById('apellidoMaterno').value = d.apellido_materno || '';
    }
  } catch (e) {
    showAlert(`Error consultando DNI: ${e.message}`, 'danger');
  }
}

/* ----------------- Modal usuario ---------------- */
function openUserModal() {
  isEditing = false;
  currentUserId = null;
  document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
  document.getElementById('userForm').reset();
  document.getElementById('userId') && (document.getElementById('userId').value = '');
  // contraseña visible y requerida en creación
  document.getElementById('password-fields')?.classList.remove('d-none');
  document.getElementById('change-password-button')?.classList.add('d-none');
  document.getElementById('clave') && (document.getElementById('clave').required = true);
  document.getElementById('confirmarClave') && (document.getElementById('confirmarClave').required = true);
  configureUserRoleSelect({ selectedRoleId: null });
}

async function editUser(userId) {
  try {
    const data = await apiFetch(`/users/${userId}`); // espera { ... , role, persona, perfilabogado? }
    const user = data?.user || data;
    if (!user) throw new Error('Usuario no encontrado');

    currentUserId = userId;
    isEditing = true;
    document.getElementById('userModalLabel').textContent = 'Editar Usuario';
    document.getElementById('userForm').reset();

    // persona
    const p = user.persona ?? {};
    setValue('userId', user.id);
    setValue('primerNombre', p.primer_nombre);
    setValue('segundoNombre', p.segundo_nombre);
    setValue('apellidoPaterno', p.apellido_paterno);
    setValue('apellidoMaterno', p.apellido_materno);
    setValue('dni', p.dni);
    setValue('telefono', p.telefono);
    setValue('email', p.correo);
    setValue('direccion', p.direccion);

    // rol
    configureUserRoleSelect({ selectedRoleId: user.rol_id });

    // contraseña: ocultar en edición
    document.getElementById('password-fields')?.classList.add('d-none');
    document.getElementById('change-password-button')?.classList.remove('d-none');
    if (document.getElementById('clave')) document.getElementById('clave').required = false;
    if (document.getElementById('confirmarClave')) document.getElementById('confirmarClave').required = false;

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

  // validaciones extra
  const dni = document.getElementById('dni')?.value?.trim();
  if (!isDNI(dni)) return showAlert('DNI inválido (8 dígitos).', 'danger');
  const email = document.getElementById('email')?.value?.trim();
  if (!isEmail(email)) return showAlert('Email inválido.', 'danger');

  // contraseña en creación
  let claveToSend;
  const pwContainer = document.getElementById('password-fields');
  if (pwContainer && !pwContainer.classList.contains('d-none')) {
    const clave = document.getElementById('clave')?.value || '';
    const confirmar = document.getElementById('confirmarClave')?.value || '';
    if (clave !== confirmar) return showAlert('Las contraseñas no coinciden.', 'danger');
    if (clave.length < 8) return showAlert('La contraseña debe tener al menos 8 caracteres.', 'danger');
    claveToSend = clave;
  }

  const rolSelect = document.getElementById('rol');
  const rolId = parseInt(rolSelect?.value || '', 10);
  const rolCodigo = getSelectedRoleCode();
  if (!rolId || Number.isNaN(rolId)) return showAlert('Selecciona un rol válido.', 'danger');
  if (!shouldRunPersonaValidations(rolCodigo)) {
    return showAlert('Solo se pueden gestionar cuentas de clientes o administradores desde este panel.', 'danger');
  }

  const telefonoNormalizado = trimOrUndefined(onlyDigits(document.getElementById('telefono')?.value));
  const personaPayload = {
    dni,
    telefono: telefonoNormalizado,
    correo: email,
    primer_nombre: trimOrUndefined(document.getElementById('primerNombre')?.value),
    segundo_nombre: trimOrUndefined(document.getElementById('segundoNombre')?.value),
    apellido_paterno: trimOrUndefined(document.getElementById('apellidoPaterno')?.value),
    apellido_materno: trimOrUndefined(document.getElementById('apellidoMaterno')?.value),
    direccion: trimOrUndefined(document.getElementById('direccion')?.value),
  };

  const payloadUser = { persona: personaPayload, rol_id: rolId };
  if (claveToSend) payloadUser.clave = claveToSend;

  const currentUser = isEditing ? users.find(u => u.id === currentUserId) : null;
  const excludePersonaId = currentUser?.persona_id ?? currentUser?.persona?.id ?? null;

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
        showAlert(conflictMessage, 'danger');
        return;
      }
    }

    let saved;
    if (isEditing && currentUserId != null) {
      saved = await apiFetch(`/users/${currentUserId}`, { method: 'PUT', body: JSON.stringify(payloadUser) });
    } else {
      saved = await apiFetch('/users', { method: 'POST', body: JSON.stringify(payloadUser) });
      currentUserId = saved?.id ?? saved?.user?.id ?? currentUserId;
    }

    showAlert(isEditing ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.', 'success');
    await loadUsers();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
  } catch (e) {
    showAlert(`Error guardando usuario: ${e.message}`, 'danger');
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
