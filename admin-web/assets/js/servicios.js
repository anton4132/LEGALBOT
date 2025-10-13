const API_BASE_URL = '/api';

let state = {
  plans: [],
  services: [],
  planAssignments: new Map(),
  planFilters: {
    search: ''
  },
  serviceFilters: {
    search: '',
    estado: '',
    order: 'nombre'
  },
  editingPlanId: null,
  editingPlanServiceId: null,
  currentPlanForLink: null,
  planServiceShowAll: false
};

let currentServiceId = null;
let isEditingService = false;

console.log('✅ servicios.js cargado correctamente');

function logout() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminId');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('adminToken');

  window.location.href = '/login';
}

function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('adminToken');
  const headers = {
    ...(options.headers || {}),
  };

  if (token && !headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

document.addEventListener('DOMContentLoaded', () => {
  initializeServiciosPage();
  loadInitialData();
});

async function loadInitialData() {
  await Promise.allSettled([loadPlans(), loadServices()]);
  renderPlansTable();
  applyServiceFilters();
}

function initializeServiciosPage() {
  setupLayout();
  setupPlanModal();
  setupPlanServiceModal();
  setupServiceModalMeta();
  bindGlobalEvents();
}

function setupLayout() {
  const main = document.querySelector('main');
  if (!main) return;

  main.innerHTML = `
    <div class="d-flex flex-column gap-4">
      <section class="card shadow-sm border-0">
        <div class="card-header bg-white border-0 border-bottom d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <h3 class="fw-bold mb-0">Planes</h3>
            <p class="text-muted mb-0">Administra los planes disponibles y los servicios vinculados.</p>
          </div>
          <div class="d-flex flex-column flex-md-row gap-2 align-items-stretch align-items-md-center">
            <div class="input-group">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" id="planSearch" class="form-control" placeholder="Buscar plan por nombre">
            </div>
            <button class="btn btn-primary" id="newPlanBtn"><i class="bi bi-plus-lg me-1"></i>Nuevo plan</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table align-middle mb-0">
            <thead class="table-light">
              <tr>
                <th style="min-width: 220px;">Nombre</th>
                <th style="min-width: 140px;">Almacenamiento máx.</th>
                <th style="min-width: 160px;">Servicios asignados</th>
                <th style="min-width: 160px;">Actualizado</th>
                <th class="text-end" style="min-width: 220px;">Acciones</th>
              </tr>
            </thead>
            <tbody id="plansTableBody">
              <tr><td colspan="5" class="text-center py-4 text-muted">Cargando planes...</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card shadow-sm border-0">
        <div class="card-header bg-white border-0 border-bottom d-flex flex-column flex-xl-row gap-3 align-items-xl-center justify-content-between">
          <div>
            <h3 class="fw-bold mb-0">Servicios</h3>
            <p class="text-muted mb-0">Gestiona el catálogo de servicios disponibles en LegalBot.</p>
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-end">
            <div class="input-group" style="max-width: 220px;">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
              <input type="text" class="form-control" id="searchService" placeholder="Buscar servicio">
            </div>
            <select id="filterEstado" class="form-select" style="max-width: 170px;">
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
            <select id="orderBy" class="form-select" style="max-width: 200px;">
              <option value="nombre">Ordenar por nombre</option>
              <option value="fecha_creada">Ordenar por fecha de creación</option>
            </select>
            <button class="btn btn-primary" id="newServiceBtn"><i class="bi bi-plus-lg me-1"></i>Nuevo servicio</button>
          </div>
        </div>
        <div class="table-responsive">
          <table class="table table-striped align-middle mb-0">
            <thead>
              <tr>
                <th style="min-width: 120px;">Código</th>
                <th style="min-width: 200px;">Nombre</th>
                <th>Descripción</th>
                <th style="min-width: 100px;">Activo</th>
                <th style="min-width: 150px;">Creado</th>
                <th style="min-width: 150px;">Modificado</th>
                <th class="text-end" style="min-width: 200px;">Acciones</th>
              </tr>
            </thead>
            <tbody id="servicesTableBody">
              <tr><td colspan="7" class="text-center py-4 text-muted">Cargando servicios...</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function setupPlanModal() {
  if (document.getElementById('planModal')) return;

  const modalTemplate = `
    <div class="modal fade" id="planModal" tabindex="-1" aria-labelledby="planModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="planModalLabel">Nuevo plan</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <form id="planForm">
              <div class="mb-3">
                <label for="planNombre" class="form-label">Nombre *</label>
                <input type="text" id="planNombre" class="form-control" required>
              </div>
              <div class="mb-3">
                <label for="planAlmacenamiento" class="form-label">Almacenamiento máx. (MB)</label>
                <input type="number" min="0" id="planAlmacenamiento" class="form-control" placeholder="Sin límite">
                <div class="form-text">Deja vacío para establecer sin límite.</div>
              </div>
            </form>
            <div id="planMeta" class="small text-muted border-top pt-2 mt-3" style="display:none;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
            <button type="button" class="btn btn-primary" id="savePlanBtn">Guardar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalTemplate);
  document.getElementById('savePlanBtn').addEventListener('click', savePlan);
}

function setupPlanServiceModal() {
  if (document.getElementById('planServiceModal')) return;

  const modalTemplate = `
    <div class="modal fade" id="planServiceModal" tabindex="-1" aria-labelledby="planServiceModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable modal-xl">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="planServiceModalLabel">Servicios del plan</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
          </div>
          <div class="modal-body">
            <div class="mb-4">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="mb-0">Servicios vinculados</h6>
                <span class="badge rounded-pill text-bg-light" id="planServiceCount"></span>
              </div>
              <div class="table-responsive border rounded">
                <table class="table table-sm align-middle mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Servicio</th>
                      <th style="min-width: 160px;">Vigencia</th>
                      <th style="min-width: 120px;">Estado</th>
                      <th style="min-width: 140px;" class="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="planServicesTableBody">
                    <tr><td colspan="4" class="text-center py-3 text-muted">Sin servicios vinculados.</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <hr class="my-4">
            <h6 class="mb-3" id="planServiceFormTitle">Agregar servicio</h6>
            <form id="planServiceForm" class="row g-3">
              <div class="col-lg-6">
                <label for="planServiceServicio" class="form-label">Servicio *</label>
                <select id="planServiceServicio" class="form-select" required></select>
                <div class="form-check form-switch mt-2">
                  <input class="form-check-input" type="checkbox" id="planServiceShowAll">
                  <label class="form-check-label" for="planServiceShowAll">Mostrar servicios inactivos</label>
                </div>
              </div>
              <div class="col-lg-3">
                <label for="planServiceVigenciaDesde" class="form-label">Vigencia desde</label>
                <input type="datetime-local" id="planServiceVigenciaDesde" class="form-control">
              </div>
              <div class="col-lg-3">
                <label for="planServiceVigenciaHasta" class="form-label">Vigencia hasta</label>
                <input type="datetime-local" id="planServiceVigenciaHasta" class="form-control">
              </div>
              <div class="col-lg-3">
                <div class="form-check form-switch mt-4 pt-1">
                  <input class="form-check-input" type="checkbox" id="planServiceActivo" checked>
                  <label class="form-check-label" for="planServiceActivo">Activo</label>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer d-flex justify-content-between">
            <button type="button" class="btn btn-outline-secondary" id="planServiceResetBtn">Registrar nuevo</button>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
              <button type="button" class="btn btn-primary" id="planServiceSaveBtn">Guardar vinculación</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalTemplate);

  document.getElementById('planServiceShowAll').addEventListener('change', (ev) => {
    state.planServiceShowAll = ev.target.checked;
    populatePlanServiceOptions();
  });
  document.getElementById('planServiceSaveBtn').addEventListener('click', savePlanServiceLink);
  document.getElementById('planServiceResetBtn').addEventListener('click', resetPlanServiceForm);
  const tbody = document.getElementById('planServicesTableBody');
  tbody.addEventListener('click', handlePlanServiceTableAction);
}

function setupServiceModalMeta() {
  const modalBody = document.querySelector('#serviceModal .modal-body');
  if (modalBody && !document.getElementById('serviceMeta')) {
    const meta = document.createElement('div');
    meta.id = 'serviceMeta';
    meta.className = 'small text-muted border-top pt-2 mt-3';
    meta.style.display = 'none';
    modalBody.appendChild(meta);
  }
}

function bindGlobalEvents() {
  const planSearch = document.getElementById('planSearch');
  const newPlanBtn = document.getElementById('newPlanBtn');
  const newServiceBtn = document.getElementById('newServiceBtn');
  const servicesTable = document.getElementById('servicesTableBody');
  const plansTable = document.getElementById('plansTableBody');

  planSearch?.addEventListener('input', (event) => {
    state.planFilters.search = event.target.value.trim().toLowerCase();
    renderPlansTable();
  });

  newPlanBtn?.addEventListener('click', () => openPlanModal());
  newServiceBtn?.addEventListener('click', () => openServiceModal());

  document.getElementById('searchService')?.addEventListener('input', (event) => {
    state.serviceFilters.search = event.target.value.toLowerCase();
    applyServiceFilters();
  });
  document.getElementById('filterEstado')?.addEventListener('change', (event) => {
    state.serviceFilters.estado = event.target.value;
    applyServiceFilters();
  });
  document.getElementById('orderBy')?.addEventListener('change', (event) => {
    state.serviceFilters.order = event.target.value || 'nombre';
    applyServiceFilters();
  });

  servicesTable?.addEventListener('click', handleServicesTableAction);
  plansTable?.addEventListener('click', handlePlansTableAction);
}

async function loadPlans() {
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/plans`);
    if (!res.ok) throw new Error('Error cargando planes');
    const data = await res.json();
    const plans = Array.isArray(data) ? data : data.plans || [];
    state.plans = plans.map(normalizePlan);
    state.planAssignments = new Map(state.plans.map(plan => [plan.id, [...(plan.planservicios || [])]]));
  } catch (error) {
    console.error('Error cargando planes:', error);
    showAlert(error.message || 'No se pudieron cargar los planes', 'danger');
  }
}

async function loadServices() {
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/services`);
    if (!res.ok) throw new Error('Error cargando servicios');
    const data = await res.json();
    state.services = Array.isArray(data) ? data : data.services || [];
  } catch (err) {
    console.error('Error cargando servicios:', err);
    showAlert(err.message || 'No se pudieron cargar los servicios', 'danger');
  }
}

function normalizePlan(plan) {
  const planservicios = Array.isArray(plan.planservicios)
    ? plan.planservicios.map(normalizePlanServicio)
    : [];
  return {
    ...plan,
    planservicios
  };
}

function normalizePlanServicio(planServicio) {
  if (!planServicio) return planServicio;
  const servicio = planServicio.servicio || planServicio.service || state.services.find(s => s.id === planServicio.servicio_id) || null;
  return {
    ...planServicio,
    servicio
  };
}

function renderPlansTable() {
  const tbody = document.getElementById('plansTableBody');
  if (!tbody) return;

  let plans = [...state.plans];
  if (state.planFilters.search) {
    plans = plans.filter(plan => plan.nombre.toLowerCase().includes(state.planFilters.search));
  }

  tbody.innerHTML = '';

  if (!plans.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No se encontraron planes.</td></tr>';
    return;
  }

  plans.forEach(plan => {
    const serviciosAsignados = (state.planAssignments.get(plan.id) || []).length;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="fw-semibold">${escapeHtml(plan.nombre)}</div>
        <div class="text-muted small">ID ${plan.id}</div>
      </td>
      <td>${formatStorage(plan.almacenamiento_maximo)}</td>
      <td>
        <span class="badge rounded-pill text-bg-primary">${serviciosAsignados}</span>
      </td>
      <td>${formatDateTime(plan.actualizado_el)}</td>
      <div class="d-flex flex-wrap gap-2 justify-content-end">
          <button class="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" data-action="link-service" data-id="${plan.id}">
            <i class="bi bi-link-45deg"></i>
            <span>Vincular servicio</span>
          </button>
          <button class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" data-action="edit-plan" data-id="${plan.id}">
            <i class="bi bi-pencil"></i>
            <span>Editar plan</span>
          </button>
          <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" data-action="delete-plan" data-id="${plan.id}">
            <i class="bi bi-trash"></i>
            <span>Eliminar</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function handlePlansTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = parseInt(button.dataset.id, 10);
  const action = button.dataset.action;

  if (Number.isNaN(id)) return;

  switch (action) {
    case 'edit-plan':
      openPlanModal(id);
      break;
    case 'delete-plan':
      deletePlan(id);
      break;
    case 'link-service':
      openPlanServiceModal(id);
      break;
    default:
      break;
  }
}

function openPlanModal(id = null) {
  const modalEl = document.getElementById('planModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const form = document.getElementById('planForm');
  const meta = document.getElementById('planMeta');

  form.reset();
  meta.style.display = 'none';
  meta.textContent = '';
  state.editingPlanId = id;

  if (id) {
    const plan = state.plans.find(p => p.id === id);
    if (!plan) {
      showAlert('No se pudo encontrar el plan seleccionado', 'danger');
      return;
    }
    document.getElementById('planModalLabel').textContent = 'Editar plan';
    document.getElementById('planNombre').value = plan.nombre;
    document.getElementById('planAlmacenamiento').value = plan.almacenamiento_maximo ?? '';
    meta.style.display = 'block';
    meta.textContent = `ID: ${plan.id} · Última actualización: ${formatDateTime(plan.actualizado_el)}`;
  } else {
    document.getElementById('planModalLabel').textContent = 'Nuevo plan';
    document.getElementById('planAlmacenamiento').value = '';
  }

  modal.show();
}

async function savePlan() {
  const nombre = document.getElementById('planNombre').value.trim();
  const almacenamientoRaw = document.getElementById('planAlmacenamiento').value.trim();
  const almacenamiento = almacenamientoRaw === '' ? null : parseInt(almacenamientoRaw, 10);

  if (!nombre) {
    showAlert('El nombre del plan es obligatorio', 'danger');
    return;
  }
  if (almacenamientoRaw !== '' && (Number.isNaN(almacenamiento) || almacenamiento < 0)) {
    showAlert('El almacenamiento máximo debe ser un número entero positivo', 'danger');
    return;
  }

  const payload = {
    nombre,
    almacenamiento_maximo: almacenamiento
  };

  const isEdit = !!state.editingPlanId;
  const url = isEdit ? `${API_BASE_URL}/plans/${state.editingPlanId}` : `${API_BASE_URL}/plans`;
  const method = isEdit ? 'PUT' : 'POST';
  const modalEl = document.getElementById('planModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  try {
    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error guardando plan');

    showAlert(isEdit ? 'Plan actualizado correctamente' : 'Plan creado correctamente', 'success');
    modal.hide();
    await loadPlans();
    renderPlansTable();
  } catch (error) {
    console.error('Error guardando plan:', error);
    showAlert(error.message || 'No se pudo guardar el plan', 'danger');
  }
}

async function deletePlan(id) {
  const plan = state.plans.find(p => p.id === id);
  if (!plan) return;

  if (!confirm(`¿Eliminar el plan "${plan.nombre}"? Esta acción no se puede deshacer.`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/plans/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error eliminando plan');

    showAlert('Plan eliminado correctamente', 'success');
    await loadPlans();
    renderPlansTable();
  } catch (error) {
    console.error('Error eliminando plan:', error);
    showAlert(error.message || 'No se pudo eliminar el plan', 'danger');
  }
}

async function openPlanServiceModal(planId) {
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) {
    showAlert('No se encontró el plan seleccionado', 'danger');
    return;
  }

  state.currentPlanForLink = planId;
  state.editingPlanServiceId = null;
  state.planServiceShowAll = false;
  resetPlanServiceForm();
  document.getElementById('planServiceShowAll').checked = false;
  document.getElementById('planServiceModalLabel').textContent = `Servicios del plan: ${plan.nombre}`;
  document.getElementById('planServiceFormTitle').textContent = 'Agregar servicio';

  await refreshPlanAssignments(planId);
  populatePlanServiceOptions();
  renderPlanServicesTable(planId);

  const modalEl = document.getElementById('planServiceModal');
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function populatePlanServiceOptions() {
  const select = document.getElementById('planServiceServicio');
  if (!select) return;

  const planId = state.currentPlanForLink;
  const assignments = planId ? state.planAssignments.get(planId) || [] : [];
  const assignedIds = assignments.map(item => item.servicio_id);

  select.innerHTML = '<option value="">Selecciona un servicio</option>';

  const services = state.planServiceShowAll
    ? [...state.services]
    : state.services.filter(service => service.activo);

  services
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .forEach(service => {
      const option = document.createElement('option');
      option.value = service.id;
      option.textContent = `${service.codigo} — ${service.nombre}`;
      if (!state.editingPlanServiceId && assignedIds.includes(service.id)) {
        option.disabled = true;
        option.textContent += ' (ya vinculado)';
      }
      select.appendChild(option);
    });

  if (state.editingPlanServiceId) {
    const currentAssignment = assignments.find(item => item.id === state.editingPlanServiceId);
    if (currentAssignment) {
      select.value = currentAssignment.servicio_id;
    }
  }
}

function renderPlanServicesTable(planId) {
  const tbody = document.getElementById('planServicesTableBody');
  const countBadge = document.getElementById('planServiceCount');
  if (!tbody) return;
  const assignments = state.planAssignments.get(planId) || [];

  countBadge.textContent = `${assignments.length} servicio${assignments.length === 1 ? '' : 's'}`;

  tbody.innerHTML = '';

  if (!assignments.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3 text-muted">No hay servicios asignados a este plan.</td></tr>';
    return;
  }

  assignments
    .slice()
    .sort((a, b) => {
      const serviceA = a.servicio?.nombre || '';
      const serviceB = b.servicio?.nombre || '';
      return serviceA.localeCompare(serviceB);
    })
    .forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <div class="fw-semibold">${escapeHtml(item.servicio?.nombre || 'Servicio #'+item.servicio_id)}</div>
          <div class="text-muted small">${escapeHtml(item.servicio?.codigo || '')}</div>
        </td>
        <td>${formatDateRange(item.vigencia_desde, item.vigencia_hasta)}</td>
        <td>${item.activo ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
        <td class="text-end">
          <div class="d-flex flex-wrap gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" data-action="edit-plan-service" data-id="${item.id}">
              <i class="bi bi-pencil"></i>
              <span>Editar</span>
            </button>
            <button class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" data-action="delete-plan-service" data-id="${item.id}">
              <i class="bi bi-trash"></i>
              <span>Eliminar</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
}

async function refreshPlanAssignments(planId) {
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/plans/${planId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error obteniendo servicios del plan');

    const planData = data.plan || data;
    const normalized = normalizePlan(planData);
    state.planAssignments.set(planId, normalized.planservicios || []);
    updatePlanInState(normalized);
    renderPlansTable();
  } catch (error) {
    console.error('Error obteniendo vinculación plan-servicio:', error);
    showAlert(error.message || 'No se pudieron obtener los servicios del plan', 'danger');
  }
}

function updatePlanInState(plan) {
  const idx = state.plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) {
    state.plans[idx] = { ...state.plans[idx], ...plan };
  } else {
    state.plans.push(plan);
  }
}

function resetPlanServiceForm() {
  const form = document.getElementById('planServiceForm');
  if (!form) return;
  form.reset();
  document.getElementById('planServiceActivo').checked = true;
  state.editingPlanServiceId = null;
  document.getElementById('planServiceFormTitle').textContent = 'Agregar servicio';
  populatePlanServiceOptions();
}

function handlePlanServiceTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = parseInt(button.dataset.id, 10);
  if (Number.isNaN(id)) return;

  if (button.dataset.action === 'edit-plan-service') {
    startEditPlanService(id);
  } else if (button.dataset.action === 'delete-plan-service') {
    deletePlanService(id);
  }
}

function startEditPlanService(id) {
  const planId = state.currentPlanForLink;
  if (!planId) return;
  const assignments = state.planAssignments.get(planId) || [];
  const assignment = assignments.find(item => item.id === id);
  if (!assignment) {
    showAlert('No se encontró la vinculación seleccionada', 'danger');
    return;
  }

  state.editingPlanServiceId = id;
  document.getElementById('planServiceFormTitle').textContent = 'Editar servicio vinculado';

  populatePlanServiceOptions();
  document.getElementById('planServiceServicio').value = assignment.servicio_id;
  document.getElementById('planServiceActivo').checked = !!assignment.activo;
  document.getElementById('planServiceVigenciaDesde').value = toLocalInputDate(assignment.vigencia_desde);
  document.getElementById('planServiceVigenciaHasta').value = toLocalInputDate(assignment.vigencia_hasta);
}

async function savePlanServiceLink() {
  const planId = state.currentPlanForLink;
  if (!planId) return;

  const servicioId = parseInt(document.getElementById('planServiceServicio').value, 10);
  const activo = document.getElementById('planServiceActivo').checked;
  const vigenciaDesdeInput = document.getElementById('planServiceVigenciaDesde');
  const vigenciaHastaInput = document.getElementById('planServiceVigenciaHasta');

  const vigenciaDesdeISO = parseDateTimeLocalInput(vigenciaDesdeInput);
  const vigenciaHastaISO = parseDateTimeLocalInput(vigenciaHastaInput);

  if (vigenciaDesdeInput?.value && !vigenciaDesdeISO) {
    showAlert('La fecha de vigencia desde no es válida', 'danger');
    return;
  }

  if (vigenciaHastaInput?.value && !vigenciaHastaISO) {
    showAlert('La fecha de vigencia hasta no es válida', 'danger');
    return;
  }

  if (!servicioId) {
    showAlert('Selecciona un servicio para vincular', 'danger');
    return;
  }

  
  if (vigenciaDesdeISO && vigenciaHastaISO && new Date(vigenciaDesdeISO) >= new Date(vigenciaHastaISO)) {
    showAlert('La vigencia hasta debe ser posterior a la vigencia desde', 'danger');
    return;
  }

  const assignments = state.planAssignments.get(planId) || [];
  const alreadyLinked = assignments.some(item => item.servicio_id === servicioId && item.id !== state.editingPlanServiceId);
  if (!state.editingPlanServiceId && alreadyLinked) {
    showAlert('El servicio ya está vinculado a este plan', 'warning');
    return;
  }

  const isEdit = !!state.editingPlanServiceId;
  const url = isEdit
    ? `${API_BASE_URL}/plan-services/${state.editingPlanServiceId}`
    : `${API_BASE_URL}/plan-services`;
  const method = isEdit ? 'PUT' : 'POST';

  const payload = {
    plan_id: planId,
    servicio_id: servicioId,
    activo,
    vigencia_desde: vigenciaDesdeISO,
    vigencia_hasta: vigenciaHastaISO
  };

  try {
    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error guardando la vinculación');

    showAlert(isEdit ? 'Vinculación actualizada' : 'Servicio vinculado correctamente', 'success');
    await refreshPlanAssignments(planId);
    renderPlanServicesTable(planId);
    resetPlanServiceForm();
  } catch (error) {
    console.error('Error guardando vinculación plan-servicio:', error);
    showAlert(error.message || 'No se pudo guardar la vinculación', 'danger');
  }
}

async function deletePlanService(id) {
  const planId = state.currentPlanForLink;
  if (!planId) return;
  const assignments = state.planAssignments.get(planId) || [];
  const assignment = assignments.find(item => item.id === id);
  if (!assignment) return;

  if (!confirm(`¿Deseas eliminar la vinculación del servicio "${assignment.servicio?.nombre || assignment.servicio_id}"?`)) {
    return;
  }

  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/plan-services/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error eliminando vinculación');

    showAlert('Vinculación eliminada correctamente', 'success');
    await refreshPlanAssignments(planId);
    renderPlanServicesTable(planId);
    resetPlanServiceForm();
  } catch (error) {
    console.error('Error eliminando vinculación plan-servicio:', error);
    showAlert(error.message || 'No se pudo eliminar la vinculación', 'danger');
  }
}

function applyServiceFilters() {
  let list = [...state.services];
  const { search, estado, order } = state.serviceFilters;

  if (search) {
    list = list.filter(service =>
      service.codigo.toLowerCase().includes(search) ||
      service.nombre.toLowerCase().includes(search)
    );
  }

  if (estado === 'true' || estado === 'false') {
    list = list.filter(service => String(service.activo) === estado);
  }

  if (order === 'fecha_creada') {
    list.sort((a, b) => new Date(b.fecha_creada) - new Date(a.fecha_creada));
  } else {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  renderServicesTable(list);
}

function renderServicesTable(list) {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No se encontraron servicios.</td></tr>';
    return;
  }

  list.forEach(service => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="fw-semibold">${escapeHtml(service.codigo)}</td>
      <td>${escapeHtml(service.nombre)}</td>
      <td>${escapeHtml(service.descripcion || '')}</td>
      <td>${service.activo ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
      <td>${formatDateTime(service.fecha_creada)}</td>
      <td>${formatDateTime(service.fecha_modificada)}</td>
      <td class="text-end">
        <div class="d-flex flex-wrap gap-2 justify-content-end">
          <button class="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" data-action="edit-service" data-id="${service.id}">
            <i class="bi bi-pencil"></i>
            <span>Editar</span>
          </button>
          <button class="btn btn-sm ${service.activo ? 'btn-outline-warning' : 'btn-outline-success'} d-inline-flex align-items-center gap-1" data-action="toggle-service" data-id="${service.id}" data-activo="${service.activo}">
            ${service.activo ? '<i class="bi bi-slash-circle"></i><span>Desactivar</span>' : '<i class="bi bi-check-circle"></i><span>Activar</span>'}  </button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function handleServicesTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = parseInt(button.dataset.id, 10);
  if (Number.isNaN(id)) return;
  const action = button.dataset.action;

  if (action === 'edit-service') {
    openServiceModal(id);
  } else if (action === 'toggle-service') {
    const activo = button.dataset.activo === 'true';
    toggleService(id, activo);
  }
}

function openServiceModal(id = null) {
  const modalEl = document.getElementById('serviceModal');
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const form = document.getElementById('serviceForm');
  const meta = document.getElementById('serviceMeta');

  form.reset();
  currentServiceId = id;
  isEditingService = !!id;
  document.getElementById('serviceModalLabel').textContent = id ? 'Editar servicio' : 'Nuevo servicio';
  document.getElementById('svcActivo').checked = true;
  if (meta) {
    meta.style.display = 'none';
    meta.textContent = '';
  }

  if (id) {
    const svc = state.services.find(s => s.id === id);
    if (svc) {
      document.getElementById('svcCodigo').value = svc.codigo;
      document.getElementById('svcNombre').value = svc.nombre;
      document.getElementById('svcDescripcion').value = svc.descripcion || '';
      document.getElementById('svcActivo').checked = svc.activo;
      if (meta) {
        meta.style.display = 'block';
        meta.textContent = `ID: ${svc.id} · Creado: ${formatDateTime(svc.fecha_creada)} · Modificado: ${formatDateTime(svc.fecha_modificada)}`;
      }
    }
  }

  modal.show();
}

async function saveService() {
  const codigo = document.getElementById('svcCodigo').value.trim();
  const nombre = document.getElementById('svcNombre').value.trim();
  const descripcion = document.getElementById('svcDescripcion').value.trim();
  const activo = document.getElementById('svcActivo').checked;
  if (!codigo || !nombre) {
    showAlert('Código y nombre son obligatorios', 'danger');
    return;
  }
  const payload = { codigo, nombre, descripcion: descripcion || null, activo };
  const url = isEditingService ? `${API_BASE_URL}/services/${currentServiceId}` : `${API_BASE_URL}/services`;
  const method = isEditingService ? 'PUT' : 'POST';
  const modalEl = document.getElementById('serviceModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  try {
    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Error ${isEditingService ? 'modificando' : 'creando'} servicio`);
    }
    showAlert(isEditingService ? 'Servicio modificado correctamente' : 'Servicio creado correctamente', 'success');
    modal.hide();
    await loadServices();
    applyServiceFilters();
  } catch (err) {
    console.error('Error guardando servicio:', err);
    showAlert(err.message, 'danger');
  }
}

async function toggleService(id, activo) {
  try {
    const res = await fetchWithAuth(`${API_BASE_URL}/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !activo })
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.tarifas || data.planes) {
        const force = confirm(`${data.message}. ¿Desactivar de todos modos?`);
        if (!force) return;
        const forceRes = await fetchWithAuth(`${API_BASE_URL}/services/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activo: false, force: true })
        });
        const forceData = await forceRes.json();
        if (!forceRes.ok) throw new Error(forceData.message || 'Error actualizando servicio');
      } else {
        throw new Error(data.message || 'Error actualizando servicio');
      }
    }
    await loadServices();
    applyServiceFilters();
    await refreshPlanAssignmentsAfterServiceChange(id);
    showAlert('Servicio actualizado', 'success');
  } catch (err) {
    console.error('Error actualizando servicio:', err);
    showAlert(err.message, 'danger');
  }
}

async function refreshPlanAssignmentsAfterServiceChange(servicioId) {
  const affected = [];
  state.planAssignments.forEach((assignments, planId) => {
    if (assignments.some(item => item.servicio_id === servicioId)) {
      affected.push(planId);
    }
  });
  if (!affected.length) return;
  await Promise.all(affected.map(planId => refreshPlanAssignments(planId)));
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; max-width: 360px;';
  alertDiv.innerHTML = `${escapeHtml(message)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(alertDiv);
  setTimeout(() => { alertDiv.remove(); }, 4000);
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDateTimeLocalInput(input) {
  if (!input) return null;
  const value = (input.value || '').trim();
  if (!value) return null;

  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;

  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const [hourStr, minuteStr = '0', secondStr = '0'] = timePart.split(':');

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = Number(secondStr);

  if ([year, month, day, hour, minute, second].some(num => Number.isNaN(num))) {
    return null;
  }

  const date = new Date(year, month - 1, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}


function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDateRange(from, to) {
  if (!from && !to) return 'Sin vigencia definida';
  const desde = from ? formatDateTime(from) : 'Indefinido';
  const hasta = to ? formatDateTime(to) : 'Indefinido';
  return `${desde} — ${hasta}`;
}

function formatStorage(value) {
  if (value === null || value === undefined) return 'Sin límite';
  if (Number.isNaN(Number(value))) return '—';
  return `${Number(value).toLocaleString('es-PE')} MB`;
}

function toLocalInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Exponer funciones necesarias globalmente
window.openServiceModal = openServiceModal;
window.saveService = saveService;
window.logout = logout;