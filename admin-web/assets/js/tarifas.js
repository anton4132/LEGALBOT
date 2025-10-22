
const API_BASE_URL =
  (typeof window !== 'undefined' && window.LEGALBOT_ADMIN_API_BASE_URL) || '/api';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-PE', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const RELATIVE_UNITS = [
  { limit: 60, divisor: 1, suffix: 's' },
  { limit: 3600, divisor: 60, suffix: 'min' },
  { limit: 86400, divisor: 3600, suffix: 'h' },
  { limit: 604800, divisor: 86400, suffix: 'd' },
  { limit: 2629800, divisor: 604800, suffix: 'sem' },
  { limit: 31557600, divisor: 2629800, suffix: 'mes' },
];

const TARIFA_TIPO_CALCULO_LABEL = {
  fijo: 'Fijo',
  consumo_ia: 'Consumo IA',
};

const CHIP_LABELS = {
  aplicable: 'Aplicable',
  programada: 'Programada',
  expirada: 'Expirada',
  pausada: 'Pausada',
};

const state = {
  ready: false,
  monedaFallback: 'PEN',
  tabs: 'tarifas',
  tarifas: {
    items: [],
    filters: {
      ambito: 'servicio',
      nombreAmbito: '',
      estado: 'activas',
      vigencia: 'hoy',
      vigenciaDesde: '',
      vigenciaHasta: '',
      search: '',
    },
    selection: new Set(),
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  comisiones: {
    items: [],
    filters: {
      ambito: 'servicio',
      nombreAmbito: '',
      rol: '',
      estado: 'activas',
      vigencia: 'hoy',
      vigenciaDesde: '',
      vigenciaHasta: '',
      search: '',
    },
    selection: new Set(),
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  simulator: {
    panelOpen: false,
    loading: false,
    result: null,
    inputs: {
      ambito: 'servicio',
      referencia: '',
      usuarioId: '',
      fecha: new Date().toISOString().slice(0, 10),
      consumo: 0,
    },
  },
  quick: {
    impuestos: [],
    econconfig: null,
  },
  dom: {},
};

/**
 * ------------------------------
 * Inicialización principal
 * ------------------------------
 */

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  bindGlobalEvents();
  await Promise.all([
    loadTarifas(),
    loadComisiones(),
    loadImpuestos(),
    loadEconconfig(),
  ]);
  state.ready = true;
  renderAll();
  setupShortcuts();
}

function cacheDom() {
  const dom = {};

  dom.navTabs = document.querySelectorAll('[data-lb-tab]');
  dom.views = document.querySelectorAll('[data-lb-view]');

  dom.tarifas = {
    tableBody: document.getElementById('tarifas-table-body'),
    empty: document.getElementById('tarifas-empty-state'),
    filters: {
      ambito: document.getElementById('tarifas-filter-ambito'),
      nombre: document.getElementById('tarifas-filter-nombre'),
      estado: document.getElementById('tarifas-filter-estado'),
      vigencia: document.getElementById('tarifas-filter-vigencia'),
      vigenciaDesde: document.getElementById('tarifas-filter-desde'),
      vigenciaHasta: document.getElementById('tarifas-filter-hasta'),
      search: document.getElementById('tarifas-filter-search'),
      reset: document.getElementById('tarifas-filter-reset'),
    },
    paginator: document.getElementById('tarifas-pagination'),
    rowsPerPage: document.getElementById('tarifas-rows-per-page'),
    newButton: document.getElementById('tarifas-new-btn'),
    exportBtn: document.getElementById('tarifas-export-btn'),
    exportSelectionBtn: document.getElementById('tarifas-export-selection-btn'),
    actions: document.getElementById('tarifas-mass-actions'),
    conflictModal: document.getElementById('tarifas-conflict-modal'),
    conflictResolveButtons: document.querySelectorAll(
      '#tarifas-conflict-modal [data-conflict-action]'
    ),
    formModal: document.getElementById('tarifas-form-modal'),
    form: document.getElementById('tarifas-form'),
  };

  dom.comisiones = {
    tableBody: document.getElementById('comisiones-table-body'),
    empty: document.getElementById('comisiones-empty-state'),
    filters: {
      ambito: document.getElementById('comisiones-filter-ambito'),
      nombre: document.getElementById('comisiones-filter-nombre'),
      rol: document.getElementById('comisiones-filter-rol'),
      estado: document.getElementById('comisiones-filter-estado'),
      vigencia: document.getElementById('comisiones-filter-vigencia'),
      vigenciaDesde: document.getElementById('comisiones-filter-desde'),
      vigenciaHasta: document.getElementById('comisiones-filter-hasta'),
      search: document.getElementById('comisiones-filter-search'),
      reset: document.getElementById('comisiones-filter-reset'),
    },
    paginator: document.getElementById('comisiones-pagination'),
    rowsPerPage: document.getElementById('comisiones-rows-per-page'),
    newButton: document.getElementById('comisiones-new-btn'),
    exportBtn: document.getElementById('comisiones-export-btn'),
    exportSelectionBtn: document.getElementById('comisiones-export-selection-btn'),
    actions: document.getElementById('comisiones-mass-actions'),
    conflictModal: document.getElementById('comisiones-conflict-modal'),
    conflictResolveButtons: document.querySelectorAll(
      '#comisiones-conflict-modal [data-conflict-action]'
    ),
    formModal: document.getElementById('comisiones-form-modal'),
    form: document.getElementById('comisiones-form'),
  };

  dom.simulator = {
    toggle: document.getElementById('simulator-toggle'),
    close: document.getElementById('simulator-close'),
    panel: document.getElementById('simulator-panel'),
    form: document.getElementById('simulator-form'),
    result: document.getElementById('simulator-result'),
    loading: document.getElementById('simulator-loading'),
  };

  dom.helpBanner = document.getElementById('tarifas-help-banner');

  dom.impuestos = {
    tableBody: document.getElementById('tc-impuestos-table-body'),
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
    historyModal: document.getElementById('tc-impuestos-history-modal'),
    historyContent: document.getElementById('tc-impuestos-history-content'),
  };

  dom.econconfig = {
    form: document.getElementById('tc-econfig-form'),
    moneda: document.getElementById('tc-econfig-moneda'),
    decimales: document.getElementById('tc-econfig-decimales'),
    regla: document.getElementById('tc-econfig-regla'),
    activo: document.getElementById('tc-econfig-activo'),
    previewInput: document.getElementById('tc-econfig-preview'),
    previewResult: document.getElementById('tc-econfig-preview-result'),
    updatedLabel: document.getElementById('tc-econfig-actualizado'),
  };

  state.dom = dom;
}

function bindGlobalEvents() {
  const { dom } = state;

  dom.navTabs.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      event.preventDefault();
      const nextTab = tab.getAttribute('data-lb-tab');
      if (nextTab && nextTab !== state.tabs) {
        state.tabs = nextTab;
        renderTabs();
      }
    });
  });

  bindTarifasEvents();
  bindComisionesEvents();
  bindSimulatorEvents();
  bindImpuestosEvents();
  bindEconconfigEvents();
}

function renderAll() {
  renderTabs();
  renderTarifas();
  renderComisiones();
  renderHelpBanner();
  renderSimulator();
  renderImpuestosTable();
  renderImpuestoForm();
  renderEconconfig();
}

function renderTabs() {
  const { dom } = state;
  dom.navTabs.forEach((tab) => {
    const name = tab.getAttribute('data-lb-tab');
    const active = name === state.tabs;
    tab.classList.toggle('active', active);
  });

  dom.views.forEach((view) => {
    const name = view.getAttribute('data-lb-view');
    view.classList.toggle('d-none', name !== state.tabs);
  });
}

function renderHelpBanner() {
  const banner = state.dom.helpBanner;
  if (!banner) return;
  banner.innerHTML = `
    <div class="alert alert-info d-flex flex-column flex-lg-row align-items-lg-center gap-3">
      <div>
        <strong>Prioridad:</strong> Plan &gt; Servicio. Impuestos incluidos se
        desglosan automáticamente. Redondeo según
        <code>${state.quick.econconfig?.regla_redondeo || 'dos_decimales'}</code>.
      </div>
      <div class="ms-lg-auto">
        <span class="me-3">Auditoría disponible en cada fila.</span>
        <a href="#" class="btn btn-sm btn-outline-secondary" data-lb-help="auditoria">
          Ver documentación
        </a>
      </div>
    </div>
  `;
}



/**
 * ------------------------------
 * Tarifa helpers y renderizado
 * ------------------------------
 */

function bindTarifasEvents() {
  const { tarifas } = state.dom;
  if (!tarifas) return;

  Object.entries(tarifas.filters).forEach(([key, input]) => {
    if (!input) return;
    if (key === 'reset') {
      input.addEventListener('click', () => {
        resetTarifaFilters();
        renderTarifas();
      });
    } else {
      const handler = key === 'nombre' || key === 'search' ? 'input' : 'change';
      input.addEventListener(handler, () => {
        updateTarifaFilter(key, input.value);
      });
    }
  });

  tarifas.rowsPerPage?.addEventListener('change', () => {
    const perPage = Number(tarifas.rowsPerPage.value) || 10;
    state.tarifas.paginator.perPage = perPage;
    state.tarifas.paginator.page = 1;
    renderTarifas();
  });

  tarifas.newButton?.addEventListener('click', () => {
    openTarifaForm('create');
  });

  tarifas.exportBtn?.addEventListener('click', () => exportTarifas(false));
  tarifas.exportSelectionBtn?.addEventListener('click', () => exportTarifas(true));

  tarifas.actions?.addEventListener('change', handleTarifaMassAction);

  if (tarifas.tableBody) {
    tarifas.tableBody.addEventListener('click', handleTarifasTableClick);
    tarifas.tableBody.addEventListener('change', handleTarifasTableChange);
  }

  if (tarifas.form) {
    tarifas.form.addEventListener('submit', submitTarifaForm);
    tarifas.form
      .querySelectorAll('[name="tipo_calculo"],[name="incluye_impuesto"],[name="ambito"]')
      .forEach((field) => field.addEventListener('change', updateTarifaFormUi));
    const jsonField = tarifas.form.querySelector('[name="parametros"]');
    jsonField?.addEventListener('input', () => validateJsonField(jsonField));
  }

  state.dom.tarifas.conflictResolveButtons.forEach((btn) =>
    btn.addEventListener('click', () => resolveTarifaConflict(btn.dataset.conflictAction))
  );
}

function renderTarifas() {
  const { items } = state.tarifas;
  const filtered = applyTarifaFilters(items);
  const sorted = sortByDefaultOrder(filtered);
  const paginated = paginate(sorted, state.tarifas.paginator);
  state.tarifas.paginator.total = filtered.length;

  const body = state.dom.tarifas.tableBody;
  const empty = state.dom.tarifas.empty;

  if (!body) return;
  body.innerHTML = '';

  if (!paginated.length) {
    empty?.classList.remove('d-none');
    body.classList.add('d-none');
    return;
  }

  empty?.classList.add('d-none');
  body.classList.remove('d-none');

  paginated.forEach((tarifa) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarifa.id;
    tr.innerHTML = tarifaRowTemplate(tarifa);
    body.appendChild(tr);
    attachRelativeTooltip(tr.querySelector('[data-updated]'), tarifa.actualizado_el);
  });

  renderTarifaPagination();
  renderTarifaMassActions();
}

function tarifaRowTemplate(tarifa) {
  const badge = tarifa.incluye_impuesto
    ? '<span class="badge bg-success ms-2">Incluye IGV</span>'
    : '';
  const chip = statusChip(tarifa);
  return `
    <td class="text-muted">${checkboxCell(tarifa.id)}</td>
    <td><div class="fw-semibold">${tarifa.codigo}</div><div class="small text-muted">${chip}</div></td>
    <td>
      <div class="fw-semibold">${ambitoLabel(tarifa)}</div>
      <div class="small text-muted">${tarifa.ambito === 'plan' ? 'Plan' : 'Servicio'}</div>
    </td>
    <td>
      <span>${formatCurrency(tarifa.valor, tarifa.moneda)}</span>
      ${badge}
    </td>
    <td>${TARIFA_TIPO_CALCULO_LABEL[tarifa.tipo_calculo] || tarifa.tipo_calculo}</td>
    <td>${vigenciaLabel(tarifa.vigencia_desde, tarifa.vigencia_hasta)}</td>
    <td>
      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" data-toggle="tarifa" ${
          tarifa.activo ? 'checked' : ''
        }>
      </div>
    </td>
    <td>
      <span data-updated class="text-muted small" title="${formatExactDate(
        tarifa.actualizado_el
      )}">${formatRelative(tarifa.actualizado_el)}</span>
    </td>
    <td class="text-end">
      <div class="btn-group btn-group-sm" role="group">
        <button type="button" class="btn btn-outline-primary" data-action="edit">Editar</button>
        <button type="button" class="btn btn-outline-secondary" data-action="audit">Ver cambios</button>
      </div>
    </td>
  `;
}

function applyTarifaFilters(items) {
  const { filters } = state.tarifas;
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((item) => {
    if (filters.ambito && item.ambito !== filters.ambito) return false;
    if (filters.nombre && !matchesAutocomplete(item, filters.nombre)) return false;
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!`${item.codigo} ${item.nombre_ambito}`.toLowerCase().includes(search)) return false;
    }
    if (filters.vigencia === 'hoy' && !isVigenteHoy(item, today)) return false;
    if (filters.vigencia === 'rango') {
      if (!overlapsRange(item, filters.vigenciaDesde, filters.vigenciaHasta)) return false;
    }
    return true;
  });
}

function resetTarifaFilters() {
  state.tarifas.filters = {
    ambito: 'servicio',
    nombreAmbito: '',
    estado: 'activas',
    vigencia: 'hoy',
    vigenciaDesde: '',
    vigenciaHasta: '',
    search: '',
  };
  const { filters } = state.dom.tarifas;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset') return;
    input.value = state.tarifas.filters[key] || '';
  });
}

function updateTarifaFilter(key, value) {
  state.tarifas.filters[key] = value;
  if (key !== 'search') {
    state.tarifas.paginator.page = 1;
  }
  renderTarifas();
}

function renderTarifaPagination() {
  const container = state.dom.tarifas.paginator;
  if (!container) return;
  container.innerHTML = paginationTemplate(state.tarifas.paginator);
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const page = Number(btn.getAttribute('data-page'));
      if (!Number.isNaN(page)) {
        state.tarifas.paginator.page = page;
        renderTarifas();
      }
    });
  });
}

function renderTarifaMassActions() {
  const select = state.dom.tarifas.actions;
  if (!select) return;
  select.disabled = state.tarifas.selection.size === 0;
  select.value = '';
}

function handleTarifasTableClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('button[data-action="edit"]')) {
    openTarifaForm('edit', id);
  } else if (event.target.matches('button[data-action="audit"]')) {
    openAuditoria('tarifas', id);
  } else if (event.target.matches('input[type="checkbox"][data-select]')) {
    toggleTarifaSelection(id, event.target.checked);
  }
}

function handleTarifasTableChange(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('input[data-toggle="tarifa"]')) {
    event.preventDefault();
    attemptToggleTarifa(id, event.target.checked);
  }
}

function toggleTarifaSelection(id, checked) {
  if (checked) {
    state.tarifas.selection.add(id);
  } else {
    state.tarifas.selection.delete(id);
  }
  renderTarifaMassActions();
}

function handleTarifaMassAction(event) {
  const action = event.target.value;
  if (!action) return;
  const ids = Array.from(state.tarifas.selection);
  switch (action) {
    case 'activar':
    case 'desactivar':
      bulkToggleTarifas(ids, action === 'activar');
      break;
    case 'cerrar':
      bulkCloseTarifas(ids);
      break;
    case 'exportar':
      exportTarifas(true);
      break;
    default:
      break;
  }
  event.target.value = '';
}

function openTarifaForm(mode, id) {
  const form = state.dom.tarifas.form;
  const modalElement = state.dom.tarifas.formModal;
  if (!form || !modalElement) return;
  const modal = getBootstrapModal(modalElement);

  state.tarifas.form.mode = mode;
  state.tarifas.form.data =
    mode === 'edit' ? state.tarifas.items.find((item) => item.id === id) : null;

  populateTarifaForm();
  modal.show();
}

function populateTarifaForm() {
  const { form, formModal } = state.dom.tarifas;
  if (!form) return;
  const data = state.tarifas.form.data || getDefaultTarifa();
  form.querySelector('[name="codigo"]').value = data.codigo || '';
  form.querySelector('[name="ambito"]').value = data.ambito || 'servicio';
  form.querySelector('[name="referencia_id"]').value = data.referencia_id || '';
  form.querySelector('[name="valor"]').value = (data.valor ?? '').toString();
  form.querySelector('[name="moneda"]').value = data.moneda || state.monedaFallback;
  form.querySelector('[name="incluye_impuesto"]').checked = !!data.incluye_impuesto;
  form.querySelector('[name="tipo_calculo"]').value = data.tipo_calculo || 'fijo';
  form.querySelector('[name="parametros"]').value = JSON.stringify(
    data.parametros || {},
    null,
    2
  );
  form.querySelector('[name="vigencia_desde"]').value = data.vigencia_desde || '';
  form.querySelector('[name="vigencia_hasta"]').value = data.vigencia_hasta || '';
  form.querySelector('[name="activo"]').checked = data.activo !== false;
  form.querySelector('[name="actualizado_el"]').value = data.actualizado_el || '';

  updateTarifaFormUi();

  const title = formModal?.querySelector('[data-modal-title]');
  if (title) {
    title.textContent =
      state.tarifas.form.mode === 'edit' ? 'Editar tarifa' : 'Nueva tarifa';
  }
}

function updateTarifaFormUi() {
  const form = state.dom.tarifas.form;
  if (!form) return;
  const tipo = form.querySelector('[name="tipo_calculo"]').value;
  const jsonGroup = form.querySelector('[data-json-group]');
  if (jsonGroup) {
    jsonGroup.classList.toggle('d-none', tipo !== 'consumo_ia');
  }
}

function validateJsonField(field) {
  if (!field) return true;
  try {
    const value = field.value.trim();
    if (!value) return true;
    const parsed = JSON.parse(value);
    const valid = typeof parsed === 'object' && parsed !== null;
    field.classList.toggle('is-invalid', !valid);
    return valid;
  } catch (error) {
    field.classList.add('is-invalid');
    return false;
  }
}

async function submitTarifaForm(event) {
  event.preventDefault();
  const form = event.target;
  const jsonField = form.querySelector('[name="parametros"]');
  if (!validateJsonField(jsonField)) return;

  const payload = {
    codigo: form.codigo.value.trim(),
    ambito: form.ambito.value,
    referencia_id: form.referencia_id.value || null,
    valor: Number(form.valor.value),
    moneda: form.moneda.value || state.monedaFallback,
    incluye_impuesto: form.incluye_impuesto.checked,
    tipo_calculo: form.tipo_calculo.value,
    parametros: jsonField.value ? JSON.parse(jsonField.value) : {},
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
    activo: form.activo.checked,
    actualizado_el: form.actualizado_el.value || null,
  };

  if (!Number.isFinite(payload.valor) || payload.valor < 0) {
    form.valor.classList.add('is-invalid');
    return;
  }
  form.valor.classList.remove('is-invalid');

  const conflict = findTarifaConflict(payload, state.tarifas.form.data?.id);
  if (conflict) {
    showTarifaConflictModal(conflict, payload);
    return;
  }

  await persistTarifa(payload, state.tarifas.form);
}


async function persistTarifa(payload, formState) {
  try {
    const id = formState.data?.id;
    let response;
    if (id) {
      response = await apiPut(`/tarifas/${id}`, payload, {
        'If-Unmodified-Since': payload.actualizado_el || '',
      });
    } else {
      response = await apiPost('/tarifas', payload);
    }
    const saved = await response.json();
    upsertTarifa(saved);
    state.dom.tarifas.form.reset();
    getBootstrapModal(state.dom.tarifas.formModal).hide();
    renderTarifas();
  } catch (error) {
    console.error('Error guardando tarifa', error);
    window.alert(error.message || 'No se pudo guardar la tarifa.');
  }
}

function upsertTarifa(tarifa) {
  const index = state.tarifas.items.findIndex((item) => item.id === tarifa.id);
  if (index >= 0) {
    state.tarifas.items.splice(index, 1, tarifa);
  } else {
    state.tarifas.items.push(tarifa);
  }
}

function findTarifaConflict(tarifa, ignoreId) {
  return state.tarifas.items.find((item) => {
    if (item.id === ignoreId) return false;
    if (item.ambito !== tarifa.ambito) return false;
    if (item.referencia_id !== tarifa.referencia_id) return false;
    if (!item.activo || !tarifa.activo) return false;
    return rangesOverlap(
      item.vigencia_desde,
      item.vigencia_hasta,
      tarifa.vigencia_desde,
      tarifa.vigencia_hasta
    );
  });
}

function showTarifaConflictModal(conflict, payload) {
  const modal = getBootstrapModal(state.dom.tarifas.conflictModal);
  if (!modal) return;
  modal.relatedPayload = payload;
  modal.relatedConflict = conflict;
  modal.show();
}

async function resolveTarifaConflict(action) {
  const modalElement = state.dom.tarifas.conflictModal;
  const modal = getBootstrapModal(modalElement);
  const payload = modal?.relatedPayload;
  const conflict = modal?.relatedConflict;
  if (!modal || !payload || !conflict) return;

  modal.hide();

  if (action === 'cancelar') return;

  try {
    if (action === 'desactivar') {
      await apiPatch(`/tarifas/${conflict.id}`, { activo: false });
      conflict.activo = false;
    } else if (action === 'cerrar') {
      const fecha = new Date(payload.vigencia_desde);
      fecha.setDate(fecha.getDate() - 1);
      const cierre = fecha.toISOString().slice(0, 10);
      await apiPatch(`/tarifas/${conflict.id}`, { vigencia_hasta: cierre });
      conflict.vigencia_hasta = cierre;
    }
    await persistTarifa(payload, state.tarifas.form);
  } catch (error) {
    console.error('Error resolviendo conflicto', error);
    window.alert('No se pudo resolver el conflicto.');
  }
}

async function attemptToggleTarifa(id, nextState) {
  const tarifa = state.tarifas.items.find((item) => item.id === id);
  if (!tarifa) return;
  if (nextState) {
    const conflict = findTarifaConflict({ ...tarifa, activo: true }, id);
    if (conflict) {
      showTarifaConflictModal(conflict, { ...tarifa, activo: true });
      renderTarifas();
      return;
    }
  }
  try {
    await apiPatch(`/tarifas/${id}`, { activo: nextState });
    tarifa.activo = nextState;
    renderTarifas();
  } catch (error) {
    console.error('Error cambiando estado', error);
    window.alert('No se pudo actualizar la tarifa.');
  }
}

async function bulkToggleTarifas(ids, nextState) {
  await Promise.all(ids.map((id) => apiPatch(`/tarifas/${id}`, { activo: nextState })));
  state.tarifas.items.forEach((item) => {
    if (ids.includes(item.id)) item.activo = nextState;
  });
  state.tarifas.selection.clear();
  renderTarifas();
}

async function bulkCloseTarifas(ids) {
  const cierre = prompt('Cerrar vigencia al (YYYY-MM-DD):');
  if (!cierre) return;
  await Promise.all(ids.map((id) => apiPatch(`/tarifas/${id}`, { vigencia_hasta: cierre })));
  state.tarifas.items.forEach((item) => {
    if (ids.includes(item.id)) item.vigencia_hasta = cierre;
  });
  state.tarifas.selection.clear();
  renderTarifas();
}

function exportTarifas(selectionOnly) {
  const ids = selectionOnly ? Array.from(state.tarifas.selection) : [];
  const params = new URLSearchParams({ ...state.tarifas.filters });
  if (selectionOnly && ids.length) {
    params.set('ids', ids.join(','));
  }
  const url = `${API_BASE_URL}/tarifas/export?${params.toString()}`;
  window.open(url, '_blank');
}


/**
 * ------------------------------
 * Comisiones helpers y renderizado
 * ------------------------------
 */

function bindComisionesEvents() {
  const { comisiones } = state.dom;
  if (!comisiones) return;

  Object.entries(comisiones.filters).forEach(([key, input]) => {
    if (!input) return;
    if (key === 'reset') {
      input.addEventListener('click', () => {
        resetComisionFilters();
        renderComisiones();
      });
    } else {
      const handler = key === 'nombre' || key === 'search' ? 'input' : 'change';
      input.addEventListener(handler, () => updateComisionFilter(key, input.value));
    }
  });

  comisiones.rowsPerPage?.addEventListener('change', () => {
    state.comisiones.paginator.perPage = Number(comisiones.rowsPerPage.value) || 10;
    state.comisiones.paginator.page = 1;
    renderComisiones();
  });

  comisiones.newButton?.addEventListener('click', () => openComisionForm('create'));
  comisiones.exportBtn?.addEventListener('click', () => exportComisiones(false));
  comisiones.exportSelectionBtn?.addEventListener('click', () => exportComisiones(true));
  comisiones.actions?.addEventListener('change', handleComisionMassAction);

  if (comisiones.tableBody) {
    comisiones.tableBody.addEventListener('click', handleComisionesTableClick);
    comisiones.tableBody.addEventListener('change', handleComisionesTableChange);
  }

  if (comisiones.form) {
    comisiones.form.addEventListener('submit', submitComisionForm);
  }

  state.dom.comisiones.conflictResolveButtons.forEach((btn) =>
    btn.addEventListener('click', () => resolveComisionConflict(btn.dataset.conflictAction))
  );
}

function renderComisiones() {
  const filtered = applyComisionFilters(state.comisiones.items);
  const sorted = sortByDefaultOrder(filtered);
  const paginated = paginate(sorted, state.comisiones.paginator);
  state.comisiones.paginator.total = filtered.length;

  const body = state.dom.comisiones.tableBody;
  const empty = state.dom.comisiones.empty;
  if (!body) return;
  body.innerHTML = '';

  if (!paginated.length) {
    empty?.classList.remove('d-none');
    body.classList.add('d-none');
    return;
  }

  empty?.classList.add('d-none');
  body.classList.remove('d-none');

  paginated.forEach((comision) => {
    const tr = document.createElement('tr');
    tr.dataset.id = comision.id;
    tr.innerHTML = comisionRowTemplate(comision);
    body.appendChild(tr);
    attachRelativeTooltip(tr.querySelector('[data-updated]'), comision.actualizado_el);
  });

  renderComisionPagination();
  renderComisionMassActions();
}

function comisionRowTemplate(comision) {
  const chip = statusChip(comision);
  const rolBadge = `<span class="badge bg-primary">${
    comision.rol_aplica === 'abogado' ? 'Abogado' : 'Cliente'
  }</span>`;
  return `
    <td class="text-muted">${checkboxCell(comision.id)}</td>
    <td><div class="fw-semibold">${comision.codigo}</div><div class="small text-muted">${chip}</div></td>
    <td>
      <div class="fw-semibold">${ambitoLabel(comision)}</div>
      <div class="small text-muted">${comision.ambito === 'plan' ? 'Plan' : 'Servicio'}</div>
    </td>
    <td>${rolBadge}</td>
    <td>${formatPercentage(comision.porcentaje)}</td>
    <td>${vigenciaLabel(comision.vigencia_desde, comision.vigencia_hasta)}</td>
    <td>
      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" data-toggle="comision" ${
          comision.activo ? 'checked' : ''
        }>
      </div>
    </td>
    <td>
      <span data-updated class="text-muted small" title="${formatExactDate(
        comision.actualizado_el
      )}">${formatRelative(comision.actualizado_el)}</span>
    </td>
    <td class="text-end">
      <div class="btn-group btn-group-sm" role="group">
        <button type="button" class="btn btn-outline-primary" data-action="edit">Editar</button>
        <button type="button" class="btn btn-outline-secondary" data-action="audit">Ver cambios</button>
      </div>
    </td>
  `;
}

function applyComisionFilters(items) {
  const { filters } = state.comisiones;
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((item) => {
    if (filters.ambito && item.ambito !== filters.ambito) return false;
    if (filters.rol && item.rol_aplica !== filters.rol) return false;
    if (filters.nombre && !matchesAutocomplete(item, filters.nombre)) return false;
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!`${item.codigo} ${item.nombre_ambito}`.toLowerCase().includes(search)) return false;
    }
    if (filters.vigencia === 'hoy' && !isVigenteHoy(item, today)) return false;
    if (filters.vigencia === 'rango') {
      if (!overlapsRange(item, filters.vigenciaDesde, filters.vigenciaHasta)) return false;
    }
    return true;
  });
}

function resetComisionFilters() {
  state.comisiones.filters = {
    ambito: 'servicio',
    nombreAmbito: '',
    rol: '',
    estado: 'activas',
    vigencia: 'hoy',
    vigenciaDesde: '',
    vigenciaHasta: '',
    search: '',
  };
  const { filters } = state.dom.comisiones;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset') return;
    input.value = state.comisiones.filters[key] || '';
  });
}

function updateComisionFilter(key, value) {
  state.comisiones.filters[key] = value;
  if (key !== 'search') {
    state.comisiones.paginator.page = 1;
  }
  renderComisiones();
}

function renderComisionPagination() {
  const container = state.dom.comisiones.paginator;
  if (!container) return;
  container.innerHTML = paginationTemplate(state.comisiones.paginator);
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const page = Number(btn.getAttribute('data-page'));
      if (!Number.isNaN(page)) {
        state.comisiones.paginator.page = page;
        renderComisiones();
      }
    });
  });
}

function renderComisionMassActions() {
  const select = state.dom.comisiones.actions;
  if (!select) return;
  select.disabled = state.comisiones.selection.size === 0;
  select.value = '';
}

function handleComisionesTableClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('button[data-action="edit"]')) {
    openComisionForm('edit', id);
  } else if (event.target.matches('button[data-action="audit"]')) {
    openAuditoria('comisiones', id);
  } else if (event.target.matches('input[type="checkbox"][data-select]')) {
    toggleComisionSelection(id, event.target.checked);
  }
}

function handleComisionesTableChange(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('input[data-toggle="comision"]')) {
    event.preventDefault();
    attemptToggleComision(id, event.target.checked);
  }
}

function toggleComisionSelection(id, checked) {
  if (checked) {
    state.comisiones.selection.add(id);
  } else {
    state.comisiones.selection.delete(id);
  }
  renderComisionMassActions();
}

function handleComisionMassAction(event) {
  const action = event.target.value;
  if (!action) return;
  const ids = Array.from(state.comisiones.selection);
  switch (action) {
    case 'activar':
    case 'desactivar':
      bulkToggleComisiones(ids, action === 'activar');
      break;
    case 'cerrar':
      bulkCloseComisiones(ids);
      break;
    case 'exportar':
      exportComisiones(true);
      break;
    default:
      break;
  }
  event.target.value = '';
}

function openComisionForm(mode, id) {
  const form = state.dom.comisiones.form;
  const modalElement = state.dom.comisiones.formModal;
  if (!form || !modalElement) return;
  const modal = getBootstrapModal(modalElement);

  state.comisiones.form.mode = mode;
  state.comisiones.form.data =
    mode === 'edit' ? state.comisiones.items.find((item) => item.id === id) : null;

  populateComisionForm();
  modal.show();
}

function populateComisionForm() {
  const { form, formModal } = state.dom.comisiones;
  if (!form) return;
  const data = state.comisiones.form.data || getDefaultComision();
  form.querySelector('[name="codigo"]').value = data.codigo || '';
  form.querySelector('[name="ambito"]').value = data.ambito || 'servicio';
  form.querySelector('[name="referencia_id"]').value = data.referencia_id || '';
  form.querySelector('[name="rol_aplica"]').value = data.rol_aplica || 'cliente';
  form.querySelector('[name="porcentaje"]').value = (data.porcentaje ?? '').toString();
  form.querySelector('[name="vigencia_desde"]').value = data.vigencia_desde || '';
  form.querySelector('[name="vigencia_hasta"]').value = data.vigencia_hasta || '';
  form.querySelector('[name="activo"]').checked = data.activo !== false;
  form.querySelector('[name="actualizado_el"]').value = data.actualizado_el || '';

  const title = formModal?.querySelector('[data-modal-title]');
  if (title) {
    title.textContent =
      state.comisiones.form.mode === 'edit' ? 'Editar comisión' : 'Nueva comisión';
  }
}

async function submitComisionForm(event) {
  event.preventDefault();
  const form = event.target;
  const porcentaje = Number(form.porcentaje.value);
  if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
    form.porcentaje.classList.add('is-invalid');
    return;
  }
  form.porcentaje.classList.remove('is-invalid');

  const payload = {
    codigo: form.codigo.value.trim(),
    ambito: form.ambito.value,
    referencia_id: form.referencia_id.value || null,
    rol_aplica: form.rol_aplica.value,
    porcentaje,
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
    activo: form.activo.checked,
    actualizado_el: form.actualizado_el.value || null,
  };

  const conflict = findComisionConflict(payload, state.comisiones.form.data?.id);
  if (conflict) {
    showComisionConflictModal(conflict, payload);
    return;
  }

  await persistComision(payload, state.comisiones.form);
}


function findComisionConflict(comision, ignoreId) {
  return state.comisiones.items.find((item) => {
    if (item.id === ignoreId) return false;
    if (item.ambito !== comision.ambito) return false;
    if (item.referencia_id !== comision.referencia_id) return false;
    if (item.rol_aplica !== comision.rol_aplica) return false;
    if (!item.activo || !comision.activo) return false;
    return rangesOverlap(
      item.vigencia_desde,
      item.vigencia_hasta,
      comision.vigencia_desde,
      comision.vigencia_hasta
    );
  });
}

function showComisionConflictModal(conflict, payload) {
  const modal = getBootstrapModal(state.dom.comisiones.conflictModal);
  if (!modal) return;
  modal.relatedPayload = payload;
  modal.relatedConflict = conflict;
  modal.show();
}

async function resolveComisionConflict(action) {
  const modalElement = state.dom.comisiones.conflictModal;
  const modal = getBootstrapModal(modalElement);
  const payload = modal?.relatedPayload;
  const conflict = modal?.relatedConflict;
  if (!modal || !payload || !conflict) return;

  modal.hide();
  if (action === 'cancelar') return;

  try {
    if (action === 'desactivar') {
      await apiPatch(`/comisiones/${conflict.id}`, { activo: false });
      conflict.activo = false;
    } else if (action === 'cerrar') {
      const fecha = new Date(payload.vigencia_desde);
      fecha.setDate(fecha.getDate() - 1);
      const cierre = fecha.toISOString().slice(0, 10);
      await apiPatch(`/comisiones/${conflict.id}`, { vigencia_hasta: cierre });
      conflict.vigencia_hasta = cierre;
    }
    await persistComision(payload, state.comisiones.form);
  } catch (error) {
    console.error('Error resolviendo conflicto', error);
    window.alert('No se pudo resolver el conflicto.');
  }
}

async function persistComision(payload, formState) {
  try {
    const id = formState.data?.id;
    let response;
    if (id) {
      response = await apiPut(`/comisiones/${id}`, payload, {
        'If-Unmodified-Since': payload.actualizado_el || '',
      });
    } else {
      response = await apiPost('/comisiones', payload);
    }
    const saved = await response.json();
    upsertComision(saved);
    state.dom.comisiones.form.reset();
    getBootstrapModal(state.dom.comisiones.formModal).hide();
    renderComisiones();
  } catch (error) {
    console.error('Error guardando comisión', error);
    window.alert(error.message || 'No se pudo guardar la comisión.');
  }
}

function upsertComision(comision) {
  const index = state.comisiones.items.findIndex((item) => item.id === comision.id);
  if (index >= 0) {
    state.comisiones.items.splice(index, 1, comision);
  } else {
    state.comisiones.items.push(comision);
  }
}

async function attemptToggleComision(id, nextState) {
  const comision = state.comisiones.items.find((item) => item.id === id);
  if (!comision) return;
  if (nextState) {
    const conflict = findComisionConflict({ ...comision, activo: true }, id);
    if (conflict) {
      showComisionConflictModal(conflict, { ...comision, activo: true });
      renderComisiones();
      return;
    }
  }
  try {
    await apiPatch(`/comisiones/${id}`, { activo: nextState });
    comision.activo = nextState;
    renderComisiones();
  } catch (error) {
    console.error('Error cambiando estado', error);
    window.alert('No se pudo actualizar la comisión.');
  }
}

async function bulkToggleComisiones(ids, nextState) {
  await Promise.all(ids.map((id) => apiPatch(`/comisiones/${id}`, { activo: nextState })));
  state.comisiones.items.forEach((item) => {
    if (ids.includes(item.id)) item.activo = nextState;
  });
  state.comisiones.selection.clear();
  renderComisiones();
}

async function bulkCloseComisiones(ids) {
  const cierre = prompt('Cerrar vigencia al (YYYY-MM-DD):');
  if (!cierre) return;
  await Promise.all(ids.map((id) => apiPatch(`/comisiones/${id}`, { vigencia_hasta: cierre })));
  state.comisiones.items.forEach((item) => {
    if (ids.includes(item.id)) item.vigencia_hasta = cierre;
  });
  state.comisiones.selection.clear();
  renderComisiones();
}

function exportComisiones(selectionOnly) {
  const ids = selectionOnly ? Array.from(state.comisiones.selection) : [];
  const params = new URLSearchParams({ ...state.comisiones.filters });
  if (selectionOnly && ids.length) {
    params.set('ids', ids.join(','));
  }
  const url = `${API_BASE_URL}/comisiones/export?${params.toString()}`;
  window.open(url, '_blank');
}


/**
 * ------------------------------
 * Simulador
 * ------------------------------
 */

function bindSimulatorEvents() {
  const { simulator } = state.dom;
  if (!simulator) return;

  simulator.toggle?.addEventListener('click', () => toggleSimulator(true));
  simulator.close?.addEventListener('click', () => toggleSimulator(false));
  simulator.form?.addEventListener('submit', submitSimulator);
}

function toggleSimulator(open) {
  state.simulator.panelOpen = open;
  renderSimulator();
}

function renderSimulator() {
  const { simulator } = state.dom;
  if (!simulator?.panel) return;
  simulator.panel.classList.toggle('d-none', !state.simulator.panelOpen);
  if (!state.simulator.panelOpen) return;

  if (state.simulator.loading) {
    simulator.loading?.classList.remove('d-none');
    simulator.result?.classList.add('d-none');
  } else {
    simulator.loading?.classList.add('d-none');
    simulator.result?.classList.remove('d-none');
    simulator.result.innerHTML = simulatorResultTemplate(state.simulator.result);
  }
}

async function submitSimulator(event) {
  event.preventDefault();
  const form = event.target;
  state.simulator.loading = true;
  renderSimulator();

  const payload = {
    ambito: form.ambito.value,
    referencia: form.referencia.value,
    usuario_id: form.usuario_id.value,
    fecha: form.fecha.value || new Date().toISOString().slice(0, 10),
    consumo: Number(form.consumo.value) || 0,
  };

  try {
    const response = await apiPost('/simulaciones/tarifas', payload);
    const data = await response.json();
    state.simulator.result = data;
  } catch (error) {
    console.error('Error simulando', error);
    state.simulator.result = {
      subtotal: 0,
      impuestos: 0,
      comision: 0,
      total_cliente: 0,
      neto_abogado: 0,
      reglas_aplicadas: [],
      reglas_ignoradas: [],
      moneda: state.quick.econconfig?.moneda_defecto || state.monedaFallback,
    };
  } finally {
    state.simulator.loading = false;
    renderSimulator();
  }
}

function simulatorResultTemplate(result) {
  if (!result) {
    return `
      <div class="card card-body text-center text-muted">
        Complete los datos y presione "Simular".
      </div>
    `;
  }
  return `
    <div class="card">
      <div class="card-body">
        <h5 class="card-title">Desglose del pago</h5>
        <dl class="row mb-0">
          <dt class="col-sm-6">Subtotal</dt>
          <dd class="col-sm-6 text-end">${formatCurrency(result.subtotal, result.moneda)}</dd>
          <dt class="col-sm-6">Impuestos</dt>
          <dd class="col-sm-6 text-end">${formatCurrency(result.impuestos, result.moneda)}</dd>
          <dt class="col-sm-6">Comisión</dt>
          <dd class="col-sm-6 text-end">${formatCurrency(result.comision, result.moneda)}</dd>
          <dt class="col-sm-6">Total cliente</dt>
          <dd class="col-sm-6 text-end">${formatCurrency(result.total_cliente, result.moneda)}</dd>
          <dt class="col-sm-6">Neto abogado</dt>
          <dd class="col-sm-6 text-end">${formatCurrency(result.neto_abogado, result.moneda)}</dd>
        </dl>
        <hr>
        <h6>Reglas aplicadas</h6>
        <ul class="mb-3">
          ${
            result.reglas_aplicadas?.length
              ? result.reglas_aplicadas.map((rule) => `<li>${rule}</li>`).join('')
              : '<li class="text-muted">Ninguna</li>'
          }
        </ul>
        <h6>Reglas ignoradas</h6>
        <ul class="mb-0">
          ${
            result.reglas_ignoradas?.length
              ? result.reglas_ignoradas.map((rule) => `<li>${rule}</li>`).join('')
              : '<li class="text-muted">Ninguna</li>'
          }
        </ul>
      </div>
    </div>
  `;
}


/**
 * ------------------------------
 * Impuestos (sección conservada)
 * ------------------------------
 */

function bindImpuestosEvents() {
  const { impuestos } = state.dom;
  if (!impuestos) return;

  impuestos.estado?.addEventListener('change', () => refreshImpuestosList());
  impuestos.tableBody?.addEventListener('click', handleImpuestoTableClick);
  impuestos.form?.addEventListener('submit', submitImpuestoForm);
  impuestos.reset?.addEventListener('click', resetImpuestoForm);
}

async function loadImpuestos() {
  try {
    const response = await apiGet('/impuestos');
    const { items } = await response.json();
    state.quick.impuestos = items || [];
  } catch (error) {
    console.error('Error cargando impuestos', error);
    state.quick.impuestos = [];
  }
}

function renderImpuestosTable() {
  const body = state.dom.impuestos.tableBody;
  if (!body) return;
  body.innerHTML = '';

  if (!state.quick.impuestos.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="6" class="text-center py-4 text-muted">
        No se registran impuestos. <a href="#" data-impuestos-new>Crear primero</a>
      </td>`;
    body.appendChild(tr);
    return;
  }

  state.quick.impuestos.forEach((impuesto) => {
    const tr = document.createElement('tr');
    tr.dataset.id = impuesto.id;
    tr.innerHTML = `
      <td>${impuesto.codigo}</td>
      <td>${impuesto.nombre}</td>
      <td>${formatPercentage(impuesto.porcentaje)}</td>
      <td>${vigenciaLabel(impuesto.vigencia_desde, impuesto.vigencia_hasta)}</td>
      <td>${impuesto.incluido_en_precio ? 'Incluido' : 'No incluido'}</td>
      <td>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" data-impuesto-toggle ${
            impuesto.activo ? 'checked' : ''
          }>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
}

function handleImpuestoTableClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('[data-impuesto-toggle]')) {
    toggleImpuesto(id, event.target.checked);
  } else {
    fillImpuestoForm(id);
  }
}

function fillImpuestoForm(id) {
  const impuesto = state.quick.impuestos.find((item) => item.id === id);
  if (!impuesto) return;
  const { form } = state.dom.impuestos;
  form.id.value = impuesto.id;
  form.codigo.value = impuesto.codigo || '';
  form.nombre.value = impuesto.nombre || '';
  form.porcentaje.value = Number(impuesto.porcentaje ?? 0);
  form.vigencia_desde.value = impuesto.vigencia_desde?.slice(0, 10) || '';
  form.vigencia_hasta.value = impuesto.vigencia_hasta?.slice(0, 10) || '';
  form.incluido.checked = !!impuesto.incluido_en_precio;
  form.activo.checked = impuesto.activo !== false;
  highlightImpuestoRow(id);
}

function highlightImpuestoRow(id) {
  const rows = state.dom.impuestos.tableBody?.querySelectorAll('tr') || [];
  rows.forEach((row) => {
    row.classList.toggle('table-active', Number(row.dataset.id) === id);
  });
}

function resetImpuestoForm() {
  const { form } = state.dom.impuestos;
  form.reset();
  form.id.value = '';
  highlightImpuestoRow(null);
}

async function submitImpuestoForm(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    codigo: form.codigo.value.trim(),
    nombre: form.nombre.value.trim(),
    porcentaje: Number(form.porcentaje.value),
    incluido_en_precio: form.incluido.checked,
    activo: form.activo.checked,
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
  };
  const id = form.id.value ? Number(form.id.value) : null;

  try {
    let response;
    if (id) {
      response = await apiPut(`/impuestos/${id}`, payload);
    } else {
      response = await apiPost('/impuestos', payload);
    }
    const saved = await response.json();
    const index = state.quick.impuestos.findIndex((item) => item.id === saved.id);
    if (index >= 0) {
      state.quick.impuestos.splice(index, 1, saved);
    } else {
      state.quick.impuestos.push(saved);
    }
    resetImpuestoForm();
    renderImpuestosTable();
  } catch (error) {
    console.error('Error guardando impuesto', error);
    window.alert('No se pudo guardar el impuesto.');
  }
}

async function toggleImpuesto(id, nextState) {
  try {
    await apiPatch(`/impuestos/${id}`, { activo: nextState });
    const impuesto = state.quick.impuestos.find((item) => item.id === id);
    if (impuesto) impuesto.activo = nextState;
  } catch (error) {
    console.error('Error actualizando impuesto', error);
    window.alert('No se pudo actualizar el impuesto.');
  } finally {
    renderImpuestosTable();
  }
}

async function refreshImpuestosList() {
  await loadImpuestos();
  renderImpuestosTable();
}

function renderImpuestoForm() {
  // La vista se actualiza cuando se selecciona un impuesto desde la tabla
}

/**
 * ------------------------------
 * Configuración económica (conservada)
 * ------------------------------
 */

function bindEconconfigEvents() {
  const { econconfig } = state.dom;
  if (!econconfig) return;

  econconfig.form?.addEventListener('submit', submitEconfigForm);
  econconfig.previewInput?.addEventListener('input', updateEconfigPreview);
  ['moneda', 'decimales', 'regla'].forEach((key) => {
    econconfig[key]?.addEventListener('change', updateEconfigPreview);
  });
}

async function loadEconconfig() {
  try {
    const response = await apiGet('/econconfig');
    const config = await response.json();
    state.quick.econconfig = config;
    state.monedaFallback = config?.moneda_defecto || state.monedaFallback;
  } catch (error) {
    console.error('Error obteniendo econconfig', error);
    state.quick.econconfig = null;
  }
}

function renderEconconfig() {
  const config = state.quick.econconfig || {};
  const { econconfig } = state.dom;
  if (!econconfig?.form) return;

  econconfig.moneda.value = config.moneda_defecto || state.monedaFallback;
  econconfig.decimales.value = config.decimales ?? 2;
  econconfig.regla.value = config.regla_redondeo || 'dos_decimales';
  econconfig.activo.checked = config.activo !== false;
  econconfig.updatedLabel.textContent = config.actualizado_el
    ? `Actualizado el ${formatExactDate(config.actualizado_el)}`
    : 'Sin actualizar';
  updateEconfigPreview();
}

function updateEconfigPreview() {
  const { econconfig } = state.dom;
  if (!econconfig?.previewResult) return;
  const raw = econconfig.previewInput.value;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    econconfig.previewResult.textContent = '—';
    return;
  }
  const moneda = econconfig.moneda.value || state.monedaFallback;
  const decimales = Number(econconfig.decimales.value) || 2;
  econconfig.previewResult.textContent = formatCurrency(value, moneda, decimales);
}

async function submitEconfigForm(event) {
  event.preventDefault();
  const form = event.target;
  const payload = {
    moneda_defecto: form.moneda.value.trim().toUpperCase(),
    decimales: Number(form.decimales.value) || 2,
    regla_redondeo: form.regla.value,
    activo: form.activo.checked,
  };

  try {
    const response = await apiPut('/econconfig', payload);
    const saved = await response.json();
    state.quick.econconfig = saved;
    state.monedaFallback = saved.moneda_defecto || state.monedaFallback;
    renderEconconfig();
  } catch (error) {
    console.error('Error guardando econconfig', error);
    window.alert('No se pudo guardar la configuración económica.');
  }
}


/**
 * ------------------------------
 * Utilidades compartidas
 * ------------------------------
 */

async function loadTarifas() {
  try {
    const response = await apiGet('/tarifas');
    const { items } = await response.json();
    state.tarifas.items = items || [];
  } catch (error) {
    console.error('Error cargando tarifas', error);
    state.tarifas.items = [];
  }
}

async function loadComisiones() {
  try {
    const response = await apiGet('/comisiones');
    const { items } = await response.json();
    state.comisiones.items = items || [];
  } catch (error) {
    console.error('Error cargando comisiones', error);
    state.comisiones.items = [];
  }
}

function getDefaultTarifa() {
  return {
    codigo: '',
    ambito: state.tarifas.filters.ambito || 'servicio',
    referencia_id: '',
    valor: 0,
    moneda: state.quick.econconfig?.moneda_defecto || state.monedaFallback,
    incluye_impuesto: true,
    tipo_calculo: 'fijo',
    parametros: {},
    vigencia_desde: new Date().toISOString().slice(0, 10),
    vigencia_hasta: '',
    activo: true,
    actualizado_el: '',
  };
}

function getDefaultComision() {
  return {
    codigo: '',
    ambito: state.comisiones.filters.ambito || 'servicio',
    referencia_id: '',
    rol_aplica: 'cliente',
    porcentaje: 0,
    vigencia_desde: new Date().toISOString().slice(0, 10),
    vigencia_hasta: '',
    activo: true,
    actualizado_el: '',
  };
}

function matchesAutocomplete(item, needle) {
  if (!needle) return true;
  return item.nombre_ambito?.toLowerCase().includes(needle.toLowerCase());
}

function vigenciaLabel(desde, hasta) {
  if (!desde && !hasta) return 'Sin vigencia definida';
  const hoy = new Date().toISOString().slice(0, 10);
  const status = statusFromDates(desde, hasta, hoy);
  const label =
    status === 'aplicable'
      ? `Vigente: ${formatDate(desde)} – ${hasta ? formatDate(hasta) : '…'}`
      : status === 'programada'
      ? 'Programada'
      : status === 'expirada'
      ? 'Expirada'
      : 'Pausada';
  return label;
}

function statusFromDates(desde, hasta, today) {
  if (hasta && hasta < today) return 'expirada';
  if (desde && desde > today) return 'programada';
  return 'aplicable';
}

function statusChip(item) {
  const today = new Date().toISOString().slice(0, 10);
  let status = 'aplicable';
  if (!item.activo) {
    status = isVigenteHoy(item, today) ? 'pausada' : item.vigencia_hasta && item.vigencia_hasta < today ? 'expirada' : 'programada';
  } else if (item.vigencia_hasta && item.vigencia_hasta < today) {
    status = 'expirada';
  } else if (item.vigencia_desde && item.vigencia_desde > today) {
    status = 'programada';
  }
  const cls =
    status === 'aplicable'
      ? 'bg-success'
      : status === 'programada'
      ? 'bg-info'
      : status === 'expirada'
      ? 'bg-secondary'
      : 'bg-warning text-dark';
  return `<span class="badge ${cls}">${CHIP_LABELS[status]}</span>`;
}

function formatCurrency(value, currency = state.monedaFallback, minimumFractionDigits) {
  const options = {
    style: 'currency',
    currency,
    minimumFractionDigits: minimumFractionDigits ?? state.quick.econconfig?.decimales ?? 2,
  };
  try {
    return new Intl.NumberFormat('es-PE', options).format(Number(value) || 0);
  } catch (error) {
    return `${currency} ${(Number(value) || 0).toFixed(options.minimumFractionDigits)}`;
  }
}

function formatPercentage(value) {
  return `${Number(value || 0).toFixed(2)} %`;
}

function formatDate(date) {
  if (!date) return '—';
  const safeDate = new Date(date);
  if (Number.isNaN(safeDate.getTime())) return date;
  return DATE_FORMATTER.format(safeDate);
}

function formatExactDate(date) {
  if (!date) return '—';
  const safe = new Date(date);
  if (Number.isNaN(safe.getTime())) return date;
  return `${DATE_FORMATTER.format(safe)} ${safe.toLocaleTimeString('es-PE', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function formatRelative(date) {
  if (!date) return '—';
  const target = new Date(date);
  if (Number.isNaN(target.getTime())) return date;
  const diff = (Date.now() - target.getTime()) / 1000;
  if (diff < 0) return 'en el futuro';
  for (const unit of RELATIVE_UNITS) {
    if (diff < unit.limit) {
      const value = Math.floor(diff / unit.divisor);
      return `hace ${value} ${unit.suffix}`;
    }
  }
  const years = Math.floor(diff / 31557600);
  return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

function checkboxCell(id) {
  return `<input type="checkbox" class="form-check-input" data-select value="${id}">`;
}

function ambitoLabel(item) {
  return item.nombre_ambito || '—';
}

function isVigenteHoy(item, today) {
  const desde = item.vigencia_desde || today;
  const hasta = item.vigencia_hasta || today;
  return desde <= today && hasta >= today;
}

function overlapsRange(item, desde, hasta) {
  if (!desde && !hasta) return true;
  const startA = item.vigencia_desde || '0000-00-00';
  const endA = item.vigencia_hasta || '9999-12-31';
  const startB = desde || '0000-00-00';
  const endB = hasta || '9999-12-31';
  return startA <= endB && startB <= endA;
}

function rangesOverlap(desdeA, hastaA, desdeB, hastaB) {
  const startA = desdeA || '0000-00-00';
  const endA = hastaA || '9999-12-31';
  const startB = desdeB || '0000-00-00';
  const endB = hastaB || '9999-12-31';
  return startA <= endB && startB <= endA;
}

function paginate(items, paginator) {
  const start = (paginator.page - 1) * paginator.perPage;
  return items.slice(start, start + paginator.perPage);
}

function paginationTemplate({ page, perPage, total }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  let html = '<nav><ul class="pagination pagination-sm mb-0">';
  for (let p = 1; p <= totalPages; p += 1) {
    html += `<li class="page-item ${p === page ? 'active' : ''}"><a class="page-link" href="#" data-page="${p}">${p}</a></li>`;
  }
  html += '</ul></nav>';
  return html;
}

function sortByDefaultOrder(items) {
  const today = new Date().toISOString().slice(0, 10);
  return [...items].sort((a, b) => {
    const score = (item) => {
      if (isVigenteHoy(item, today)) return 0;
      if (item.vigencia_desde && item.vigencia_desde > today) return 1;
      return 2;
    };
    const diffScore = score(a) - score(b);
    if (diffScore !== 0) return diffScore;
    const dateA = a.vigencia_desde || '9999-12-31';
    const dateB = b.vigencia_desde || '9999-12-31';
    return dateA.localeCompare(dateB);
  });
}

function attachRelativeTooltip(node, date) {
  if (!node || !window.bootstrap?.Tooltip) return;
  const tooltip = window.bootstrap.Tooltip.getOrCreateInstance(node);
  tooltip.setContent({ '.tooltip-inner': formatExactDate(date) });
}

function openAuditoria(tipo, id) {
  window.open(`${API_BASE_URL}/${tipo}/${id}/auditoria`, '_blank');
}

function setupShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    if (event.key === 'N' || event.key === 'n') {
      event.preventDefault();
      if (state.tabs === 'tarifas') {
        openTarifaForm('create');
      } else if (state.tabs === 'comisiones') {
        openComisionForm('create');
      }
    }
    if (event.key === 'E' || event.key === 'e') {
      event.preventDefault();
      if (state.tabs === 'tarifas') {
        exportTarifas(false);
      } else if (state.tabs === 'comisiones') {
        exportComisiones(false);
      }
    }
    if (event.key === '/' || event.key === '?') {
      event.preventDefault();
      const filters = state.tabs === 'tarifas' ? state.dom.tarifas.filters : state.dom.comisiones.filters;
      filters?.search?.focus();
    }
  });
}

function getBootstrapModal(element) {
  if (!element || !window.bootstrap?.Modal) return null;
  return window.bootstrap.Modal.getOrCreateInstance(element);
}

async function apiGet(path, params) {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  const response = await fetch(`${API_BASE_URL}${path}${query}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Error de red');
  return response;
}

async function apiPost(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Error de red');
  return response;
}

async function apiPut(path, body, extraHeaders = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Error de red');
  return response;
}

async function apiPatch(path, body) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!response.ok) throw new Error('Error de red');
  return response;
}