let users = [];
let roles = [];
let currentUserId = null;
let isEditing = false;
let availabilityCounter = 0;

const API_BASE_URL = 'http://localhost:3000/api';

// --- util API ---
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

console.log('✅ usuarios.js cargado correctamente');

// --- logout (stub) ---
function logout() {
  console.log("Cerrando sesión...");
  // window.location.href = '/login';
}

// --- bootstrap ---
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Inicializando página de usuarios'); 
  loadRoles().then(loadUsers);
  setupEventListeners();
});

// --- listeners ---
function setupEventListeners() {
  document.getElementById('searchInput')?.addEventListener('input', filterUsers);
  document.getElementById('filterType')?.addEventListener('change', filterUsers);
  document.getElementById('userForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
  document.getElementById('dni')?.addEventListener('blur', handleDniLookup);
  document.getElementById('toggle-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('active');
  });

  document.getElementById('rol')?.addEventListener('change', toggleAbogadoFields);
  document.getElementById('add-availability-btn')?.addEventListener('click', addAvailabilitySlot);
}

// --- data loaders ---
async function loadUsers() {
  try {
    const data = await apiFetch('/users'); // ← devuelve array de usuarios
    users = Array.isArray(data) ? data : (data.items ?? []);
    renderUsersTable(users);
  } catch (e) {
    showAlert(`No se pudieron cargar usuarios: ${e.message}`, 'danger');
    renderUsersTable([]);
  }
}

async function loadRoles() {
  try {
    const data = await apiFetch('/roles'); // ← { id, nombre, codigo }
    roles = Array.isArray(data) ? data : (data.items ?? []);
    if (!roles.length) throw new Error('No se recibieron roles');
    populateRoleSelects();
  } catch (e) {
    console.error('Error cargando roles:', e);
    showAlert(`No se pudieron cargar roles: ${e.message}`, 'danger');
  }
}

function populateRoleSelects() {
  const roleSelect = document.getElementById('rol');
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

// --- UI helpers ---
function getRoleBadge(code) {
  const roleColors = { cliente: 'bg-primary', abogado: 'bg-success', admin: 'bg-danger' };
  return roleColors[code] || 'bg-secondary';
}

function renderUsersTable(usersToRender) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!usersToRender.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No se encontraron usuarios</td></tr>`;
    return;
  }

  usersToRender.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.persona.primer_nombre} ${user.persona.apellido_paterno}</td>
      <td>${user.persona.dni}</td>
      <td>${user.persona.telefono || 'N/A'}</td>
      <td>${user.persona.correo}</td>
      <td><span class="badge ${getRoleBadge(user.role.codigo)}">${user.role.nombre}</span></td>
      <td>${formatDate(user.creado_el)}</td>
      <td>
        <button class="btn btn-sm btn-info me-1" onclick="viewUser(${user.id})"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-warning me-1" onclick="editUser(${user.id})"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function filterUsers() {
  const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const filterType = document.getElementById('filterType')?.value || '';

  const filteredUsers = users.filter(user => {
    const p = user.persona;
    const matchesSearch = 
      p.primer_nombre.toLowerCase().includes(searchTerm) ||
      p.apellido_paterno.toLowerCase().includes(searchTerm) ||
      p.dni.includes(searchTerm) ||
      (p.telefono && p.telefono.includes(searchTerm));
    const matchesType = !filterType || user.role.codigo === filterType;
    return matchesSearch && matchesType;
  });

  renderUsersTable(filteredUsers);
}

// --- DNI lookup ---
async function handleDniLookup() {
  const dni = this.value.trim();
  if (!/^\d{8}$/.test(dni)) return;
  try {
    showAlert(`Buscando DNI ${dni}...`, 'info');
    const data = await apiFetch(`/dni/${dni}`);
    if (data?.success && data?.data) {
      const d = data.data;
      document.getElementById('primerNombre').value    = d.primer_nombre || '';
      document.getElementById('segundoNombre').value   = d.segundo_nombre || '';
      document.getElementById('apellidoPaterno').value = d.apellido_paterno || '';
      document.getElementById('apellidoMaterno').value = d.apellido_materno || '';
    } else {
      showAlert('DNI no encontrado', 'warning');
    }
  } catch (e) {
    showAlert(`Error consultando DNI: ${e.message}`, 'danger');
  }
}

// --- modal open ---
function openUserModal() {
  isEditing = false;
  currentUserId = null;
  document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('password-fields').style.display = 'flex';
  document.getElementById('clave').required = true;
  document.getElementById('confirmarClave').required = true;
  toggleAbogadoFields(); 
}

// --- abogado fields toggle/clean ---
function toggleAbogadoFields() {
  const rolSelect = document.getElementById('rol');
  const abogadoFields = document.getElementById('abogado-fields');
  if (!rolSelect || !abogadoFields) return;

  const selectedOption = rolSelect.options[rolSelect.selectedIndex];
  const rolCodigo = selectedOption?.dataset?.codigo || '';

  if (rolCodigo === 'abogado') {
    abogadoFields.style.display = 'block';
  } else {
    abogadoFields.style.display = 'none';
    const estudioTab = document.getElementById('estudio-tab-pane');
    estudioTab?.querySelectorAll('input')?.forEach(i => i.value = '');
    document.getElementById('especialidad') && (document.getElementById('especialidad').value = '');
    document.getElementById('tarifabase') && (document.getElementById('tarifabase').value = '');
    document.getElementById('duracionMinutos') && (document.getElementById('duracionMinutos').value = '');
    document.getElementById('direccionAtencion') && (document.getElementById('direccionAtencion').value = '');
    document.getElementById('biografia') && (document.getElementById('biografia').value = '');
    document.getElementById('availability-list')?.replaceChildren();
    availabilityCounter = 0;
  }
}

// --- disponibilidad (add/remove) ---
function addAvailabilitySlot() {
  const list = document.getElementById('availability-list');
  if (!list) return;
  availabilityCounter++;
  const slotDiv = document.createElement('div');
  slotDiv.className = 'row g-2 align-items-center mb-2 availability-slot';
  slotDiv.id = `slot-${availabilityCounter}`;
  slotDiv.innerHTML = `
    <div class="col-md-4">
      <select class="form-select form-select-sm">
        <option>Lunes</option><option>Martes</option><option>Miércoles</option>
        <option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option>
      </select>
    </div>
    <div class="col-md-3">
      <input type="time" class="form-control form-control-sm">
    </div>
    <div class="col-md-3">
      <input type="time" class="form-control form-control-sm">
    </div>
    <div class="col-md-2">
      <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeAvailabilitySlot('slot-${availabilityCounter}')">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
  list.appendChild(slotDiv);
}

function removeAvailabilitySlot(slotId) {
  document.getElementById(slotId)?.remove();
}

// --- poblar abogado ---
function populateLawyerFields(abogadoInfo) {
  if (!abogadoInfo) return;

  document.getElementById('especialidad') && (document.getElementById('especialidad').value = abogadoInfo.especialidad ?? '');
  document.getElementById('tarifabase') && (document.getElementById('tarifabase').value = (abogadoInfo.tarifabase ?? ''));
  document.getElementById('duracionMinutos') && (document.getElementById('duracionMinutos').value = (abogadoInfo.duracionMinutos ?? ''));
  document.getElementById('direccionAtencion') && (document.getElementById('direccionAtencion').value = abogadoInfo.direccionAtencion ?? '');
  document.getElementById('biografia') && (document.getElementById('biografia').value = abogadoInfo.biografia ?? '');

  const est = abogadoInfo.estudio || {};
  document.getElementById('estudioRuc') && (document.getElementById('estudioRuc').value = est.ruc ?? '');
  document.getElementById('estudioNombre') && (document.getElementById('estudioNombre').value = est.nombre ?? '');
  document.getElementById('estudioPais') && (document.getElementById('estudioPais').value = est.pais ?? '');
  document.getElementById('estudioCiudad') && (document.getElementById('estudioCiudad').value = est.ciudad ?? '');
  document.getElementById('estudioCorreo') && (document.getElementById('estudioCorreo').value = est.correo ?? '');
  document.getElementById('estudioTelefono') && (document.getElementById('estudioTelefono').value = est.telefono ?? '');
  document.getElementById('estudioDireccion') && (document.getElementById('estudioDireccion').value = est.direccion ?? '');

  const list = document.getElementById('availability-list');
  list?.replaceChildren();
  availabilityCounter = 0;

  (abogadoInfo.disponibilidad || []).forEach(slot => {
    availabilityCounter++;
    const slotDiv = document.createElement('div');
    slotDiv.className = 'row g-2 align-items-center mb-2 availability-slot';
    slotDiv.id = `slot-${availabilityCounter}`;
    slotDiv.innerHTML = `
      <div class="col-md-4">
        <select class="form-select form-select-sm">
          <option ${slot.dia==='Lunes'?'selected':''}>Lunes</option>
          <option ${slot.dia==='Martes'?'selected':''}>Martes</option>
          <option ${slot.dia==='Miércoles'?'selected':''}>Miércoles</option>
          <option ${slot.dia==='Jueves'?'selected':''}>Jueves</option>
          <option ${slot.dia==='Viernes'?'selected':''}>Viernes</option>
          <option ${slot.dia==='Sábado'?'selected':''}>Sábado</option>
          <option ${slot.dia==='Domingo'?'selected':''}>Domingo</option>
        </select>
      </div>
      <div class="col-md-3">
        <input type="time" class="form-control form-control-sm" value="${timeToHHMM(slot.hora_inicio)}">
      </div>
      <div class="col-md-3">
        <input type="time" class="form-control form-control-sm" value="${timeToHHMM(slot.hora_fin)}">
      </div>
      <div class="col-md-2">
        <button type="button" class="btn btn-danger btn-sm w-100" onclick="removeAvailabilitySlot('slot-${availabilityCounter}')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    list?.appendChild(slotDiv);
  });
}

// --- edit ---
async function editUser(userId) {
  try {
    const data = await apiFetch(`/users/${userId}`);
    const user = data?.user || data;
    if (!user) throw new Error('Usuario no encontrado');

    const p = user.persona || {};
    document.getElementById('userId').value = user.id;
    document.getElementById('primerNombre').value = p.primer_nombre || '';
    document.getElementById('segundoNombre').value = p.segundo_nombre || '';
    document.getElementById('apellidoPaterno').value = p.apellido_paterno || '';
    document.getElementById('apellidoMaterno').value = p.apellido_materno || '';
    document.getElementById('dni').value = p.dni || '';
    document.getElementById('telefono').value = p.telefono || '';
    document.getElementById('email').value = p.correo || '';
    document.getElementById('direccion').value = p.direccion || '';
    document.getElementById('rol').value = user.rol_id;

    // un solo change es suficiente
    document.getElementById('rol').dispatchEvent(new Event('change'));

    if ((user.role?.codigo === 'abogado') || (user.rol_id === roles.find(r => r.codigo === 'abogado')?.id)) {
      const abogadoInfo =
        user.abogado_info
          ? user.abogado_info
          : (user.perfilabogado ? apiPerfilToUI(user.perfilabogado) : null);
      populateLawyerFields(abogadoInfo);
    }

    document.getElementById('password-fields').style.display = 'none';
    document.getElementById('clave').required = false;
    document.getElementById('confirmarClave').required = false;

    isEditing = true;
    currentUserId = userId;
    document.getElementById('userModalLabel').textContent = 'Editar Usuario';
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
  } catch (e) {
    showAlert(`Error obteniendo usuario: ${e.message}`, 'danger');
  }
}

// --- perfil mapper ---
function dayNumToName(n) {
  const map = {1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo'};
  return map[n] || '';
}
function timeToHHMM(t) {
  if (!t) return '';
  const date = new Date(t);
  if (!isNaN(date.getTime())) {
    const hh = String(date.getUTCHours()).padStart(2,'0');
    const mm = String(date.getUTCMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  const [hh, mm] = String(t).split(':');
  return `${hh?.padStart(2,'0')}:${mm?.padStart(2,'0')}`;
}
function apiPerfilToUI(perfil) {
  if (!perfil) return null;
  return {
    especialidad: perfil.especialidad?.nombre ?? '',
    tarifabase: perfil.tarifa_base ?? null,
    duracionMinutos: perfil.duracion_minutos ?? null,
    direccionAtencion: perfil.direccion_atencion ?? '',
    biografia: perfil.bio ?? '',
    estudio: {
      ruc: perfil.estudio?.ruc ?? '',
      nombre: perfil.estudio?.nombre_comercial ?? '',
      pais: perfil.estudio?.pais ?? '',
      ciudad: perfil.estudio?.ciudad ?? '',
      correo: perfil.estudio?.correo_contacto ?? '',
      telefono: perfil.estudio?.telefono ?? '',
      direccion: perfil.estudio?.direccion ?? '',
    },
    disponibilidad: (perfil.disponibilidadabogado || []).map(s => ({
      dia: dayNumToName(s.dia_semana),
      hora_inicio: timeToHHMM(s.hora_inicio),
      hora_fin: timeToHHMM(s.hora_fin)
    }))
  };
}

// --- view ---
async function viewUser(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) { showAlert('Usuario no encontrado', 'danger'); return; }
  const p = user.persona;
  const userInfo = `
    <strong>Nombre:</strong> ${p.primer_nombre} ${p.apellido_paterno}<br>
    <strong>DNI:</strong> ${p.dni}<br>
    <strong>Email:</strong> ${p.correo}<br>
    <strong>Tipo:</strong> ${user.role.nombre}
  `;
  showAlert(userInfo, 'info', true);
}

// --- collect ---
function collectAvailability() {
  const list = document.getElementById('availability-list');
  if (!list) return [];
  const slots = [];
  list.querySelectorAll('.availability-slot').forEach(slot => {
    const [daySel, startInp, endInp] = slot.querySelectorAll('select, input[type="time"]');
    slots.push({
      dia: daySel?.value || '',
      hora_inicio: startInp?.value || '',
      hora_fin: endInp?.value || '',
    });
  });
  return slots;
}

function collectLawyerFields() {
  const especialidad       = document.getElementById('especialidad')?.value?.trim() || '';
  const tarifabaseRaw      = document.getElementById('tarifabase')?.value?.trim() || '';
  const duracionMinutosRaw = document.getElementById('duracionMinutos')?.value?.trim() || '';
  const direccionAtencion  = document.getElementById('direccionAtencion')?.value?.trim() || '';
  const biografia          = document.getElementById('biografia')?.value?.trim() || '';

  const estudioRuc        = document.getElementById('estudioRuc')?.value?.trim() || '';
  const estudioNombre     = document.getElementById('estudioNombre')?.value?.trim() || '';
  const estudioPais       = document.getElementById('estudioPais')?.value?.trim() || '';
  const estudioCiudad     = document.getElementById('estudioCiudad')?.value?.trim() || '';
  const estudioCorreo     = document.getElementById('estudioCorreo')?.value?.trim() || '';
  const estudioTelefono   = document.getElementById('estudioTelefono')?.value?.trim() || '';
  const estudioDireccion  = document.getElementById('estudioDireccion')?.value?.trim() || '';

  const tarifabase = tarifabaseRaw === '' ? null : Number(tarifabaseRaw);
  const duracionMinutos = duracionMinutosRaw === '' ? null : parseInt(duracionMinutosRaw, 10);

  return {
    especialidad,
    tarifabase,
    duracionMinutos,
    direccionAtencion,
    biografia,
    estudio: {
      ruc: estudioRuc,
      nombre: estudioNombre,
      pais: estudioPais,
      ciudad: estudioCiudad,
      correo: estudioCorreo,
      telefono: estudioTelefono,
      direccion: estudioDireccion,
    },
    disponibilidad: collectAvailability()
  };
}

// --- save (POST/PUT) ---
async function saveUser() {
  const form = document.getElementById('userForm');
  if (!form?.checkValidity()) { form?.reportValidity(); return; }

  const pwContainer = document.getElementById('password-fields');
  let claveToSend = undefined;
  if (pwContainer && pwContainer.style.display !== 'none') {
    const clave = document.getElementById('clave')?.value || '';
    const confirmar = document.getElementById('confirmarClave')?.value || '';
    if (clave !== confirmar) {
      showAlert('Las contraseñas no coinciden.', 'danger');
      return;
    }
    claveToSend = clave; // sólo en creación
  }

  const rolSelect = document.getElementById('rol');
  const selectedOption = rolSelect?.options[rolSelect.selectedIndex];
  const rolCodigo = selectedOption?.dataset?.codigo || '';
  const rolId = parseInt(rolSelect?.value || '', 10);
  if (!rolId || Number.isNaN(rolId)) { showAlert('Selecciona un rol válido.', 'danger'); return; }

  const payload = {
    persona: {
      dni: document.getElementById('dni')?.value?.trim(),
      telefono: document.getElementById('telefono')?.value?.trim(),
      correo: document.getElementById('email')?.value?.trim(),
      primer_nombre: document.getElementById('primerNombre')?.value?.trim(),
      segundo_nombre: document.getElementById('segundoNombre')?.value?.trim() || undefined,
      apellido_paterno: document.getElementById('apellidoPaterno')?.value?.trim(),
      apellido_materno: document.getElementById('apellidoMaterno')?.value?.trim() || undefined,
      direccion: document.getElementById('direccion')?.value?.trim() || undefined,
    },
    rol_id: rolId
  };
  if (claveToSend) payload.clave = claveToSend;
  if (rolCodigo === 'abogado') payload.abogado_info = collectLawyerFields();

  try {
    if (isEditing && currentUserId != null) {
      await apiFetch(`/users/${currentUserId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      showAlert('Usuario actualizado con éxito.', 'success');
    } else {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showAlert('Usuario creado con éxito.', 'success');
    }

    await loadUsers();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
  } catch (e) {
    showAlert(`Error guardando usuario: ${e.message}`, 'danger');
  }
}

// --- delete ---
function deleteUser(userId) {
  currentUserId = userId;
  bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
}

async function confirmDelete() {
  try {
    if (currentUserId == null) { showAlert('No se seleccionó usuario.', 'danger'); return; }
    await apiFetch(`/users/${currentUserId}`, { method: 'DELETE' });
    showAlert('Usuario eliminado con éxito.', 'success');
    bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
    await loadUsers();
  } catch (e) {
    showAlert(`Error eliminando usuario: ${e.message}`, 'danger');
  }
}

// --- alerts (reutiliza contenedor) ---
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
  alertDiv.style.minWidth = '300px';

  const closeBtn = `<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  alertDiv.innerHTML = isHTML
    ? `${message} ${closeBtn}`
    : `${String(message).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]))} ${closeBtn}`;

  alertContainer.appendChild(alertDiv);
  setTimeout(() => new bootstrap.Alert(alertDiv).close(), 5000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
