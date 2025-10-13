const API_BASE_URL = (typeof window !== 'undefined' && window.LEGALBOT_ADMIN_API_BASE_URL) || '/api';

const PARAM_TEMPLATES = {
  fijo: { monto: 0 },
  minimo_mas_variable: { minimo: 0, porcentaje_variable: 0 },
  paquete: { tamano_bloque: 0, precio_bloque: 0 },
  consumo_ia: { rate: 0, minimo: 0 },
  estacional: { multiplicadores: [{ desde: '', hasta: '', factor: 1 }] },
};

const state = {
  catalogs: {
    servicios: [],
    planes: [],
    monedas: [],
    metodos_pago: [],
    regiones: [],
    econconfig: null,
    impuestos: [],
    pasarelas: [],
    parametrosPlantilla: PARAM_TEMPLATES,
  },
  filters: {
    servicio_id: '',
    plan_id: '',
    rol_aplica: '',
    activo: '',
    metodo_pago: '',
    moneda: '',
    ambito_region: '',
    fecha: '',
  },
  pagination: {
    page: 1,
    perPage: 10,
    total: 0,
  },
  rules: [],
  wizard: {
    open: false,
    step: 1,
    mode: 'create',
    id: null,
    sourceId: null,
    data: createEmptyRule(),
    conflicts: [],
  },
  simulator: {
    open: false,
    loading: false,
    result: null,
    inputs: {
      servicio_id: '',
      plan_id: '',
      rol_aplica: 'cliente',
      moneda: '',
      metodo_pago: '',
      ambito_region: '',
      fecha: new Date().toISOString().substring(0, 10),
      consumo: 0,
    },
  },
  quick: {
    servicios: [],
    impuestos: [],
    currentServicioId: null,
    currentImpuestoId: null,
    econconfig: null,
  },
};

const dom = {};
const bootstrapLib = typeof window !== 'undefined' ? window.bootstrap : undefined;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  setupOverlays();
  bindEvents();
  resetWizardFormState();
  await loadCatalogs();
  resetFilters();
  await loadRules();
  hydrateSimulatorInputs();
}

function cacheDom() {
  dom.filters = {
    form: document.getElementById('tc-filters-form'),
    servicio: document.getElementById('tc-filter-servicio'),
    plan: document.getElementById('tc-filter-plan'),
    rol: document.getElementById('tc-filter-rol'),
    estado: document.getElementById('tc-filter-estado'),
    metodo: document.getElementById('tc-filter-metodo'),
    moneda: document.getElementById('tc-filter-moneda'),
    region: document.getElementById('tc-filter-region'),
    fecha: document.getElementById('tc-filter-fecha'),
    reset: document.getElementById('tc-filters-reset'),
  };
  dom.table = {
    body: document.getElementById('tc-table-body'),
    empty: document.getElementById('tc-empty-state'),
    rowsPerPage: document.getElementById('tc-rows-per-page'),
    pagination: document.getElementById('tc-pagination'),
  };
  dom.actions = {
    newRule: document.getElementById('tc-new-rule-btn'),
    exportCsv: document.getElementById('tc-export-btn'),
    toggleSimulator: document.getElementById('tc-simulator-toggle'),
  };
  dom.simulator = {
    panel: document.getElementById('tc-simulator-panel'),
    close: document.getElementById('tc-simulator-close'),
    form: document.getElementById('tc-simulator-form'),
    result: document.getElementById('tc-simulator-result'),
    inputs: {
      servicio: document.getElementById('tc-sim-servicio'),
      plan: document.getElementById('tc-sim-plan'),
      rol: document.getElementById('tc-sim-rol'),
      moneda: document.getElementById('tc-sim-moneda'),
      metodo: document.getElementById('tc-sim-metodo'),
      region: document.getElementById('tc-sim-region'),
      fecha: document.getElementById('tc-sim-fecha'),
      consumo: document.getElementById('tc-sim-consumo'),
    },
  };
  dom.wizard = {
    modal: document.getElementById('tc-wizard'),
    title: document.getElementById('tc-wizard-title'),
    close: document.getElementById('tc-wizard-close'),
    cancel: document.getElementById('tc-wizard-cancel'),
    next: document.getElementById('tc-wizard-next'),
    prev: document.getElementById('tc-wizard-prev'),
    save: document.getElementById('tc-wizard-save'),
    form: document.getElementById('tc-wizard-form'),
    steps: Array.from(document.querySelectorAll('[data-tc-step]')),
    indicators: Array.from(document.querySelectorAll('[data-tc-step-indicator]')),
    alert: document.getElementById('tc-conflict-alert'),
    inputs: {
      codigo: document.getElementById('tc-input-codigo'),
      servicio: document.getElementById('tc-input-servicio'),
      plan: document.getElementById('tc-input-plan'),
      rol: document.getElementById('tc-input-rol'),
      moneda: document.getElementById('tc-input-moneda'),
      metodo: document.getElementById('tc-input-metodo'),
      region: document.getElementById('tc-input-region'),
      prioridad: document.getElementById('tc-input-prioridad'),
      vigenciaDesde: document.getElementById('tc-input-vigencia-desde'),
      vigenciaHasta: document.getElementById('tc-input-vigencia-hasta'),
      descripcion: document.getElementById('tc-input-descripcion'),
      activo: document.getElementById('tc-input-activo'),
      tipoCalculo: document.getElementById('tc-input-tipo-calculo'),
      valor: document.getElementById('tc-input-valor'),
      incluyeImpuesto: document.getElementById('tc-input-incluye-impuesto'),
      parametros: document.getElementById('tc-input-parametros'),
      step3Plan: document.getElementById('tc-step3-plan'),
      step3Metodo: document.getElementById('tc-step3-metodo'),
      step3Fecha: document.getElementById('tc-step3-fecha'),
      step3Consumo: document.getElementById('tc-step3-consumo'),
    },
    step3Simulate: document.getElementById('tc-step3-simular'),
    step3Result: document.getElementById('tc-step3-result'),
  };
  dom.quickAccess = {
    serviciosBtn: document.getElementById('tc-open-servicios'),
    impuestosBtn: document.getElementById('tc-open-impuestos'),
    econfigBtn: document.getElementById('tc-open-econfig'),
    servicios: {
      modal: document.getElementById('tc-servicios-modal'),
      tableBody: document.querySelector('#tc-servicios-table tbody'),
      search: document.getElementById('tc-servicios-search'),
      estado: document.getElementById('tc-servicios-estado'),
      form: document.getElementById('tc-servicios-form'),
      id: document.getElementById('tc-servicios-id'),
      codigo: document.getElementById('tc-servicios-codigo'),
      nombre: document.getElementById('tc-servicios-nombre'),
      descripcion: document.getElementById('tc-servicios-descripcion'),
      activo: document.getElementById('tc-servicios-activo'),
      reset: document.getElementById('tc-servicios-reset'),
      delete: document.getElementById('tc-servicios-delete'),
    },
    impuestos: {
      modal: document.getElementById('tc-impuestos-modal'),
      tableBody: document.querySelector('#tc-impuestos-table tbody'),
      estado: document.getElementById('tc-impuestos-estado'),
      form: document.getElementById('tc-impuestos-form'),
      id: document.getElementById('tc-impuestos-id'),
      codigo: document.getElementById('tc-impuestos-codigo'),
      nombre: document.getElementById('tc-impuestos-nombre'),
      porcentaje: document.getElementById('tc-impuestos-porcentaje'),
      vigenciaDesde: document.getElementById('tc-impuestos-vigencia-desde'),
      vigenciaHasta: document.getElementById('tc-impuestos-vigencia-hasta'),
      incluido: document.getElementById('tc-impuestos-incluido'),
      activo: document.getElementById('tc-impuestos-activo'),
      reset: document.getElementById('tc-impuestos-reset'),
      delete: document.getElementById('tc-impuestos-delete'),
    },
    econfig: {
      modal: document.getElementById('tc-econfig-modal'),
      form: document.getElementById('tc-econfig-form'),
      moneda: document.getElementById('tc-econfig-moneda'),
      decimales: document.getElementById('tc-econfig-decimales'),
      regla: document.getElementById('tc-econfig-regla'),
      activo: document.getElementById('tc-econfig-activo'),
    },
  };
}


function setupOverlays() {
    if (dom.wizard?.modal) {
      if (bootstrapLib?.Modal) {
        dom.wizard.modalInstance = bootstrapLib.Modal.getOrCreateInstance(dom.wizard.modal, {
          backdrop: 'static',
          keyboard: false,
        });
        dom.wizard.modal.addEventListener('hidden.bs.modal', () => {
          resetWizardFormState();
        });
        dom.wizard.modal.addEventListener('shown.bs.modal', () => {
          state.wizard.open = true;
          updateWizardUi();
        });
      } else {
        dom.wizard.modal.classList.add('d-none');
      }
    }
    if (dom.simulator?.panel) {
      if (bootstrapLib?.Offcanvas) {
        dom.simulator.offcanvasInstance = bootstrapLib.Offcanvas.getOrCreateInstance(dom.simulator.panel, {
          scroll: true,
        });
        dom.simulator.panel.addEventListener('hidden.bs.offcanvas', () => {
          state.simulator.open = false;
        });
        dom.simulator.panel.addEventListener('shown.bs.offcanvas', () => {
          state.simulator.open = true;
        });
      } else {
        dom.simulator.panel.classList.remove('show');
        dom.simulator.panel.setAttribute('aria-hidden', 'true');
        state.simulator.open = false;
      }
      state.simulator.open = false;
    }
  }

  
function bindEvents() {
  if (dom.filters.form) {
    dom.filters.form.addEventListener('submit', (event) => {
      event.preventDefault();
      applyFilters();
    });
  }
  if (dom.filters.reset) {
    dom.filters.reset.addEventListener('click', (event) => {
      event.preventDefault();
      resetFilters();
      loadRules();
    });
  }
  if (dom.table.rowsPerPage) {
    dom.table.rowsPerPage.addEventListener('change', () => {
      state.pagination.perPage = Number(dom.table.rowsPerPage.value) || 10;
      state.pagination.page = 1;
      loadRules();
    });
  }
  if (dom.actions.newRule) {
    dom.actions.newRule.addEventListener('click', () => openWizard('create'));
  }
  if (dom.actions.exportCsv) {
    dom.actions.exportCsv.addEventListener('click', exportCsv);
  }
  if (dom.table.body) {
    dom.table.body.addEventListener('click', handleTableAction);
  }
  if (dom.actions.toggleSimulator) {
    dom.actions.toggleSimulator.addEventListener('click', () => toggleSimulator(!state.simulator.open));
  }
  if (dom.simulator.close) {
    dom.simulator.close.addEventListener('click', () => toggleSimulator(false));
  }
  if (dom.simulator.form) {
    dom.simulator.form.addEventListener('submit', async (event) => {
      event.preventDefault();
      await runPanelSimulation();
    });
  }
  if (dom.wizard.close) {
    dom.wizard.close.addEventListener('click', () => toggleWizard(false));
  }
  if (dom.wizard.cancel) {
    dom.wizard.cancel.addEventListener('click', () => toggleWizard(false));
  }
  if (dom.wizard.next) {
    dom.wizard.next.addEventListener('click', () => goToWizardStep(state.wizard.step + 1));
  }
  if (dom.wizard.prev) {
    dom.wizard.prev.addEventListener('click', () => goToWizardStep(state.wizard.step - 1));
  }
  if (dom.wizard.save) {
    dom.wizard.save.addEventListener('click', saveWizard);
  }
  if (dom.wizard.inputs.tipoCalculo) {
    dom.wizard.inputs.tipoCalculo.addEventListener('change', handleTipoCalculoChange);
  }
  if (dom.wizard.step3Simulate) {
    dom.wizard.step3Simulate.addEventListener('click', simulateFromWizard);
  }
  if (dom.wizard.indicators.length) {
    dom.wizard.indicators.forEach((button) => {
      button.addEventListener('click', () => {
        const target = Number(button.getAttribute('data-tc-step-indicator'));
        if (target < state.wizard.step) {
          goToWizardStep(target);
        }
      });
    });
  }
  if (dom.quickAccess?.serviciosBtn) {
    dom.quickAccess.serviciosBtn.addEventListener('click', openServiciosModal);
  }
  if (dom.quickAccess?.impuestosBtn) {
    dom.quickAccess.impuestosBtn.addEventListener('click', openImpuestosModal);
  }
  if (dom.quickAccess?.econfigBtn) {
    dom.quickAccess.econfigBtn.addEventListener('click', openEconfigModal);
  }
  if (dom.quickAccess?.servicios.search) {
    dom.quickAccess.servicios.search.addEventListener('input', debounce(refreshServiciosList, 250));
  }
  if (dom.quickAccess?.servicios.estado) {
    dom.quickAccess.servicios.estado.addEventListener('change', refreshServiciosList);
  }
  if (dom.quickAccess?.servicios.tableBody) {
    dom.quickAccess.servicios.tableBody.addEventListener('click', handleServicioRowClick);
  }
  if (dom.quickAccess?.servicios.form) {
    dom.quickAccess.servicios.form.addEventListener('submit', submitServicioForm);
  }
  if (dom.quickAccess?.servicios.reset) {
    dom.quickAccess.servicios.reset.addEventListener('click', resetServicioForm);
  }
  if (dom.quickAccess?.servicios.delete) {
    dom.quickAccess.servicios.delete.addEventListener('click', deactivateServicio);
  }
  if (dom.quickAccess?.impuestos.estado) {
    dom.quickAccess.impuestos.estado.addEventListener('change', refreshImpuestosList);
  }
  if (dom.quickAccess?.impuestos.tableBody) {
    dom.quickAccess.impuestos.tableBody.addEventListener('click', handleImpuestoRowClick);
  }
  if (dom.quickAccess?.impuestos.form) {
    dom.quickAccess.impuestos.form.addEventListener('submit', submitImpuestoForm);
  }
  if (dom.quickAccess?.impuestos.reset) {
    dom.quickAccess.impuestos.reset.addEventListener('click', resetImpuestoForm);
  }
  if (dom.quickAccess?.impuestos.delete) {
    dom.quickAccess.impuestos.delete.addEventListener('click', deactivateImpuesto);
  }
  if (dom.quickAccess?.econfig.form) {
    dom.quickAccess.econfig.form.addEventListener('submit', submitEconfigForm);
  }
}

function buildUrl(path, params) {
  const base = (API_BASE_URL || '/api').replace(/\/$/, '');
  const full = `${base}${path}`;
  const url = base.startsWith('http') ? new URL(full) : new URL(full, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      url.searchParams.append(key, value);
    });
  }
  return url;
}

async function apiRequest(method, path, body, params) {
  const url = buildUrl(path, params);
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }
  if (!response.ok) {
    const message = (payload && payload.message) || 'Error de comunicación con el servidor';
    const error = new Error(message);
    error.status = response.status;
    error.response = payload;
    throw error;
  }
  return payload;
}

function apiGet(path, params) {
  return apiRequest('GET', path, undefined, params);
}

function apiPost(path, body) {
  return apiRequest('POST', path, body);
}

function apiPut(path, body) {
  return apiRequest('PUT', path, body);
}
function apiDelete(path) {
    return apiRequest('DELETE', path);
  }

async function loadCatalogs() {
  try {
    const data = await apiGet('/tarifas/catalogs');
    state.catalogs = {
      servicios: data.servicios || [],
      planes: data.planes || [],
      monedas: data.monedas || [],
      metodos_pago: data.metodos_pago || [],
      regiones: data.regiones || [],
      econconfig: data.econconfig || null,
      impuestos: data.impuestos || [],
      pasarelas: data.pasarelas || [],
      parametrosPlantilla: data.parametrosPlantilla || PARAM_TEMPLATES,
    };
    state.quick.econconfig = data.econconfig || null;
    populateCatalogSelects();
  } catch (error) {
    console.error('Error cargando catálogos', error);
    window.alert(error.message || 'No se pudieron cargar los catálogos de tarifas');
  }
}

function populateCatalogSelects() {
  const { servicios, planes, monedas, metodos_pago, regiones, econconfig } = state.catalogs;
  fillSelect(dom.filters.servicio, servicios, { value: 'id', label: (s) => `${s.codigo} - ${s.nombre}` });
  fillSelect(dom.filters.plan, planes, { value: 'id', label: 'nombre' });
  fillSelect(dom.filters.metodo, metodos_pago.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true);
  fillSelect(dom.filters.moneda, monedas.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true);
  fillSelect(dom.filters.region, regiones.map((r) => ({ id: r, nombre: r })), { value: 'id', label: 'nombre' }, true);
  const wizardInputs = dom.wizard.inputs;
  fillSelect(wizardInputs.servicio, servicios, { value: 'id', label: (s) => `${s.codigo} - ${s.nombre}` }, true, 'Todos');
  fillSelect(wizardInputs.plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(wizardInputs.moneda, monedas.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true, econconfig?.moneda_defecto || '');
  fillSelect(wizardInputs.metodo, metodos_pago.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.simulator.inputs.servicio, servicios, { value: 'id', label: (s) => `${s.codigo} - ${s.nombre}` }, true, 'Todos');
  fillSelect(dom.simulator.inputs.plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.simulator.inputs.moneda, monedas.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true, econconfig?.moneda_defecto || '');
  fillSelect(dom.simulator.inputs.metodo, metodos_pago.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.simulator.inputs.region, regiones.map((r) => ({ id: r, nombre: r })), { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.wizard.inputs.step3Plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.wizard.inputs.step3Metodo, metodos_pago.map((m) => ({ id: m, nombre: m })), { value: 'id', label: 'nombre' }, true, 'Todos');
  dom.simulator.inputs.rol.value = 'cliente';
  dom.simulator.inputs.fecha.value = state.simulator.inputs.fecha;
  dom.wizard.inputs.step3Fecha.value = new Date().toISOString().substring(0, 10);
}

function fillSelect(select, items, { value, label }, allowEmpty = true, emptyLabel = 'Todos') {
  if (!select) return;
  const current = select.value;
  select.innerHTML = '';
  if (allowEmpty) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = emptyLabel;
    select.appendChild(option);
  }
  items.forEach((item) => {
    const option = document.createElement('option');
    const optionValue = typeof value === 'function' ? value(item) : item[value];
    option.value = optionValue ?? '';
    option.textContent = typeof label === 'function' ? label(item) : item[label];
    select.appendChild(option);
  });
  if (current) {
    select.value = current;
  }
}

function resetFilters() {
  state.filters = {
    servicio_id: '',
    plan_id: '',
    rol_aplica: '',
    activo: '',
    metodo_pago: '',
    moneda: '',
    ambito_region: '',
    fecha: '',
  };
  if (dom.filters.servicio) dom.filters.servicio.value = '';
  if (dom.filters.plan) dom.filters.plan.value = '';
  if (dom.filters.rol) dom.filters.rol.value = '';
  if (dom.filters.estado) dom.filters.estado.value = '';
  if (dom.filters.metodo) dom.filters.metodo.value = '';
  if (dom.filters.moneda) dom.filters.moneda.value = '';
  if (dom.filters.region) dom.filters.region.value = '';
  if (dom.filters.fecha) dom.filters.fecha.value = '';
  state.pagination.page = 1;
}

async function loadRules() {
  try {
    const params = {
      ...state.filters,
      page: state.pagination.page,
      per_page: state.pagination.perPage,
    };
    const data = await apiGet('/tarifas', params);
    state.rules = data.items || [];
    state.pagination.total = data.total || 0;
    state.pagination.page = data.page || 1;
    state.pagination.perPage = data.perPage || state.pagination.perPage;
    renderTable();
    renderPagination();
  } catch (error) {
    console.error('Error cargando reglas', error);
    window.alert(error.message || 'No se pudieron cargar las reglas');
  }
}

function renderTable() {
  if (!dom.table.body) return;
  dom.table.body.innerHTML = '';
  if (!state.rules.length) {
    if (dom.table.empty) dom.table.empty.classList.remove('d-none');
    return;
  }
  if (dom.table.empty) dom.table.empty.classList.add('d-none');
  const fragment = document.createDocumentFragment();
  state.rules.forEach((rule) => {
    const row = document.createElement('tr');
    row.dataset.id = rule.id;
    row.innerHTML = `
      <td>
        <div class="fw-semibold">${rule.codigo}</div>
        <div class="text-muted small">${rule.descripcion || ''}</div>
      </td>
      <td>${rule.servicio ? `${rule.servicio.codigo} - ${rule.servicio.nombre}` : 'Todos'}</td>
      <td>${rule.plan ? rule.plan.nombre : 'Todos'}</td>
      <td>${formatRol(rule.rol_aplica)}</td>
      <td>${rule.moneda || (state.catalogs.econconfig?.moneda_defecto || 'N/D')}</td>
      <td>${rule.metodo_pago || 'Todos'}</td>
      <td>${rule.ambito_region || 'Global'}</td>
      <td>${formatTipoCalculo(rule.tipo_calculo)}</td>
      <td>${formatVigencia(rule.vigencia_desde, rule.vigencia_hasta)}</td>
      <td>${rule.prioridad ?? '-'}</td>
   <td>
        <span class="badge ${rule.activo ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">
          ${rule.activo ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="text-end">
        <div class="btn-group btn-group-sm" role="group">
          <button type="button" class="btn btn-outline-primary" data-action="edit" data-id="${rule.id}">Editar</button>
          <button type="button" class="btn btn-outline-primary" data-action="clone" data-id="${rule.id}">Clonar</button>
          <button type="button" class="btn btn-outline-secondary" data-action="toggle" data-id="${rule.id}">${rule.activo ? 'Desactivar' : 'Activar'}</button>
          <button type="button" class="btn btn-outline-secondary" data-action="audit" data-id="${rule.id}">Auditoría</button>
        </div>
      </td>
    `;
    fragment.appendChild(row);
  });
  dom.table.body.appendChild(fragment);
}

function renderPagination() {
    if (!dom.table.pagination) return;
    const { page, perPage, total } = state.pagination;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    dom.table.pagination.innerHTML = '';
    const info = document.createElement('span');
    info.className = 'text-muted small';
    info.textContent = `Página ${Math.min(page, totalPages)} de ${totalPages} (${total} registro${total === 1 ? '' : 's'})`;
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'btn btn-outline-secondary btn-sm';
    prev.textContent = 'Anterior';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => {
      state.pagination.page = Math.max(1, page - 1);
      loadRules();
    });
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn btn-outline-secondary btn-sm';
    next.textContent = 'Siguiente';
    next.disabled = page >= totalPages;
    next.addEventListener('click', () => {
      state.pagination.page = Math.min(totalPages, page + 1);
      loadRules();
    });
    dom.table.pagination.appendChild(prev);
    dom.table.pagination.appendChild(info);
    dom.table.pagination.appendChild(next);
  }

function formatRol(value) {
  switch (value) {
    case 'cliente':
      return 'Cliente';
    case 'abogado':
      return 'Abogado';
    case 'ambos':
      return 'Ambos';
    default:
      return value || '-';
  }
}

function formatTipoCalculo(value) {
  switch (value) {
    case 'fijo':
      return 'Fijo';
    case 'minimo_mas_variable':
      return 'Mínimo + Variable';
    case 'paquete':
      return 'Paquete';
    case 'consumo_ia':
      return 'Consumo IA';
    case 'estacional':
      return 'Estacional';
    default:
      return value || '-';
  }
}

function formatVigencia(desde, hasta) {
  if (!desde && !hasta) return 'Abierta';
  const inicio = desde ? formatDate(desde) : 'Inicio';
  const fin = hasta ? formatDate(hasta) : 'Sin fin';
  return `${inicio} → ${fin}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function applyFilters() {
  state.filters = {
    servicio_id: dom.filters.servicio?.value || '',
    plan_id: dom.filters.plan?.value || '',
    rol_aplica: dom.filters.rol?.value || '',
    activo: dom.filters.estado?.value || '',
    metodo_pago: dom.filters.metodo?.value || '',
    moneda: dom.filters.moneda?.value || '',
    ambito_region: dom.filters.region?.value || '',
    fecha: dom.filters.fecha?.value || '',
  };
  state.pagination.page = 1;
  loadRules();
}

function handleTableAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const id = Number(button.dataset.id);
  if (!id && action !== 'audit') return;
  switch (action) {
    case 'edit':
      openWizard('edit', id);
      break;
    case 'clone':
      openWizard('clone', id);
      break;
    case 'toggle':
      toggleRule(id);
      break;
    case 'audit':
      window.alert('La auditoría de reglas estará disponible próximamente.');
      break;
    default:
      break;
  }
}

async function toggleRule(id) {
  try {
    await apiPost(`/tarifas/${id}/toggle`);
    await loadRules();
  } catch (error) {
    console.error('Error alternando regla', error);
    window.alert(error.message || 'No se pudo alternar el estado de la regla');
  }
}

function toggleWizard(open) {
    if (!dom.wizard.modal) return;
    if (open) {
      state.wizard.open = true;
      if (dom.wizard.modalInstance) {
        dom.wizard.modalInstance.show();
      } else {
        dom.wizard.modal.classList.remove('d-none');
        updateWizardUi();
      }
    } else {
      if (dom.wizard.modalInstance) {
        dom.wizard.modalInstance.hide();
      } else {
        dom.wizard.modal.classList.add('d-none');
        resetWizardFormState();
      }
    }
  }
  
  function resetWizardFormState() {
    state.wizard.open = false;
    state.wizard.step = 1;
    state.wizard.mode = 'create';
    state.wizard.id = null;
    state.wizard.sourceId = null;
    state.wizard.data = createEmptyRule();
    hideConflict();
    if (dom.wizard.form) dom.wizard.form.reset();
    if (dom.wizard.step3Result) dom.wizard.step3Result.innerHTML = '';
    updateWizardUi();
  }

async function openWizard(mode, id) {
  hideConflict();
  state.wizard.mode = mode;
  state.wizard.id = mode === 'edit' ? id : null;
  state.wizard.sourceId = mode === 'clone' ? id : null;
  state.wizard.step = 1;
  try {
    if (mode === 'create') {
      state.wizard.data = createEmptyRule();
    } else {
      const rule = await fetchRule(id);
      if (!rule) throw new Error('No se encontró la regla solicitada');
      state.wizard.data = mapRuleToWizard(rule, mode === 'clone');
    }
    populateWizardForm();
    toggleWizard(true);
  } catch (error) {
    console.error('Error abriendo asistente', error);
    window.alert(error.message || 'No se pudo abrir el asistente');
  }
}

async function fetchRule(id) {
  const existing = state.rules.find((rule) => rule.id === id);
  if (existing && existing.parametros !== undefined) {
    return existing;
  }
  try {
    return await apiGet(`/tarifas/${id}`);
  } catch (error) {
    console.error('Error obteniendo regla', error);
    throw error;
  }
}

function mapRuleToWizard(rule, isClone) {
  return {
    id: isClone ? null : rule.id,
    codigo: isClone ? `${rule.codigo}-COPY` : rule.codigo,
    descripcion: rule.descripcion || '',
    servicio_id: rule.servicio_id ?? '',
    plan_id: rule.plan_id ?? '',
    rol_aplica: rule.rol_aplica || 'cliente',
    moneda: rule.moneda || state.catalogs.econconfig?.moneda_defecto || '',
    metodo_pago: rule.metodo_pago || '',
    ambito_region: rule.ambito_region || '',
    prioridad: rule.prioridad ?? '',
    vigencia_desde: toInputDateTime(rule.vigencia_desde),
    vigencia_hasta: toInputDateTime(rule.vigencia_hasta),
    tipo_calculo: rule.tipo_calculo || 'fijo',
    valor: rule.valor ?? '',
    parametros: rule.parametros || cloneTemplate(rule.tipo_calculo || 'fijo'),
    incluye_impuesto: !!rule.incluye_impuesto,
    activo: rule.activo !== false,
  };
}

function populateWizardForm() {
  const data = state.wizard.data;
  const inputs = dom.wizard.inputs;
  if (!inputs) return;
  dom.wizard.title.textContent =
    state.wizard.mode === 'edit' ? `Editar regla ${data.codigo}` : state.wizard.mode === 'clone' ? 'Clonar regla' : 'Nueva regla';
  inputs.codigo.value = data.codigo || '';
  inputs.servicio.value = data.servicio_id || '';
  inputs.plan.value = data.plan_id || '';
  inputs.rol.value = data.rol_aplica || 'cliente';
  const defaultMoneda = state.catalogs.econconfig?.moneda_defecto || '';
  inputs.moneda.value = data.moneda || defaultMoneda;
  state.wizard.data.moneda = inputs.moneda.value;
  inputs.metodo.value = data.metodo_pago || '';
  inputs.region.value = data.ambito_region || '';
  inputs.prioridad.value = data.prioridad !== '' && data.prioridad !== null ? data.prioridad : '';
  inputs.vigenciaDesde.value = data.vigencia_desde || '';
  inputs.vigenciaHasta.value = data.vigencia_hasta || '';
  inputs.descripcion.value = data.descripcion || '';
  inputs.activo.checked = data.activo !== false;
  inputs.tipoCalculo.value = data.tipo_calculo || 'fijo';
  inputs.valor.value = data.valor !== null && data.valor !== undefined ? data.valor : '';
  inputs.incluyeImpuesto.checked = !!data.incluye_impuesto;
  inputs.parametros.value = JSON.stringify(data.parametros ?? cloneTemplate(inputs.tipoCalculo.value), null, 2);
  inputs.step3Plan.value = data.plan_id || '';
  inputs.step3Metodo.value = data.metodo_pago || '';
  inputs.step3Consumo.value = 0;
  inputs.step3Fecha.value = new Date().toISOString().substring(0, 10);
  handleTipoCalculoChange();
  goToWizardStep(1, true);
}

function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => `${n}`.padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function goToWizardStep(step, force = false) {
  if (!force) {
    if (step > state.wizard.step) {
      if (!validateCurrentStep()) return;
    }
  }
  const nextStep = Math.min(Math.max(step, 1), 3);
  state.wizard.step = nextStep;
  updateWizardUi();
}

function updateWizardUi() {
  const { step } = state.wizard;
  dom.wizard.steps.forEach((pane) => {
    const paneStep = Number(pane.getAttribute('data-tc-step'));
    pane.hidden = paneStep !== step;
  });
  dom.wizard.indicators.forEach((indicator) => {
    const indicatorStep = Number(indicator.getAttribute('data-tc-step-indicator'));
    const isCurrent = indicatorStep === step;
    indicator.classList.toggle('active', isCurrent);
    indicator.classList.toggle('btn-primary', isCurrent);
    indicator.classList.toggle('btn-outline-primary', !isCurrent);    indicator.disabled = indicatorStep > step;
  });
  dom.wizard.prev.hidden = step === 1;
  dom.wizard.next.hidden = step === 3;
  dom.wizard.save.hidden = step !== 3;
}

function validateCurrentStep() {
  switch (state.wizard.step) {
    case 1:
      return captureStep1();
    case 2:
      return captureStep2();
    default:
      return true;
  }
}

function captureStep1() {
  const inputs = dom.wizard.inputs;
  const codigo = inputs.codigo.value.trim();
  if (!codigo) {
    inputs.codigo.setCustomValidity('El código es obligatorio');
    inputs.codigo.reportValidity();
    return false;
  }
  inputs.codigo.setCustomValidity('');
  const desde = inputs.vigenciaDesde.value ? new Date(inputs.vigenciaDesde.value) : null;
  const hasta = inputs.vigenciaHasta.value ? new Date(inputs.vigenciaHasta.value) : null;
  if (desde && hasta && desde > hasta) {
    inputs.vigenciaHasta.setCustomValidity('La vigencia hasta debe ser posterior a la vigencia desde');
    inputs.vigenciaHasta.reportValidity();
    return false;
  }
  inputs.vigenciaHasta.setCustomValidity('');
  const requierePrioridad = needsPriority(
    inputs.servicio.value,
    inputs.plan.value,
    inputs.rol.value,
    inputs.moneda.value,
    inputs.metodo.value,
    inputs.region.value
  );
  if (requierePrioridad && !inputs.prioridad.value) {
    inputs.prioridad.setCustomValidity('Debe asignar una prioridad para reglas con la misma combinación');
    inputs.prioridad.reportValidity();
    return false;
  }
  inputs.prioridad.setCustomValidity('');
  state.wizard.data = {
    ...state.wizard.data,
    codigo,
    descripcion: inputs.descripcion.value.trim(),
    servicio_id: inputs.servicio.value || '',
    plan_id: inputs.plan.value || '',
    rol_aplica: inputs.rol.value,
    moneda: inputs.moneda.value || state.catalogs.econconfig?.moneda_defecto || '',
    metodo_pago: inputs.metodo.value || '',
    ambito_region: inputs.region.value.trim(),
    prioridad: inputs.prioridad.value === '' ? '' : Number(inputs.prioridad.value),
    vigencia_desde: inputs.vigenciaDesde.value || '',
    vigencia_hasta: inputs.vigenciaHasta.value || '',
    incluye_impuesto: inputs.incluyeImpuesto?.checked || false,
    activo: inputs.activo.checked,
  };
  return true;
}

function captureStep2() {
  const inputs = dom.wizard.inputs;
  const tipo = inputs.tipoCalculo.value;
  let parametros;
  try {
    parametros = inputs.parametros.value ? JSON.parse(inputs.parametros.value) : {};
  } catch (error) {
    window.alert('El JSON de parámetros no es válido');
    return false;
  }
  if (tipo === 'estacional' && (!inputs.valor.value || Number(inputs.valor.value) < 0)) {
    inputs.valor.setCustomValidity('Debe establecer un valor base para reglas estacionales');
    inputs.valor.reportValidity();
    return false;
  }
  inputs.valor.setCustomValidity('');
  state.wizard.data = {
    ...state.wizard.data,
    tipo_calculo: tipo,
    valor: inputs.valor.value === '' ? '' : Number(inputs.valor.value),
    parametros,
    incluye_impuesto: inputs.incluyeImpuesto.checked,
  };
  return true;
}

function needsPriority(servicioId, planId, rol, moneda, metodo, region) {
  const comparable = state.rules.filter((rule) => {
    if (!rule.activo) return false;
    if (servicioId && rule.servicio_id !== Number(servicioId)) return false;
    if (!servicioId && rule.servicio_id) return false;
    if (planId && rule.plan_id !== Number(planId)) return false;
    if (!planId && rule.plan_id) return false;
    if (rol && rule.rol_aplica !== rol && rule.rol_aplica !== 'ambos') return false;
    if (moneda && rule.moneda && rule.moneda !== moneda) return false;
    if (metodo && rule.metodo_pago && rule.metodo_pago !== metodo) return false;
    if (region && rule.ambito_region && rule.ambito_region !== region) return false;
    return true;
  });
  return comparable.length > 0;
}

function handleTipoCalculoChange() {
  const tipo = dom.wizard.inputs.tipoCalculo.value;
  const template = cloneTemplate(tipo);
  const current = dom.wizard.inputs.parametros.value.trim();
  if (!current) {
    dom.wizard.inputs.parametros.value = JSON.stringify(template, null, 2);
  }
  const showValor = tipo === 'estacional';
  const valorGroup = dom.wizard.inputs.valor.closest('.form-group');
  if (valorGroup) {
    valorGroup.classList.toggle('d-none', !showValor);
  }}

function cloneTemplate(tipo) {
  const template = state.catalogs.parametrosPlantilla?.[tipo] || PARAM_TEMPLATES[tipo] || {};
  return JSON.parse(JSON.stringify(template));
}

async function saveWizard() {
  if (!captureStep1() || !captureStep2()) return;
  hideConflict();
  try {
    const payload = buildRulePayload(state.wizard.data);
    let response;
    if (state.wizard.mode === 'edit' && state.wizard.id) {
      response = await apiPut(`/tarifas/${state.wizard.id}`, payload);
    } else if (state.wizard.mode === 'clone' && state.wizard.sourceId) {
      response = await apiPost(`/tarifas/${state.wizard.sourceId}/clone`, payload);
    } else {
      response = await apiPost('/tarifas', payload);
    }
    if (response?.success) {
      window.alert('Regla guardada correctamente');
      toggleWizard(false);
      await loadRules();
    }
  } catch (error) {
    if (error.status === 409 && error.response?.conflicts) {
      showConflict(error.response.conflicts, error.response.message);
      return;
    }
    console.error('Error guardando regla', error);
    window.alert(error.message || 'No se pudo guardar la regla');
  }
}

function buildRulePayload(data) {
  return {
    codigo: data.codigo,
    descripcion: data.descripcion || null,
    servicio_id: data.servicio_id ? Number(data.servicio_id) : null,
    plan_id: data.plan_id ? Number(data.plan_id) : null,
    rol_aplica: data.rol_aplica,
    moneda: data.moneda || null,
    metodo_pago: data.metodo_pago || null,
    ambito_region: data.ambito_region || null,
    prioridad: data.prioridad === '' ? null : Number(data.prioridad),
    vigencia_desde: data.vigencia_desde || null,
    vigencia_hasta: data.vigencia_hasta || null,
    tipo_calculo: data.tipo_calculo,
    valor: data.valor === '' ? null : Number(data.valor),
    parametros: data.parametros || {},
    incluye_impuesto: !!data.incluye_impuesto,
    activo: data.activo !== false,
  };
}

function showConflict(conflicts, message) {
  if (!dom.wizard.alert) return;
  dom.wizard.alert.classList.remove('d-none');
  const list = conflicts
    .map((rule) => `<li><strong>${rule.codigo}</strong> — ${formatVigencia(rule.vigencia_desde, rule.vigencia_hasta)}</li>`)
    .join('');
  dom.wizard.alert.innerHTML = `
    <div>${message || 'Existen reglas en conflicto con la combinación seleccionada.'}</div>
    <ul>${list}</ul>
    <p>Revisa la prioridad o ajusta las vigencias para continuar.</p>
  `;
}

function hideConflict() {
  if (!dom.wizard.alert) return;
  dom.wizard.alert.classList.add('d-none');
  dom.wizard.alert.innerHTML = '';
}

async function runPanelSimulation() {
  const body = collectSimulatorInputs();
  try {
    dom.simulator.result.innerHTML = '<p class="text-muted">Calculando...</p>';
    const response = await apiPost('/tarifas/simular', body);
    renderSimulationResult(dom.simulator.result, response);
  } catch (error) {
    if (error.status === 404) {
      dom.simulator.result.innerHTML = '<div class="alert alert-warning">No se encontró una regla aplicable.</div>';
      return;
    }
    console.error('Error simulando', error);
    dom.simulator.result.innerHTML = `<div class="alert alert-danger">${error.message || 'No se pudo simular.'}</div>`;
  }
}

function collectSimulatorInputs() {
  const inputs = dom.simulator.inputs;
  return {
    servicio_id: inputs.servicio.value || null,
    plan_id: inputs.plan.value || null,
    rol_aplica: inputs.rol.value,
    moneda: inputs.moneda.value || state.catalogs.econconfig?.moneda_defecto || null,
    metodo_pago: inputs.metodo.value || null,
    ambito_region: inputs.region.value || null,
    fecha: inputs.fecha.value || new Date().toISOString().substring(0, 10),
    consumo: inputs.consumo.value || 0,
  };
}

async function simulateFromWizard() {
  if (!captureStep1() || !captureStep2()) return;
  const payload = buildRulePayload(state.wizard.data);
  const overrides = {
    servicio_id: payload.servicio_id,
    plan_id: dom.wizard.inputs.step3Plan.value || payload.plan_id,
    rol_aplica: payload.rol_aplica,
    moneda: payload.moneda,
    metodo_pago: dom.wizard.inputs.step3Metodo.value || payload.metodo_pago,
    ambito_region: payload.ambito_region,
    fecha: dom.wizard.inputs.step3Fecha.value || new Date().toISOString().substring(0, 10),
    consumo: dom.wizard.inputs.step3Consumo.value || 0,
    regla_preview: {
      ...payload,
      parametros: payload.parametros,
      codigo: payload.codigo,
      servicio_id: payload.servicio_id,
      plan_id: payload.plan_id,
      activo: payload.activo,
    },
  };
  try {
    dom.wizard.step3Result.innerHTML = '<p class="text-muted">Calculando...</p>';
    const response = await apiPost('/tarifas/simular', overrides);
    renderSimulationResult(dom.wizard.step3Result, response);
  } catch (error) {
    if (error.status === 404) {
      dom.wizard.step3Result.innerHTML = '<div class="alert alert-warning">No se encontró una regla aplicable.</div>';
      return;
    }
    console.error('Error simulando regla', error);
    dom.wizard.step3Result.innerHTML = `<div class="alert alert-danger">${error.message || 'No se pudo simular la regla.'}</div>`;
  }
}

function renderSimulationResult(container, response) {
  if (!response?.success || !response.desglose) {
    container.innerHTML = '<div class="alert alert-warning">No se pudo calcular el desglose.</div>';
    return;
  }
  const { regla, desglose } = response;
  const formatter = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: desglose.moneda || state.catalogs.econconfig?.moneda_defecto || 'PEN',
    minimumFractionDigits: state.catalogs.econconfig?.decimales ?? 2,
  });
  container.innerHTML = `
    <div class="card border-0 shadow-sm">
      <div class="card-body">
        <h6 class="fw-semibold mb-1">Regla aplicada: ${regla.codigo}</h6>
        <p class="text-muted mb-3">${regla.descripcion || 'Sin descripción'}</p>
        <dl class="row gy-2 mb-0">
          <dt class="col-6 col-sm-5">Subtotal</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.subtotal || 0)}</dd>
          <dt class="col-6 col-sm-5">Impuestos</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.impuestos || 0)}</dd>
          <dt class="col-6 col-sm-5">Fee PSP</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.feePsp || 0)}</dd>
          <dt class="col-6 col-sm-5">Total cliente</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.totalCliente || 0)}</dd>
          <dt class="col-6 col-sm-5">Neto abogado</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.netoAbogado || 0)}</dd>
        </dl>
        <p class="text-muted small fst-italic mb-0 mt-3">Redondeo según configuración económica (${state.catalogs.econconfig?.regla_redondeo || 'dos_decimales'}).</p>
      </div>
    </div>
  `;
}


function hydrateSimulatorInputs() {
  const econ = state.catalogs.econconfig;
  if (econ && dom.simulator.inputs.moneda) {
    dom.simulator.inputs.moneda.value = econ.moneda_defecto || '';
  }
}

function toggleSimulator(open) {
    if (!dom.simulator.panel) return;
    state.simulator.open = !!open;
    if (dom.simulator.offcanvasInstance) {
      if (open) {
        dom.simulator.offcanvasInstance.show();
      } else {
        dom.simulator.offcanvasInstance.hide();
      }
    } else {
      dom.simulator.panel.classList.toggle('show', open);
      dom.simulator.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
    }
  }

function createEmptyRule() {
  return {
    codigo: '',
    descripcion: '',
    servicio_id: '',
    plan_id: '',
    rol_aplica: 'cliente',
    moneda: state.catalogs.econconfig?.moneda_defecto || '',
    metodo_pago: '',
    ambito_region: '',
    prioridad: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    tipo_calculo: 'fijo',
    valor: '',
    parametros: cloneTemplate('fijo'),
    incluye_impuesto: false,
    activo: true,
  };
}
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fn.apply(null, args);
      }, delay);
    };
  }
  
  function getBootstrapModal(element) {
    if (!element || !bootstrap?.Modal) return null;
    return bootstrap.Modal.getOrCreateInstance(element);
  }
  
  async function openServiciosModal() {
    await refreshServiciosList();
    resetServicioForm();
    const modal = getBootstrapModal(dom.quickAccess.servicios.modal);
    modal?.show();
  }
  
  async function refreshServiciosList() {
    if (!dom.quickAccess?.servicios) return;
    const search = dom.quickAccess.servicios.search?.value?.trim();
    const estado = dom.quickAccess.servicios.estado?.value || '';
    try {
      const params = {};
      if (search) params.search = search;
      if (estado) params.estado = estado;
      params.orderBy = 'nombre';
      const response = await apiGet('/services', params);
      state.quick.servicios = Array.isArray(response) ? response : response.items || response;
      renderServiciosTable();
    } catch (error) {
      console.error('Error cargando servicios:', error);
      window.alert(error.message || 'No se pudieron cargar los servicios.');
    }
  }
  
  function renderServiciosTable() {
    const body = dom.quickAccess.servicios.tableBody;
    if (!body) return;
    body.innerHTML = '';
    if (!state.quick.servicios.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 5;
      cell.className = 'text-center text-muted py-3';
      cell.textContent = 'No se encontraron servicios con los criterios seleccionados.';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.quick.servicios.forEach((servicio) => {
      const row = document.createElement('tr');
      row.dataset.id = servicio.id;
      if (servicio.id === state.quick.currentServicioId) {
        row.classList.add('is-selected');
      }
      row.innerHTML = `
        <td class="fw-semibold">${servicio.codigo}</td>
        <td>${servicio.nombre}</td>
        <td><span class="badge ${servicio.activo ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">${servicio.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td>${servicio.tienePlanVigente ? 'Sí' : 'No'}</td>
        <td>${servicio.tieneTarifaVigente ? 'Sí' : 'No'}</td>
      `;
      fragment.appendChild(row);
    });
    body.appendChild(fragment);
  }
  
  function handleServicioRowClick(event) {
    const row = event.target.closest('tr[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    const servicio = state.quick.servicios.find((item) => item.id === id);
    if (servicio) {
      populateServicioForm(servicio);
    }
  }
  
  function populateServicioForm(servicio) {
    const inputs = dom.quickAccess.servicios;
    if (!inputs) return;
    state.quick.currentServicioId = servicio.id;
    inputs.id.value = servicio.id;
    inputs.codigo.value = servicio.codigo || '';
    inputs.nombre.value = servicio.nombre || '';
    inputs.descripcion.value = servicio.descripcion || '';
    inputs.activo.checked = servicio.activo !== false;
    dom.quickAccess.servicios.delete.disabled = servicio.activo === false;
    Array.from(dom.quickAccess.servicios.tableBody.querySelectorAll('tr')).forEach((row) => {
      row.classList.toggle('is-selected', Number(row.dataset.id) === servicio.id);
    });
  }
  
  function resetServicioForm() {
    const inputs = dom.quickAccess.servicios;
    if (!inputs) return;
    state.quick.currentServicioId = null;
    if (inputs.form) inputs.form.reset();
    if (inputs.id) inputs.id.value = '';
    if (inputs.activo) inputs.activo.checked = true;
    if (inputs.delete) inputs.delete.disabled = true;
    Array.from(dom.quickAccess.servicios.tableBody?.querySelectorAll('tr') || []).forEach((row) => {
      row.classList.remove('is-selected');
    });
  }
  
  async function submitServicioForm(event) {
    event.preventDefault();
    const inputs = dom.quickAccess.servicios;
    if (!inputs) return;
    const id = inputs.id.value ? Number(inputs.id.value) : null;
    const payload = {
      codigo: inputs.codigo.value.trim(),
      nombre: inputs.nombre.value.trim(),
      descripcion: inputs.descripcion.value.trim(),
      activo: inputs.activo.checked,
    };
    if (!payload.codigo || !payload.nombre) {
      window.alert('Código y nombre son obligatorios.');
      return;
    }
    try {
      if (id) {
        await apiPut(`/services/${id}`, payload);
      } else {
        await apiPost('/services', payload);
      }
      await Promise.all([refreshServiciosList(), loadCatalogs()]);
      window.alert('Servicio guardado correctamente');
      if (id) {
        const updated = state.quick.servicios.find((item) => item.id === id);
        if (updated) {
          populateServicioForm(updated);
        }
      } else {
        resetServicioForm();
      }
    } catch (error) {
      console.error('Error guardando servicio:', error);
      window.alert(error.message || 'No se pudo guardar el servicio.');
    }
  }
  
  async function deactivateServicio() {
    const inputs = dom.quickAccess.servicios;
    if (!inputs?.id?.value) return;
    const id = Number(inputs.id.value);
    if (!id) return;
    const confirmed = window.confirm('¿Desea desactivar este servicio?');
    if (!confirmed) return;
    try {
      await apiDelete(`/services/${id}`);
      await Promise.all([refreshServiciosList(), loadCatalogs()]);
      window.alert('Servicio desactivado correctamente');
      resetServicioForm();
    } catch (error) {
      console.error('Error desactivando servicio:', error);
      window.alert(error.message || 'No se pudo desactivar el servicio.');
    }
  }
  
  async function openImpuestosModal() {
    await refreshImpuestosList();
    resetImpuestoForm();
    const modal = getBootstrapModal(dom.quickAccess.impuestos.modal);
    modal?.show();
  }
  
  async function refreshImpuestosList() {
    if (!dom.quickAccess?.impuestos) return;
    const estado = dom.quickAccess.impuestos.estado?.value || '';
    try {
      const params = {};
      if (estado) params.estado = estado;
      const response = await apiGet('/impuestos', params);
      const items = Array.isArray(response) ? response : response.items || [];
      state.quick.impuestos = items;
      renderImpuestosTable();
    } catch (error) {
      console.error('Error cargando impuestos:', error);
      window.alert(error.message || 'No se pudieron cargar los impuestos.');
    }
  }
  
  function renderImpuestosTable() {
    const body = dom.quickAccess.impuestos.tableBody;
    if (!body) return;
    body.innerHTML = '';
    if (!state.quick.impuestos.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'text-center text-muted py-3';
      cell.textContent = 'No se registran impuestos con los criterios seleccionados.';
      row.appendChild(cell);
      body.appendChild(row);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.quick.impuestos.forEach((imp) => {
      const row = document.createElement('tr');
      row.dataset.id = imp.id;
      if (imp.id === state.quick.currentImpuestoId) {
        row.classList.add('is-selected');
      }
      const porcentaje = Number(imp.porcentaje ?? 0);
      row.innerHTML = `
        <td class="fw-semibold">${imp.codigo}</td>
        <td>${imp.nombre}</td>
        <td>${porcentaje.toFixed(2)}%</td>
        <td>${imp.incluido_en_precio ? 'Sí' : 'No'}</td>
        <td>${formatVigencia(imp.vigencia_desde, imp.vigencia_hasta)}</td>
        <td><span class="badge ${imp.activo ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">${imp.activo ? 'Activo' : 'Inactivo'}</span></td>
      `;
      fragment.appendChild(row);
    });
    body.appendChild(fragment);
  }
  
  function handleImpuestoRowClick(event) {
    const row = event.target.closest('tr[data-id]');
    if (!row) return;
    const id = Number(row.dataset.id);
    const impuesto = state.quick.impuestos.find((item) => item.id === id);
    if (impuesto) {
      populateImpuestoForm(impuesto);
    }
  }
  
  function populateImpuestoForm(impuesto) {
    const inputs = dom.quickAccess.impuestos;
    if (!inputs) return;
    state.quick.currentImpuestoId = impuesto.id;
    inputs.id.value = impuesto.id;
    inputs.codigo.value = impuesto.codigo || '';
    inputs.nombre.value = impuesto.nombre || '';
    inputs.porcentaje.value = Number(impuesto.porcentaje ?? 0);
    inputs.vigenciaDesde.value = impuesto.vigencia_desde ? impuesto.vigencia_desde.substring(0, 10) : '';
    inputs.vigenciaHasta.value = impuesto.vigencia_hasta ? impuesto.vigencia_hasta.substring(0, 10) : '';
    inputs.incluido.checked = !!impuesto.incluido_en_precio;
    inputs.activo.checked = impuesto.activo !== false;
    inputs.delete.disabled = impuesto.activo === false;
    Array.from(dom.quickAccess.impuestos.tableBody.querySelectorAll('tr')).forEach((row) => {
      row.classList.toggle('is-selected', Number(row.dataset.id) === impuesto.id);
    });
  }
  
  function resetImpuestoForm() {
    const inputs = dom.quickAccess.impuestos;
    if (!inputs) return;
    state.quick.currentImpuestoId = null;
    if (inputs.form) inputs.form.reset();
    inputs.id.value = '';
    inputs.activo.checked = true;
    inputs.incluido.checked = false;
    if (inputs.delete) inputs.delete.disabled = true;
    Array.from(dom.quickAccess.impuestos.tableBody?.querySelectorAll('tr') || []).forEach((row) => {
      row.classList.remove('is-selected');
    });
  }
  
  async function submitImpuestoForm(event) {
    event.preventDefault();
    const inputs = dom.quickAccess.impuestos;
    if (!inputs) return;
    const id = inputs.id.value ? Number(inputs.id.value) : null;
    const codigo = inputs.codigo.value.trim();
    const nombre = inputs.nombre.value.trim();
    const porcentaje = inputs.porcentaje.value;
    if (!codigo || !nombre) {
      window.alert('Código y nombre son obligatorios.');
      return;
    }
    if (porcentaje === '' || Number(porcentaje) < 0) {
      window.alert('El porcentaje debe ser mayor o igual a 0.');
      return;
    }
    const payload = {
      codigo,
      nombre,
      porcentaje: Number(porcentaje),
      incluido_en_precio: inputs.incluido.checked,
      activo: inputs.activo.checked,
      vigencia_desde: inputs.vigenciaDesde.value || null,
      vigencia_hasta: inputs.vigenciaHasta.value || null,
    };
    try {
      if (id) {
        await apiPut(`/impuestos/${id}`, payload);
      } else {
        await apiPost('/impuestos', payload);
      }
      await Promise.all([refreshImpuestosList(), loadCatalogs()]);
      window.alert('Impuesto guardado correctamente');
      if (id) {
        const updated = state.quick.impuestos.find((item) => item.id === id);
        if (updated) {
          populateImpuestoForm(updated);
        }
      } else {
        resetImpuestoForm();
      }
    } catch (error) {
      console.error('Error guardando impuesto:', error);
      window.alert(error.message || 'No se pudo guardar el impuesto.');
    }
  }
  
  async function deactivateImpuesto() {
    const inputs = dom.quickAccess.impuestos;
    if (!inputs?.id?.value) return;
    const id = Number(inputs.id.value);
    if (!id) return;
    const confirmed = window.confirm('¿Desea desactivar este impuesto?');
    if (!confirmed) return;
    try {
      await apiDelete(`/impuestos/${id}`);
      await Promise.all([refreshImpuestosList(), loadCatalogs()]);
      window.alert('Impuesto desactivado correctamente');
      resetImpuestoForm();
    } catch (error) {
      console.error('Error desactivando impuesto:', error);
      window.alert(error.message || 'No se pudo desactivar el impuesto.');
    }
  }
  
  async function openEconfigModal() {
    try {
      const response = await apiGet('/econconfig');
      const config = response?.config || response || null;
      state.quick.econconfig = config;
      populateEconfigForm(config);
      const modal = getBootstrapModal(dom.quickAccess.econfig.modal);
      modal?.show();
    } catch (error) {
      console.error('Error obteniendo econconfig:', error);
      window.alert(error.message || 'No se pudo cargar la configuración económica.');
    }
  }
  
  function populateEconfigForm(config) {
    const inputs = dom.quickAccess.econfig;
    if (!inputs) return;
    if (!config) {
      inputs.form.reset();
      inputs.moneda.value = state.catalogs.econconfig?.moneda_defecto || 'PEN';
      inputs.decimales.value = state.catalogs.econconfig?.decimales ?? 2;
      inputs.regla.value = state.catalogs.econconfig?.regla_redondeo || 'dos_decimales';
      inputs.activo.checked = true;
      return;
    }
    inputs.moneda.value = config.moneda_defecto || '';
    inputs.decimales.value = config.decimales ?? 2;
    inputs.regla.value = config.regla_redondeo || 'dos_decimales';
    inputs.activo.checked = config.activo !== false;
  }
  
  async function submitEconfigForm(event) {
    event.preventDefault();
    const inputs = dom.quickAccess.econfig;
    if (!inputs) return;
    const payload = {
      moneda_defecto: inputs.moneda.value.trim().toUpperCase(),
      decimales: Number(inputs.decimales.value),
      regla_redondeo: inputs.regla.value,
      activo: inputs.activo.checked,
    };
    if (!payload.moneda_defecto || payload.moneda_defecto.length !== 3) {
      window.alert('La moneda debe tener 3 caracteres.');
      return;
    }
    if (!Number.isInteger(payload.decimales) || payload.decimales < 0 || payload.decimales > 6) {
      window.alert('Los decimales deben ser un número entre 0 y 6.');
      return;
    }
    try {
      const response = await apiPut('/econconfig', payload);
      const config = response?.config || payload;
      state.catalogs.econconfig = config;
      state.quick.econconfig = config;
      populateCatalogSelects();
      hydrateSimulatorInputs();
      window.alert('Configuración guardada correctamente');
      const modal = getBootstrapModal(dom.quickAccess.econfig.modal);
      modal?.hide();
    } catch (error) {
      console.error('Error guardando econconfig:', error);
      window.alert(error.message || 'No se pudo guardar la configuración.');
    }
  }

  
function exportCsv() {
  if (!state.rules.length) {
    window.alert('No hay reglas para exportar.');
    return;
  }
  const headers = ['Codigo', 'Descripcion', 'Servicio', 'Plan', 'Rol', 'Moneda', 'MetodoPago', 'Region', 'TipoCalculo', 'VigenciaDesde', 'VigenciaHasta', 'Prioridad', 'Activo'];
  const rows = state.rules.map((rule) => [
    rule.codigo,
    (rule.descripcion || '').replace(/"/g, '""'),
    rule.servicio ? rule.servicio.nombre : 'Todos',
    rule.plan ? rule.plan.nombre : 'Todos',
    rule.rol_aplica,
    rule.moneda || state.catalogs.econconfig?.moneda_defecto || '',
    rule.metodo_pago || '*',
    rule.ambito_region || '*',
    rule.tipo_calculo,
    rule.vigencia_desde || '',
    rule.vigencia_hasta || '',
    rule.prioridad ?? '',
    rule.activo ? '1' : '0',
  ]);
  const csv = [headers.join(','), ...rows.map((row) => row.map((value) => `"${value}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tarifas_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
