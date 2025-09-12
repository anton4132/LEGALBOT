let users = [];
let roles = [];
let especialidades = [];
let currentUserId = null;
let isEditing = false;
let currentAvailability = [];
let pendingDisponibilidad = [];


const API_BASE_URL =
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api'
    : '/api';

/* ------------------ Utils API ------------------ */
async function apiFetch(path, options = {}) {
  const resp = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    credentials: 'include',
    ...options
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
  document.getElementById('rol')?.addEventListener('change', toggleAbogadoFields);

  // Estudio: búsqueda de existentes
  document.getElementById('buscarEstudio')?.addEventListener('input', debounce(handleBuscarEstudio, 250));

  // Disponibilidad: botón añadir del modal de disponibilidad
  // (en tu HTML, addDisponibilidad() está en el botón; aquí no añadimos otro listener)
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
    renderUsersTable(users);
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
  populateEspecialidadesSelect();
}

/* ----------------- Poblar selects -------------- */
function populateRoleSelects() {
  const roleSelect   = document.getElementById('rol');
  const filterSelect = document.getElementById('filterType');

  if (roleSelect) {
    roleSelect.innerHTML = '<option value="">Seleccionar tipo</option>';
    roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.id;
      option.textContent = role.nombre;
      option.dataset.codigo = role.codigo;
      roleSelect.appendChild(option);
    });
  }
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Todos los tipos</option>';
    roles.forEach(role => {
      const option = document.createElement('option');
      option.value = role.codigo;
      option.textContent = role.nombre;
      filterSelect.appendChild(option);
    });
  }
}

function populateEspecialidadesSelect() {
  const select = document.getElementById('especialidadesSelect');
  if (!select) return;
  select.innerHTML = especialidades.map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
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
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">No se encontraron usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = usersToRender.map(user => {
    const p = user.persona ?? {};
    const badgeClass = getRoleBadge(user.role?.codigo);
    const abogadoActions = (user.role?.codigo === 'abogado')
      ? `
        <button class="btn btn-sm btn-outline-primary me-1" title="Especialidades" onclick="openEspecialidadesModal(${user.id})"><i class="bi bi-stars"></i></button>
        <button class="btn btn-sm btn-outline-secondary me-1" title="Estudio" onclick="openEstudioModal(${user.id})"><i class="bi bi-building"></i></button>
        <button class="btn btn-sm btn-outline-info me-1" title="Disponibilidad" onclick="openDisponibilidadModal(${user.id})"><i class="bi bi-calendar-week"></i></button>
      `
      : '';
    return `
      <tr>
        <td>${(p.primer_nombre ?? '')} ${(p.apellido_paterno ?? '')}</td>
        <td>${p.dni ?? ''}</td>
        <td>${p.telefono ?? 'N/A'}</td>
        <td>${p.correo ?? ''}</td>
        <td><span class="badge ${badgeClass}">${user.role?.nombre ?? ''}</span></td>
        <td>${user.creado_el ? formatDate(user.creado_el) : ''}</td>
        <td class="text-center">
          <div class="btn-group">
            <button class="btn btn-sm btn-warning me-1" title="Editar" onclick="editUser(${user.id})"><i class="bi bi-pencil"></i></button>
            ${abogadoActions}
            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button>
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
  toggleAbogadoFields();
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
    const rolSelect = document.getElementById('rol');
    if (rolSelect) {
      rolSelect.value = user.rol_id;
      rolSelect.dispatchEvent(new Event('change'));
    }

    // perfil abogado (si lo hay)
    await maybeLoadPerfilAbogadoIntoForm(userId, user);

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

async function maybeLoadPerfilAbogadoIntoForm(userId, user) {
  const rolCodigo = user.role?.codigo || roles.find(r => r.id === user.rol_id)?.codigo;
  const esAbog = rolCodigo === 'abogado';
  toggleAbogadoFields();

  if (!esAbog) return;

  try {
    // intenta usar lo que ya viene; si no, consulta endpoint perfil
    const perfil = user.perfilabogado ?? (await apiFetch(`/users/${userId}/perfil`).catch(() => null));
    if (!perfil) return;

    setValue('tarifaBase', perfil.tarifa_base);
    setValue('duracionMinutos', perfil.duracion_minutos ?? 60);
    setValue('direccionAtencion', perfil.direccion_atencion);
    setValue('bio', perfil.bio);
  } catch (e) {
    // no bloquear la edición si falla
    console.warn('No se pudo cargar perfil abogado:', e);
  }
}

function toggleAbogadoFields() {
  const rolSelect = document.getElementById('rol');
  const selectedOption = rolSelect?.options[rolSelect.selectedIndex];
  const esAbogado = selectedOption?.dataset.codigo === 'abogado';
  const cont = document.getElementById('perfilAbogadoFields');
  if (cont) cont.style.display = esAbogado ? 'block' : 'none';
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
  const rolCodigo = rolSelect?.options[rolSelect.selectedIndex]?.dataset?.codigo || '';
  if (!rolId || Number.isNaN(rolId)) return showAlert('Selecciona un rol válido.', 'danger');

  const personaPayload = {
    dni: dni,
    telefono: trimOrUndefined(onlyDigits(document.getElementById('telefono')?.value)),
    correo: email,
    primer_nombre: trimOrUndefined(document.getElementById('primerNombre')?.value),
    segundo_nombre: trimOrUndefined(document.getElementById('segundoNombre')?.value),
    apellido_paterno: trimOrUndefined(document.getElementById('apellidoPaterno')?.value),
    apellido_materno: trimOrUndefined(document.getElementById('apellidoMaterno')?.value),
    direccion: trimOrUndefined(document.getElementById('direccion')?.value),
  };

  const payloadUser = { persona: personaPayload, rol_id: rolId };
  if (claveToSend) payloadUser.clave = claveToSend;

  try {
    let saved;
    if (isEditing && currentUserId != null) {
      saved = await apiFetch(`/users/${currentUserId}`, { method: 'PUT', body: JSON.stringify(payloadUser) });
    } else {
      saved = await apiFetch('/users', { method: 'POST', body: JSON.stringify(payloadUser) });
      currentUserId = saved?.id ?? saved?.user?.id ?? currentUserId;
    }

    // Si es abogado, upsert del perfil con los campos del form (no especialidades ni estudio aquí)
    if (rolCodigo === 'abogado' && currentUserId != null) {
      const perfilPayload = collectPerfilAbogado();
      if (Object.values(perfilPayload).some(v => v !== undefined && v !== null && v !== '')) {
        await apiFetch(`/users/${currentUserId}/perfil`, { method: 'PUT', body: JSON.stringify(perfilPayload) });
      }
    }

    showAlert(isEditing ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.', 'success');
    await loadUsers();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
  } catch (e) {
    showAlert(`Error guardando usuario: ${e.message}`, 'danger');
  }
}

function collectPerfilAbogado() {
  const tarifaRaw = document.getElementById('tarifaBase')?.value?.trim();
  const durRaw    = document.getElementById('duracionMinutos')?.value?.trim();
  return {
    tarifa_base: tarifaRaw === '' ? undefined : Number(tarifaRaw),
    duracion_minutos: durRaw === '' ? undefined : parseInt(durRaw, 10),
    direccion_atencion: trimOrUndefined(document.getElementById('direccionAtencion')?.value),
    bio: trimOrUndefined(document.getElementById('bio')?.value)
  };
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
    renderEspecialidadesChips(ids);
    // preselección no obligatoria; el usuario puede añadir desde el múltiple
    bootstrap.Modal.getOrCreateInstance(document.getElementById('especialidadesModal')).show();
  } catch (e) {
    showAlert(`No se pudieron cargar especialidades: ${e.message}`, 'danger');
  }
}

function renderEspecialidadesChips(ids) {
  const cont = document.getElementById('especialidadesActuales');
  if (!cont) return;
  cont.innerHTML = ids.map(id => {
    const esp = especialidades.find(e => e.id === id);
    const nombre = esp ? esp.nombre : `ID ${id}`;
    return `<span class="badge bg-secondary me-2 mb-2">${nombre}
      <button class="btn btn-sm btn-light ms-2 py-0" onclick="removeEspecialidad(${id})">&times;</button>
    </span>`;
  }).join('');
  cont.dataset.ids = JSON.stringify(ids);
}

function removeEspecialidad(id) {
  const cont = document.getElementById('especialidadesActuales');
  const now = new Set(JSON.parse(cont.dataset.ids || '[]'));
  now.delete(id);
  renderEspecialidadesChips([...now]);
}

async function saveEspecialidades() {
  if (currentUserId == null) return showAlert('Usuario no seleccionado.', 'danger');
  const cont = document.getElementById('especialidadesActuales');
  const curr = new Set(JSON.parse(cont.dataset.ids || '[]'));
  const selected = Array.from(document.getElementById('especialidadesSelect').selectedOptions).map(o => parseInt(o.value, 10));
  selected.forEach(id => curr.add(id));
  try {
    // idempotente: PUT con arreglo de IDs finales
    await apiFetch(`/users/${currentUserId}/especialidades`, {
      method: 'PUT',
      body: JSON.stringify({ ids: [...curr] })
    });
    showAlert('Especialidades actualizadas.', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('especialidadesModal')).hide();
  } catch (e) {
    showAlert(`Error guardando especialidades: ${e.message}`, 'danger');
  }
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
  document.getElementById('sugerenciasEstudio') && (document.getElementById('sugerenciasEstudio').innerHTML = '');

  // intenta precargar vínculo actual principal (si el backend tiene endpoint)
  apiFetch(`/users/${userId}/estudios`).then(list => {
    const arr = Array.isArray(list) ? list : (list.items ?? []);
    renderEstudiosActuales(arr);
    const principal = arr.find(v => v.principal) ?? arr[0];
    if (principal) {
      setValue('estudioId', principal.estudio_id);
      setValue('rolEnEstudio', principal.rol_en_estudio ?? '');
      const chk2 = document.getElementById('estudioPrincipal'); if (chk2) chk2.checked = !!principal.principal;
      // si devuelve datos del estudio:
      const est = principal.estudio ?? {};
      setValue('estudioRuc', est.ruc);
      setValue('estudioNombre', est.nombre_comercial);
      setValue('estudioPais', est.pais);
      setValue('estudioCiudad', est.ciudad);
      setValue('estudioCorreo', est.correo_contacto);
      setValue('estudioTelefono', est.telefono);
      setValue('estudioDireccion', est.direccion);
    }
  }).catch(() => { /* opcional */ });

  bootstrap.Modal.getOrCreateInstance(document.getElementById('estudioModal')).show();
}

function renderEstudiosActuales(estudios = []) {
    const cont = document.getElementById('estudiosActuales');
    if (!cont) return;
    if (!estudios.length) {
      cont.innerHTML = '<li class="list-group-item">Sin estudios registrados</li>';
      return;
    }
    cont.innerHTML = estudios.map(v => {
      const nombre = escapeHtml(v.estudio?.nombre_comercial ?? `ID ${v.estudio_id}`);
      const rol = v.rol_en_estudio ? ` - ${escapeHtml(v.rol_en_estudio)}` : '';
      const badge = v.principal ? ' <span class="badge bg-primary ms-2">Principal</span>' : '';
      return `<li class="list-group-item d-flex justify-content-between align-items-center">${nombre}${rol}${badge}</li>`;
    }).join('');
}

async function handleBuscarEstudio(e) {
  const term = e.target.value.trim();
  const cont = document.getElementById('sugerenciasEstudio');
  if (!cont) return;
  cont.innerHTML = '';
  if (term.length < 2) return;

  try {
    const res = await apiFetch(`/estudios?search=${encodeURIComponent(term)}`);
    const arr = Array.isArray(res) ? res : (res.items ?? []);
    if (!arr.length) return;
    cont.innerHTML = arr.map(est => `
      <a href="#" class="list-group-item list-group-item-action" onclick="seleccionarEstudio(${est.id}, '${escapeHtml(est.nombre_comercial ?? '')}', '${est.ruc ?? ''}', '${escapeHtml(est.pais ?? '')}', '${escapeHtml(est.ciudad ?? '')}', '${escapeHtml(est.correo_contacto ?? '')}', '${est.telefono ?? ''}', '${escapeHtml(est.direccion ?? '')}')">
        ${est.nombre_comercial ?? '(sin nombre)'} — RUC: ${est.ruc ?? 'N/A'}
      </a>
    `).join('');
  } catch (e2) {
    console.warn('Buscar estudio falló', e2);
  }
}

function seleccionarEstudio(id, nombre, ruc, pais, ciudad, correo, telefono, direccion) {
  setValue('estudioId', id);
  setValue('estudioNombre', unescapeHtml(nombre));
  setValue('estudioRuc', ruc);
  setValue('estudioPais', unescapeHtml(pais));
  setValue('estudioCiudad', unescapeHtml(ciudad));
  setValue('estudioCorreo', unescapeHtml(correo));
  setValue('estudioTelefono', telefono);
  setValue('estudioDireccion', unescapeHtml(direccion));
  const cont = document.getElementById('sugerenciasEstudio'); if (cont) cont.innerHTML = '';
}

async function saveEstudio() {
  if (currentUserId == null) return showAlert('Usuario no seleccionado.', 'danger');

  // vínculo
  const rolEnEstudio = trimOrUndefined(document.getElementById('rolEnEstudio')?.value);
  const principal = !!document.getElementById('estudioPrincipal')?.checked;

  // estudio seleccionado o nuevo
  let estudioId = document.getElementById('estudioId')?.value?.trim();
  if (!estudioId) {
    // crear nuevo estudio con campos del form
    const ruc  = trimOrUndefined(document.getElementById('estudioRuc')?.value);
    const nom  = trimOrUndefined(document.getElementById('estudioNombre')?.value);
    const pais = trimOrUndefined(document.getElementById('estudioPais')?.value);
    const ciu  = trimOrUndefined(document.getElementById('estudioCiudad')?.value);
    const corr = trimOrUndefined(document.getElementById('estudioCorreo')?.value);
    const tel  = trimOrUndefined(onlyDigits(document.getElementById('estudioTelefono')?.value));
    const dir  = trimOrUndefined(document.getElementById('estudioDireccion')?.value);

    // Validaciones mínimas si tu negocio las exige
    if (ruc && !isRUC(ruc)) return showAlert('RUC inválido (11 dígitos).', 'danger');
    if (corr && !isEmail(corr)) return showAlert('Correo de estudio inválido.', 'danger');

    try {
      const created = await apiFetch('/estudios', {
        method: 'POST',
        body: JSON.stringify({
          ruc: ruc ?? null,
          nombre_comercial: nom ?? null,
          pais: pais ?? null,
          ciudad: ciu ?? null,
          correo_contacto: corr ?? null,
          telefono: tel ?? null,
          direccion: dir ?? null
        })
      });
      estudioId = created?.id ?? created?.estudio?.id;
      if (!estudioId) throw new Error('No se pudo obtener ID del estudio creado');
    } catch (e) {
      return showAlert(`Error creando estudio: ${e.message}`, 'danger');
    }
  }

  try {
    // Crea/actualiza el vínculo
    await apiFetch(`/users/${currentUserId}/estudios`, {
      method: 'POST',
      body: JSON.stringify({
        estudio_id: Number(estudioId),
        principal,
        rol_en_estudio: rolEnEstudio
      })
    });
    showAlert('Estudio guardado correctamente.', 'success');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('estudioModal')).hide();
  } catch (e) {
    showAlert(`Error guardando vínculo con estudio: ${e.message}`, 'danger');
  }
}

/* ----------------- Disponibilidad ---------------- */
async function openDisponibilidadModal(userId) {
  currentUserId = userId;
  try {
    const data = await apiFetch(`/users/${userId}/disponibilidad`);

    currentAvailability = Array.isArray(data) ? data : (data.items ?? []);
    pendingDisponibilidad = [];
    renderSchedule(currentAvailability);

    bootstrap.Modal.getOrCreateInstance(document.getElementById('disponibilidadModal')).show();
  } catch (e) {
    showAlert(`No se pudo cargar la disponibilidad: ${e.message}`, 'danger');
  }
}

function renderSchedule(availability = []) {
  const container = document.getElementById('schedule-container');
  if (!container) return;

  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hours = Array.from({length: 14}, (_, i) => 8 + i); // 08:00 a 21:00
  let html = '<div class="schedule-header"></div>' + days.map(d => `<div class="schedule-header">${d}</div>`).join('');
  hours.forEach(hour => {
    html += `<div class="schedule-time">${String(hour).padStart(2,'0')}:00</div>`;
    days.forEach((_, dayIndex) => { html += `<div class="schedule-slot" id="slot-${dayIndex + 1}-${hour}"></div>`; });
  });
  container.innerHTML = html;

  // pintar bloques
  const combined = availability.concat(pendingDisponibilidad.map((s, idx) => ({ ...s, id: `tmp-${idx}` })));
  combined.forEach(slot => {
    const d = Number(slot.dia_semana);
    const start = fromTimeDB(slot.hora_inicio);
    const end   = fromTimeDB(slot.hora_fin);
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const durationHours = (eh + em/60) - (sh + sm/60);
    const cell = document.getElementById(`slot-${d}-${sh}`);
    if (cell && durationHours > 0) {
      const block = document.createElement('div');
      block.className = 'availability-block'+ (String(slot.id).startsWith('tmp-') ? ' pending-block' : '');

      block.style.top = `${(sm / 60) * 100}%`;
      block.style.height = `${durationHours * 100}%`;
      const idStr = slot.id;
      block.innerHTML = `
        ${start} - ${end}
        <button class="delete-slot-btn" onclick="deleteDisponibilidad('${idStr}')" title="Eliminar"><i class="bi bi-x-circle-fill"></i></button>`;
      cell.appendChild(block);
    }
  });
}

async function addDisponibilidad() {
  if (currentUserId == null) return showAlert('Usuario no seleccionado.', 'danger');
  const dia  = parseInt(document.getElementById('dispDia')?.value ?? '1', 10);
  const ini  = document.getElementById('dispInicio')?.value;
  const fin  = document.getElementById('dispFin')?.value;

  if (!ini || !fin) return showAlert('Debes ingresar inicio y fin.', 'danger');
  if (fin <= ini)   return showAlert('La hora de fin debe ser mayor que la de inicio.', 'danger');

  // normalizar a HH:mm:00
  const inicioDB = toTimeDB(ini);
  const finDB    = toTimeDB(fin);
  pendingDisponibilidad.push({ dia_semana: dia, hora_inicio: inicioDB, hora_fin: finDB });
  renderSchedule(currentAvailability);
  document.getElementById('dispInicio').value = '';
  document.getElementById('dispFin').value = '';
  }
  
  async function saveDisponibilidad() {
  if (currentUserId == null) return showAlert('Usuario no seleccionado.', 'danger');
  if (!pendingDisponibilidad.length) {
    return showAlert('No hay horarios nuevos para guardar.', 'info');
  }
  try {
    for (const slot of pendingDisponibilidad) {
      await apiFetch(`/users/${currentUserId}/disponibilidad`, {
        method: 'POST',
        body: JSON.stringify(slot)
      });
    }
    showAlert('Disponibilidad guardada.', 'success');
    const data = await apiFetch(`/users/${currentUserId}/disponibilidad`);
    currentAvailability = Array.isArray(data) ? data : (data.items ?? []);
    pendingDisponibilidad = [];
    renderSchedule(currentAvailability);
  } catch (e) {
    showAlert(`Error guardando disponibilidad: ${e.message}`, 'danger');
  }
}

async function deleteDisponibilidad(slotId) {
  if (slotId == null) return;
  const idStr = String(slotId);
  if (idStr.startsWith('tmp-')) {
    const idx = parseInt(idStr.split('-')[1], 10);
    pendingDisponibilidad.splice(idx, 1);
    renderSchedule(currentAvailability);
    return;
  }
  if (currentUserId == null) return;
  try {
    await apiFetch(`/users/${currentUserId}/disponibilidad/${slotId}`, { method: 'DELETE' });
    showAlert('Horario eliminado.', 'success');
    const data = await apiFetch(`/users/${currentUserId}/disponibilidad`);
    currentAvailability = Array.isArray(data) ? data : (data.items ?? []);
    renderSchedule(currentAvailability);
  } catch (e) {
    showAlert(`Error eliminando disponibilidad: ${e.message}`, 'danger');
  }
}

/* ----------------- Delete usuario ---------------- */
function deleteUser(userId) {
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
