const API_BASE_URL = (typeof window !== 'undefined' && window.LEGALBOT_ADMIN_API_BASE_URL) || '/api';

const PARAM_TEMPLATES = {
  fijo: { monto: 0 },
  minimo_mas_variable: { minimo: 0, porcentaje_variable: 0 },
  paquete: { tamano_bloque: 0, precio_bloque: 0 },
  consumo_ia: { rate: 0, minimo: 0 },
  estacional: { multiplicadores: [{ desde: '', hasta: '', factor: 1 }] },
};

const PARAM_SCHEMAS = {
  fijo: {
    required: ['monto'],
    properties: {
      monto: { type: 'number', min: 0 },
    },
  },
  minimo_mas_variable: {
    required: ['minimo', 'porcentaje_variable'],
    properties: {
      minimo: { type: 'number', min: 0 },
      porcentaje_variable: { type: 'number', min: 0 },
    },
  },
  paquete: {
    required: ['tamano_bloque', 'precio_bloque'],
    properties: {
      tamano_bloque: { type: 'number', min: 0, exclusive: true },
      precio_bloque: { type: 'number', min: 0 },
    },
  },
  consumo_ia: {
    required: ['rate', 'minimo'],
    properties: {
      rate: { type: 'number', min: 0 },
      minimo: { type: 'number', min: 0 },
    },
  },
  estacional: {
    required: ['multiplicadores'],
    properties: {
      multiplicadores: {
        type: 'array',
        minItems: 1,
        items: {
          required: ['desde', 'hasta', 'factor'],
          properties: {
            desde: { type: 'string' },
            hasta: { type: 'string' },
            factor: { type: 'number', min: 0 },
          },
        },
      },
    },
  },
};


const PAYMENT_METHODS_PERU = [
  { id: 'tarjeta_credito', nombre: 'Tarjeta de crédito' },
  { id: 'tarjeta_debito', nombre: 'Tarjeta de débito' },
  { id: 'transferencia_bancaria', nombre: 'Transferencia bancaria' },
  { id: 'deposito_bancario', nombre: 'Depósito bancario' },
  { id: 'yape', nombre: 'Yape' },
  { id: 'plin', nombre: 'Plin' },
];

const PERU_REGIONS = [
  { id: 'PER-AMA', nombre: 'Amazonas' },
  { id: 'PER-ANC', nombre: 'Áncash' },
  { id: 'PER-APU', nombre: 'Apurímac' },
  { id: 'PER-ARE', nombre: 'Arequipa' },
  { id: 'PER-AYA', nombre: 'Ayacucho' },
  { id: 'PER-CAJ', nombre: 'Cajamarca' },
  { id: 'PER-CAL', nombre: 'Callao' },
  { id: 'PER-CUS', nombre: 'Cusco' },
  { id: 'PER-HUV', nombre: 'Huancavelica' },
  { id: 'PER-HUC', nombre: 'Huánuco' },
  { id: 'PER-ICA', nombre: 'Ica' },
  { id: 'PER-JUN', nombre: 'Junín' },
  { id: 'PER-LAL', nombre: 'La Libertad' },
  { id: 'PER-LAM', nombre: 'Lambayeque' },
  { id: 'PER-LIM', nombre: 'Lima' },
  { id: 'PER-LOR', nombre: 'Loreto' },
  { id: 'PER-MAD', nombre: 'Madre de Dios' },
  { id: 'PER-MOQ', nombre: 'Moquegua' },
  { id: 'PER-PAS', nombre: 'Pasco' },
  { id: 'PER-PIU', nombre: 'Piura' },
  { id: 'PER-PUN', nombre: 'Puno' },
  { id: 'PER-SAM', nombre: 'San Martín' },
  { id: 'PER-TAC', nombre: 'Tacna' },
  { id: 'PER-TUM', nombre: 'Tumbes' },
  { id: 'PER-UCA', nombre: 'Ucayali' },
];

const PAYMENT_METHOD_LABELS = new Map(PAYMENT_METHODS_PERU.map((item) => [item.id, item.nombre]));
const REGION_LABELS = new Map(PERU_REGIONS.map((item) => [item.id, item.nombre]));
function cloneTemplateFromCatalogs(tipo, catalogs) {
  const template = catalogs?.parametrosPlantilla?.[tipo] || PARAM_TEMPLATES[tipo] || {};
  return JSON.parse(JSON.stringify(template));
}

const initialCatalogsState = {
  servicios: [],
  planes: [],
  planServicios: [],
  monedas: [],
  metodos_pago: [],
  regiones: [],
  econconfig: null,
  impuestos: [],
  parametrosPlantilla: PARAM_TEMPLATES,
};

const state = {
  catalogs: initialCatalogsState,
  filters: {
    rol_aplica: '',
    activo: '',
    metodo_pago: '',
    vigencia: 'vigentes',
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
    data: null,
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
    impuestos: [],
    currentImpuestoId: null,
    econconfig: null,
    impuestosLoaded: false,
  },
  ui: {
    view: 'reglas',
    filtersApplied: false,

  },
};
state.wizard.data = createEmptyRule(initialCatalogsState);

const dom = {};
const bootstrapLib = typeof window !== 'undefined' ? window.bootstrap : undefined;
let syncingParamForm = false;
let syncingParamJson = false;


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
  updateViewVisibility();
}

function cacheDom() {
  dom.filters = {
    form: document.getElementById('tc-filters-form'),
    rol: document.getElementById('tc-filter-rol'),
    estado: document.getElementById('tc-filter-estado'),
    metodo: document.getElementById('tc-filter-metodo'),
    vigencia: document.getElementById('tc-filter-vigencia'),
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
    exportCsv: document.getElementById('tc-export-csv-btn'),
    exportExcel: document.getElementById('tc-export-excel-btn'),
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
    saveInactive: document.getElementById('tc-wizard-save-inactive'),
    form: document.getElementById('tc-wizard-form'),
    steps: Array.from(document.querySelectorAll('[data-tc-step]')),
    indicators: Array.from(document.querySelectorAll('[data-tc-step-indicator]')),
    alert: document.getElementById('tc-conflict-alert'),
    inputs: {
      codigo: document.getElementById('tc-input-codigo'),
      codigoRegenerar: document.getElementById('tc-btn-codigo-regenerar'),
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
    labels: {
      incluyeImpuesto: document.querySelector('label[for="tc-input-incluye-impuesto"]'),
    },
    parametrosForm: document.getElementById('tc-parametros-form'),
    manualBackdrop: null,

  };
  dom.views = {
    buttons: Array.from(document.querySelectorAll('[data-tc-view-button]')),
    containers: Array.from(document.querySelectorAll('[data-tc-view]')),
  };
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
  if (dom.wizard.labels?.incluyeImpuesto) {
    dom.wizard.labels.defaultIncluyeImpuesto = dom.wizard.labels.incluyeImpuesto.textContent.trim();
    if (bootstrapLib?.Tooltip) {
      dom.wizard.labels.incluyeImpuestoTooltip = bootstrapLib.Tooltip.getOrCreateInstance(dom.wizard.labels.incluyeImpuesto);
    }
  }
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

  if (dom.actions.exportExcel) {
    dom.actions.exportExcel.addEventListener('click', exportExcel);
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
  if (dom.simulator.inputs?.plan) {
    dom.simulator.inputs.plan.addEventListener('change', handleSimulatorPlanChange);
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
  if (dom.wizard.saveInactive) {
    dom.wizard.saveInactive.addEventListener('click', () => saveWizard(true));
  }
  if (dom.wizard.inputs.tipoCalculo) {
    dom.wizard.inputs.tipoCalculo.addEventListener('change', handleTipoCalculoChange);
  }
  if (dom.wizard.inputs.plan) {
    dom.wizard.inputs.plan.addEventListener('change', handleWizardPlanChange);
  }

  if (dom.wizard.inputs.servicio) {
    dom.wizard.inputs.servicio.addEventListener('change', handleWizardServicioChange);
  }
  if (dom.wizard.inputs.metodo) {
    dom.wizard.inputs.metodo.addEventListener('change', handleWizardMetodoChange);
  }
  if (dom.wizard.inputs.vigenciaDesde) {
    dom.wizard.inputs.vigenciaDesde.addEventListener('change', () => {
      updateImpuestoLabel(dom.wizard.inputs.vigenciaDesde.value || dom.wizard.inputs.vigenciaHasta.value || null);
    });
  }
  if (dom.wizard.inputs.vigenciaHasta) {
    dom.wizard.inputs.vigenciaHasta.addEventListener('change', () => {
      updateImpuestoLabel(dom.wizard.inputs.vigenciaDesde.value || dom.wizard.inputs.vigenciaHasta.value || null);
    });
  }
  if (dom.wizard.inputs.activo) {
    dom.wizard.inputs.activo.addEventListener('change', updateCodigoReadonlyState);
  }
  if (dom.wizard.inputs.codigoRegenerar) {
    dom.wizard.inputs.codigoRegenerar.addEventListener('click', handleCodigoRegenerar);
  }
  if (dom.wizard.inputs.parametros) {
    dom.wizard.inputs.parametros.addEventListener('input', debounce(handleParametrosJsonChange, 400));
  }
  if (dom.wizard.parametrosForm) {
    dom.wizard.parametrosForm.addEventListener('input', handleParametrosFormChange);
    dom.wizard.parametrosForm.addEventListener('change', handleParametrosFormChange);
    dom.wizard.parametrosForm.addEventListener('click', handleParametrosFormClick);
  }
  if (dom.wizard.alert) {
    dom.wizard.alert.addEventListener('click', handleConflictAlertClick);
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
  } if (dom.views?.buttons?.length) {
    dom.views.buttons.forEach((button) => {
      button.addEventListener('click', () => switchView(button.getAttribute('data-tc-view-button')));
    });
  }
  if (dom.impuestos?.estado) {
    dom.impuestos.estado.addEventListener('change', () => refreshImpuestosList());
  }
  if (dom.impuestos?.tableBody) {
    dom.impuestos.tableBody.addEventListener('click', handleImpuestoTableClick);
  }
  if (dom.impuestos?.form) {
    dom.impuestos.form.addEventListener('submit', submitImpuestoForm);
  }
  if (dom.impuestos?.reset) {
    dom.impuestos.reset.addEventListener('click', resetImpuestoForm);
  }
  if (dom.econconfig?.form) {
    dom.econconfig.form.addEventListener('submit', submitEconfigForm);
  }
  if (dom.econconfig?.previewInput) {
    dom.econconfig.previewInput.addEventListener('input', updateEconfigPreview);
  }
  ['moneda', 'decimales', 'regla'].forEach((key) => {
    const input = dom.econconfig?.[key];
    if (input) {
      input.addEventListener('change', updateEconfigPreview);
      input.addEventListener('input', updateEconfigPreview);
    }
  });
  if (dom.pasarelas?.tableBody) {
    dom.pasarelas.tableBody.addEventListener('click', handlePasarelaTableClick);
  }
  if (dom.pasarelas?.form) {
    dom.pasarelas.form.addEventListener('submit', submitPasarelaForm);
  }
  if (dom.pasarelas?.reset) {
    dom.pasarelas.reset.addEventListener('click', resetPasarelaForm);
  }
  if (dom.pasarelas?.methods?.tableBody) {
    dom.pasarelas.methods.tableBody.addEventListener('click', handlePasarelaMetodoTableClick);
  }
  if (dom.pasarelas?.methods?.form) {
    dom.pasarelas.methods.form.addEventListener('submit', submitPasarelaMetodoForm);
  }
  if (dom.pasarelas?.methods?.reset) {
    dom.pasarelas.methods.reset.addEventListener('click', resetPasarelaMetodoForm);
  }
  if (dom.pasarelas?.simulator?.run) {
    dom.pasarelas.simulator.run.addEventListener('click', runPasarelaSimulation);
  }
  if (dom.pasarelas?.simulator?.importe) {
    dom.pasarelas.simulator.importe.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        runPasarelaSimulation();
      }
    });
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

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

function apiPatch(path, body) {
  return apiRequest('PATCH', path, body);
}

function apiDelete(path) {
    return apiRequest('DELETE', path);
  }



  function generateCodigo() {
    const timestamp = new Date();
    const parts = [
      timestamp.getFullYear(),
      `${timestamp.getMonth() + 1}`.padStart(2, '0'),
      `${timestamp.getDate()}`.padStart(2, '0'),
      `${timestamp.getHours()}`.padStart(2, '0'),
      `${timestamp.getMinutes()}`.padStart(2, '0'),
      `${timestamp.getSeconds()}`.padStart(2, '0'),
    ];
    return `TC-${parts.join('')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
  
  function normalizeNullableValue(value) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric) && `${numeric}` === trimmed) {
        return numeric;
      }
      return trimmed;
    }
    return value;
  }
  
  function normalizeDateValue(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString();
  }

  function toNullableNumber(value) {
    const normalized = normalizeNullableValue(value);
    if (normalized === null) return null;
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function normalizeDateValue(value) {
    if (!value) return null;
    const limaIso = toLimaIso(value);
    if (limaIso) return limaIso;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toISOString();
  }

  function toLimaIso(value) {
    if (!value) return null;
    const trimmed = value.toString().trim();
    if (!trimmed) return null;
    const timezonePattern = /([zZ]|[+-]\d{2}:?\d{2})$/;
    let date;
    if (timezonePattern.test(trimmed)) {
      date = new Date(trimmed);
    } else {
      const [datePart, timePart = '00:00'] = trimmed.split('T');
      if (!datePart) return null;
      const [year, month, day] = datePart.split('-').map((part) => Number(part));
      if (![year, month, day].every((num) => Number.isFinite(num))) return null;
      const timeSegments = timePart.split(':');
      const hour = Number(timeSegments[0] ?? 0);
      const minute = Number(timeSegments[1] ?? 0);
      const second = Number(timeSegments[2] ?? 0);
      if ([hour, minute, second].some((num) => Number.isNaN(num))) return null;
      const utcMillis = Date.UTC(year, (month || 1) - 1, day || 1, hour + 5, minute, second);
      date = new Date(utcMillis);
    }
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  
  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    const minDate = new Date(-8640000000000000);
    const maxDate = new Date(8640000000000000);
    const startA = aStart ? new Date(aStart) : minDate;
    const endA = aEnd ? new Date(aEnd) : maxDate;
    const startB = bStart ? new Date(bStart) : minDate;
    const endB = bEnd ? new Date(bEnd) : maxDate;
    if (Number.isNaN(startA.getTime()) || Number.isNaN(endA.getTime()) || Number.isNaN(startB.getTime()) || Number.isNaN(endB.getTime())) {
      return true;
    }
    return startA <= endB && startB <= endA;
  }
  
  function findImpuestoVigente(fecha) {
    const target = fecha ? new Date(fecha) : new Date();
    if (Number.isNaN(target.getTime())) return null;
    return state.catalogs.impuestos.find((imp) => {
      if (imp.activo === false) return false;
      const desde = imp.vigencia_desde ? new Date(imp.vigencia_desde) : null;
      const hasta = imp.vigencia_hasta ? new Date(imp.vigencia_hasta) : null;
      if (desde && target < desde) return false;
      if (hasta && target > hasta) return false;
      return true;
    }) || null;
  }
  
  function updateImpuestoLabel(fecha) {
    if (!dom.wizard.labels?.incluyeImpuesto) return;
    const label = dom.wizard.labels.incluyeImpuesto;
    const impuesto = findImpuestoVigente(fecha);
    if (impuesto) {
      let porcentaje = '';
      if (impuesto.porcentaje !== undefined && impuesto.porcentaje !== null) {
        const numeric = Number(impuesto.porcentaje);
        if (Number.isFinite(numeric)) {
          const percentageValue = numeric * 100;
          porcentaje = percentageValue.toLocaleString('es-PE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
      }
      const nombre = impuesto.nombre || impuesto.codigo || 'Impuesto';
      label.textContent = `Incluye impuesto (${nombre} Vigente${porcentaje ? ` ${porcentaje}%` : ''})`;
    } else {
      label.textContent = dom.wizard.labels.defaultIncluyeImpuesto || 'Incluye impuesto';
    }
  }
  function getServiciosByPlan(planId) {
    if (!planId) return state.catalogs.servicios || [];
    const id = Number(planId);
    if (!Number.isFinite(id)) return state.catalogs.servicios || [];
    const relations = (state.catalogs.planServicios || []).filter((rel) => Number(rel.plan_id) === id && rel.activo !== false);
    if (!relations.length) return state.catalogs.servicios || [];
    const allowed = new Set(relations.map((rel) => Number(rel.servicio_id)));
    return (state.catalogs.servicios || []).filter((servicio) => allowed.has(Number(servicio.id)));
  }
  
  function refreshServicioOptionsForSelect(select, planId, emptyLabel = 'Todos') {
    if (!select) return;
    const current = select.value;
    const servicios = getServiciosByPlan(planId);
    fillSelect(select, servicios, { value: 'id', label: (s) => `${s.codigo} - ${s.nombre}` }, true, emptyLabel);
    if (current && Array.from(select.options).some((option) => option.value === current)) {
      select.value = current;
    } else if (select.value !== current) {
      select.value = '';
      select.dispatchEvent(new Event('change'));
    }
  }
  
  function syncServicioDependencies() {
    const wizardPlan = dom.wizard.inputs?.plan?.value || '';
    refreshServicioOptionsForSelect(dom.wizard.inputs?.servicio, wizardPlan, 'Todos');
    const simulatorPlan = dom.simulator.inputs?.plan?.value || '';
    refreshServicioOptionsForSelect(dom.simulator.inputs?.servicio, simulatorPlan, 'Todos');
  }
    
  function ensureCodigoValue() {
    if (!dom.wizard.inputs?.codigo) return;
    if (!dom.wizard.inputs.codigo.value) {
      const generated = generateCodigo();
      dom.wizard.inputs.codigo.value = generated;
      state.wizard.data = { ...state.wizard.data, codigo: generated };
    }
  }
  
  function cloneParametros(parametros) {
    try {
      return JSON.parse(JSON.stringify(parametros ?? {}));
    } catch (error) {
      return {};
    }
  }
  
  function updateParametrosJson(parametros) {
    if (!dom.wizard.inputs?.parametros) return;
    syncingParamJson = true;
    dom.wizard.inputs.parametros.classList.remove('is-invalid');
    dom.wizard.inputs.parametros.value = JSON.stringify(parametros ?? {}, null, 2);
    syncingParamJson = false;
  }
  
  function setParametrosState(parametros, { skipForm = false, skipJson = false } = {}) {
    const normalized = parametros && typeof parametros === 'object' ? parametros : {};
    state.wizard.data = { ...state.wizard.data, parametros: normalized };
    if (!skipForm) {
      renderParametrosForm(dom.wizard.inputs?.tipoCalculo?.value || state.wizard.data.tipo_calculo || 'fijo', normalized);
    }
    if (!skipJson) {
      updateParametrosJson(normalized);
    }
  }
  
  function renderParametrosForm(tipo, parametros = {}) {
    if (!dom.wizard.parametrosForm) return;
    syncingParamForm = true;
    const container = dom.wizard.parametrosForm;
    container.innerHTML = '';
    container.dataset.tipo = tipo;
  
    const builders = {
      fijo: () => renderSimpleParametros(container, tipo, [
        { key: 'monto', label: 'Monto', min: 0, step: 0.01 },
      ], parametros),
      minimo_mas_variable: () => renderSimpleParametros(container, tipo, [
        { key: 'minimo', label: 'Mínimo', min: 0, step: 0.01 },
        { key: 'porcentaje_variable', label: 'Porcentaje variable (%)', min: 0, step: 0.01 },
      ], parametros),
      paquete: () => renderSimpleParametros(container, tipo, [
        { key: 'tamano_bloque', label: 'Tamaño de bloque', min: 0, step: 1, help: 'Debe ser mayor a 0.' },
        { key: 'precio_bloque', label: 'Precio por bloque', min: 0, step: 0.01 },
      ], parametros),
      consumo_ia: () => renderSimpleParametros(container, tipo, [
        { key: 'rate', label: 'Tarifa por unidad', min: 0, step: 0.0001 },
        { key: 'minimo', label: 'Mínimo facturable', min: 0, step: 0.01 },
      ], parametros),
      estacional: () => renderEstacionalParametros(container, parametros),
    };
  
    if (builders[tipo]) {
      builders[tipo]();
    }
    syncingParamForm = false;
  }
  
  function renderSimpleParametros(container, tipo, fields, parametros) {
    fields.forEach((field) => {
      const value = parametros?.[field.key];
      const wrapper = document.createElement('div');
      wrapper.className = 'col-12 col-md-6 col-lg-4 form-group';
      const label = document.createElement('label');
      label.className = 'form-label';
      label.setAttribute('for', `tc-param-${tipo}-${field.key}`);
      label.textContent = field.label;
      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'form-control';
      input.id = `tc-param-${tipo}-${field.key}`;
      if (field.min !== undefined) input.min = field.min;
      if (field.step !== undefined) input.step = field.step;
      input.dataset.paramKey = field.key;
      input.dataset.paramType = 'number';
      input.value = value ?? '';
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      if (field.help) {
        const help = document.createElement('div');
        help.className = 'form-text';
        help.textContent = field.help;
        wrapper.appendChild(help);
      }
      container.appendChild(wrapper);
    });
  }
  
  function renderEstacionalParametros(container, parametros) {
    const rows = Array.isArray(parametros?.multiplicadores) && parametros.multiplicadores.length
      ? parametros.multiplicadores
      : [{ desde: '', hasta: '', factor: 1 }];
    const header = document.createElement('div');
    header.className = 'col-12';
    header.innerHTML = '<p class="text-muted small mb-2">Configura multiplicadores por rango de vigencia. No deben solaparse.</p>';
    container.appendChild(header);
    rows.forEach((row, index) => {
      const rowWrapper = document.createElement('div');
      rowWrapper.className = 'col-12';
      rowWrapper.dataset.paramIndex = index;
      const inner = document.createElement('div');
      inner.className = 'row g-2 align-items-end';
      inner.innerHTML = `
        <div class="col-12 col-md-3">
          <label class="form-label" for="tc-param-estacional-desde-${index}">Desde</label>
          <input type="date" class="form-control" id="tc-param-estacional-desde-${index}" data-param-collection="multiplicadores" data-param-index="${index}" data-param-key="desde" value="${row.desde ?? ''}" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label" for="tc-param-estacional-hasta-${index}">Hasta</label>
          <input type="date" class="form-control" id="tc-param-estacional-hasta-${index}" data-param-collection="multiplicadores" data-param-index="${index}" data-param-key="hasta" value="${row.hasta ?? ''}" />
        </div>
        <div class="col-12 col-md-3">
          <label class="form-label" for="tc-param-estacional-factor-${index}">Factor</label>
          <input type="number" class="form-control" id="tc-param-estacional-factor-${index}" min="0" step="0.01" data-param-collection="multiplicadores" data-param-index="${index}" data-param-key="factor" data-param-type="number" value="${row.factor ?? 1}" />
        </div>
        <div class="col-12 col-md-3 d-flex gap-2 align-items-end justify-content-end">
          <button type="button" class="btn btn-outline-danger" data-param-action="remove-multiplicador" data-param-index="${index}" ${rows.length === 1 ? 'disabled' : ''}>Eliminar</button>
        </div>
      `;
      rowWrapper.appendChild(inner);
      container.appendChild(rowWrapper);
    });
    const footer = document.createElement('div');
    footer.className = 'col-12 d-flex justify-content-end';
    footer.innerHTML = '<button type="button" class="btn btn-outline-primary" data-param-action="add-multiplicador">Agregar</button>';
    container.appendChild(footer);
  }
  
  function handleParametrosFormChange(event) {
    if (syncingParamForm) return;
    const target = event.target;
    if (!target || (!target.dataset.paramKey && !target.dataset.paramCollection)) return;
    const parametros = cloneParametros(state.wizard.data.parametros);
    if (target.dataset.paramCollection === 'multiplicadores') {
      const index = Number(target.dataset.paramIndex);
      if (!Array.isArray(parametros.multiplicadores)) {
        parametros.multiplicadores = [];
      }
      if (!parametros.multiplicadores[index]) {
        parametros.multiplicadores[index] = { desde: '', hasta: '', factor: 1 };
      }
      const key = target.dataset.paramKey;
      if (key) {
        if (target.dataset.paramType === 'number') {
          parametros.multiplicadores[index][key] = target.value === '' ? '' : Number(target.value);
        } else {
          parametros.multiplicadores[index][key] = target.value;
        }
      }
    } else if (target.dataset.paramKey) {
      const key = target.dataset.paramKey;
      if (target.dataset.paramType === 'number') {
        parametros[key] = target.value === '' ? '' : Number(target.value);
      } else {
        parametros[key] = target.value;
      }
    } else {
      return;
    }
    setParametrosState(parametros, { skipForm: true });
    if (dom.wizard.inputs?.parametros) {
      dom.wizard.inputs.parametros.classList.remove('is-invalid');
    }
  }
  
  function handleParametrosFormClick(event) {
    const button = event.target.closest('[data-param-action]');
    if (!button) return;
    const action = button.dataset.paramAction;
    if (action === 'add-multiplicador') {
      const parametros = cloneParametros(state.wizard.data.parametros);
      const list = Array.isArray(parametros.multiplicadores) ? parametros.multiplicadores.slice() : [];
      list.push({ desde: '', hasta: '', factor: 1 });
      parametros.multiplicadores = list;
      setParametrosState(parametros);
    } else if (action === 'remove-multiplicador') {
      const index = Number(button.dataset.paramIndex);
      const parametros = cloneParametros(state.wizard.data.parametros);
      const list = Array.isArray(parametros.multiplicadores) ? parametros.multiplicadores.slice() : [];
      if (list.length > 1 && index >= 0 && index < list.length) {
        list.splice(index, 1);
        parametros.multiplicadores = list;
        setParametrosState(parametros);
      }
    }
  }
  
  function handleParametrosJsonChange() {
    if (syncingParamJson) return;
    if (!dom.wizard.inputs?.parametros) return;
    const raw = dom.wizard.inputs.parametros.value.trim();
    if (!raw) {
      const template = cloneTemplate(dom.wizard.inputs?.tipoCalculo?.value || 'fijo');
      setParametrosState(template, { skipJson: true });
      dom.wizard.inputs.parametros.classList.remove('is-invalid');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (dom.wizard.inputs?.parametros) {
        dom.wizard.inputs.parametros.classList.remove('is-invalid');
      }
      setParametrosState(parsed, { skipJson: true });
    } catch (error) {
      dom.wizard.inputs.parametros.classList.add('is-invalid');
    }
  }
  
  function validateParametrosSchema(tipo, parametros) {
    const schema = PARAM_SCHEMAS[tipo];
    if (!schema) return { valid: true };
    const errors = [];
    if (schema.required) {
      schema.required.forEach((key) => {
        if (parametros[key] === undefined || parametros[key] === null || parametros[key] === '') {
          errors.push(`El parámetro "${key}" es obligatorio.`);
        }
      });
    }
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, rule]) => {
        const value = parametros[key];
        if (value === undefined || value === null) return;
        if (rule.type === 'number') {
          const number = Number(value);
          if (Number.isNaN(number)) {
            errors.push(`"${key}" debe ser numérico.`);
            return;
          }
          if (rule.min !== undefined && number < rule.min) {
            errors.push(`"${key}" debe ser mayor o igual a ${rule.min}.`);
          }
          if (rule.exclusive && rule.min !== undefined && number <= rule.min) {
            errors.push(`"${key}" debe ser mayor a ${rule.min}.`);
          }
        } else if (rule.type === 'array') {
          if (!Array.isArray(value)) {
            errors.push(`"${key}" debe ser un arreglo.`);
            return;
          }
          if (rule.minItems && value.length < rule.minItems) {
            errors.push(`"${key}" debe contener al menos ${rule.minItems} elemento(s).`);
          }
          if (rule.items) {
            value.forEach((item, index) => {
              if (rule.items.required) {
                rule.items.required.forEach((prop) => {
                  if (item[prop] === undefined || item[prop] === null || item[prop] === '') {
                    errors.push(`"${key}[${index}].${prop}" es obligatorio.`);
                  }
                });
              }
              if (rule.items.properties) {
                Object.entries(rule.items.properties).forEach(([prop, propRule]) => {
                  const propValue = item[prop];
                  if (propRule.type === 'number' && propValue !== undefined && propValue !== null) {
                    const number = Number(propValue);
                    if (Number.isNaN(number)) {
                      errors.push(`"${key}[${index}].${prop}" debe ser numérico.`);
                    } else if (propRule.min !== undefined && number < propRule.min) {
                      errors.push(`"${key}[${index}].${prop}" debe ser mayor o igual a ${propRule.min}.`);
                    } else if (propRule.exclusive && propRule.min !== undefined && number <= propRule.min) {
                      errors.push(`"${key}[${index}].${prop}" debe ser mayor a ${propRule.min}.`);
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
    return { valid: errors.length === 0, message: errors.join('\n') };
  }


  function validateEstacionalRanges(multiplicadores) {
    if (!Array.isArray(multiplicadores)) {
      return { valid: true, messages: [] };
    }
    const errors = [];
    const ranges = multiplicadores.map((item, index) => {
      const desde = item?.desde ? new Date(item.desde) : null;
      const hasta = item?.hasta ? new Date(item.hasta) : null;
      const startTime = desde && !Number.isNaN(desde.getTime()) ? desde.getTime() : Number.NEGATIVE_INFINITY;
      const endTime = hasta && !Number.isNaN(hasta.getTime()) ? hasta.getTime() : Number.POSITIVE_INFINITY;
      if (desde && Number.isNaN(desde.getTime())) {
        errors.push(`Fila ${index + 1}: la fecha "desde" es inválida.`);
      }
      if (hasta && Number.isNaN(hasta.getTime())) {
        errors.push(`Fila ${index + 1}: la fecha "hasta" es inválida.`);
      }
      if (startTime > endTime) {
        errors.push(`Fila ${index + 1}: la fecha "hasta" debe ser posterior a "desde".`);
      }
      return { index, startTime, endTime };
    });
    for (let i = 0; i < ranges.length; i += 1) {
      for (let j = i + 1; j < ranges.length; j += 1) {
        const a = ranges[i];
        const b = ranges[j];
        if (a.startTime <= b.endTime && b.startTime <= a.endTime) {
          errors.push(`Las filas ${a.index + 1} y ${b.index + 1} se solapan.`);
        }
      }
    }
    return { valid: errors.length === 0, messages: errors };
  }
async function loadCatalogs(options = {}) {
  const { silent = false } = options;
  try {
    const data = await apiGet('/tarifas/catalogs');
    state.catalogs = {
      servicios: data.servicios || [],
      planes: data.planes || [],
      planServicios: data.planServicios || data.plan_servicios || [],
      monedas: data.monedas || [],
      metodos_pago: data.metodos_pago || [],
      regiones: data.regiones || [],
      econconfig: data.econconfig || null,
      impuestos: data.impuestos || [],
      parametrosPlantilla: data.parametrosPlantilla || PARAM_TEMPLATES,
    };
    state.quick.econconfig = data.econconfig || null;
    populateCatalogSelects();
    syncServicioDependencies();
    updateImpuestoLabel(dom.wizard.inputs?.vigenciaDesde?.value || dom.wizard.inputs?.vigenciaHasta?.value || null);
  } catch (error) {
    console.error('Error cargando catálogos', error);
    if (!silent) {
      const rawMessage = error.message || '';
      const fallback = 'No se pudieron cargar los catálogos de tarifas. Intenta nuevamente.';
      const sanitized = rawMessage && rawMessage !== 'Error obteniendo catálogos' ? rawMessage : fallback;
      window.alert(sanitized);
    }
  }
}

function populateCatalogSelects() {
  const { servicios, planes, monedas, metodos_pago, regiones, econconfig } = state.catalogs;

  const metodoOptions = buildMetodoOptions(metodos_pago);
  fillSelect(dom.filters.metodo, metodoOptions, { value: 'id', label: 'nombre' }, true, 'Todos');

  const wizardInputs = dom.wizard.inputs;
  fillSelect(wizardInputs.plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  refreshServicioOptionsForSelect(wizardInputs.servicio, wizardInputs.plan?.value || '', 'Todos');

  const monedaGlobal = econconfig?.moneda_defecto || (Array.isArray(monedas) && monedas.length ? monedas[0] : '');
  const monedaOptions = monedaGlobal
    ? [{ id: monedaGlobal, nombre: monedaGlobal }]
    : (monedas || []).map((m) => ({ id: m, nombre: m }));
  const allowEmptyMoneda = monedaOptions.length === 0;
  fillSelect(wizardInputs.moneda, monedaOptions, { value: 'id', label: 'nombre' }, allowEmptyMoneda, monedaGlobal || 'Selecciona');
  if (wizardInputs.moneda) {
    const defaultValue = monedaGlobal || (monedaOptions[0]?.id ?? '');
    wizardInputs.moneda.value = defaultValue;
    wizardInputs.moneda.disabled = monedaOptions.length <= 1;
  }

  fillSelect(wizardInputs.metodo, metodoOptions, { value: 'id', label: 'nombre' }, true, 'Todos');

  const regionOptions = buildRegionOptions(regiones);
  fillSelect(wizardInputs.region, regionOptions, { value: 'id', label: 'nombre' }, true, 'Global');

  fillSelect(dom.simulator.inputs.plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  refreshServicioOptionsForSelect(dom.simulator.inputs.servicio, dom.simulator.inputs.plan?.value || '', 'Todos');
  fillSelect(dom.simulator.inputs.moneda, monedaOptions, { value: 'id', label: 'nombre' }, true, monedaGlobal || '');
  if (dom.simulator.inputs.moneda && monedaGlobal) {
    dom.simulator.inputs.moneda.value = monedaGlobal;
  }
  fillSelect(dom.simulator.inputs.metodo, metodoOptions, { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.simulator.inputs.region, regionOptions, { value: 'id', label: 'nombre' }, true, 'Todos');

  if (wizardInputs.rol && !wizardInputs.rol.value) {
    wizardInputs.rol.value = 'cliente';
  }

  fillSelect(dom.wizard.inputs.step3Plan, planes, { value: 'id', label: 'nombre' }, true, 'Todos');
  fillSelect(dom.wizard.inputs.step3Metodo, metodoOptions, { value: 'id', label: 'nombre' }, true, 'Todos');
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


function ensureSelectOption(select, value, label) {
  if (!select) return;
  if (value === undefined || value === null || value === '') return;
  const normalized = `${value}`;
  const exists = Array.from(select.options).some((option) => option.value === normalized);
  if (!exists) {
    const option = document.createElement('option');
    option.value = normalized;
    option.textContent = label || normalized;
    option.dataset.tcDynamicOption = 'true';
    select.appendChild(option);
  }
}

function buildMetodoOptions(existing = []) {
  const map = new Map(PAYMENT_METHODS_PERU.map((item) => [item.id, item.nombre]));
  (existing || []).forEach((item) => {
    const option = typeof item === 'string' ? { id: item.trim(), nombre: null } : item;
    if (!option || !option.id) return;
    const key = option.id.trim();
    if (!key || key === '*') return;
    if (!map.has(key)) {
      const label = option.nombre || PAYMENT_METHOD_LABELS.get(key) || prettifyIdentifier(key);
      map.set(key, label);
    }
  });
  return Array.from(map.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-PE', { sensitivity: 'base' }));
}

function buildRegionOptions(existing = []) {
  const map = new Map(REGION_LABELS);
  (existing || []).forEach((item) => {
    const option = typeof item === 'string' ? { id: item.trim(), nombre: null } : item;
    if (!option || !option.id) return;
    const key = option.id.trim();
    if (!key) return;
    if (!map.has(key)) {
      const label = option.nombre || REGION_LABELS.get(key) || prettifyRegionCode(key);
      map.set(key, label);
    }
  });
  return Array.from(map.entries())
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-PE', { sensitivity: 'base' }));
}

function prettifyIdentifier(value) {
  if (!value) return '';
  return value
    .toString()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (match, separator, letter) => `${separator}${letter.toUpperCase()}`);
}

function prettifyRegionCode(code) {
  if (!code) return '';
  const parts = code.split('-');
  const suffix = parts[parts.length - 1] || code;
  return prettifyIdentifier(suffix);
}


function resetFilters() {
  state.filters = {
    rol_aplica: '',
    activo: '',
    metodo_pago: '',
    vigencia: 'vigentes',
  };
  state.ui.filtersApplied = false;
  if (dom.filters.rol) dom.filters.rol.value = '';
  if (dom.filters.estado) dom.filters.estado.value = '';
  if (dom.filters.metodo) dom.filters.metodo.value = '';
  if (dom.filters.vigencia) dom.filters.vigencia.value = 'vigentes';
  state.pagination.page = 1;
  syncServicioDependencies();

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
if (dom.table.empty) {
      dom.table.empty.textContent = state.ui.filtersApplied
        ? 'No se encontraron reglas que coincidan con los filtros aplicados.'
        : 'Aún no hay reglas registradas.';
      dom.table.empty.classList.remove('d-none');
    }
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

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });
}

function applyFilters() {
  state.filters = {
    rol_aplica: dom.filters.rol?.value || '',
    activo: dom.filters.estado?.value || '',
    metodo_pago: dom.filters.metodo?.value || '',
    vigencia: dom.filters.vigencia?.value || '',
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

  if (dom.wizard.modalInstance) {
    if (open) {
      state.wizard.open = true;
      updateWizardUi();
      dom.wizard.modalInstance.show();
    } else {
      dom.wizard.modalInstance.hide();
    }
    return;
  }

  if (open) {
    state.wizard.open = true;
    dom.wizard.modal.classList.remove('d-none');
    dom.wizard.modal.classList.add('show');
    dom.wizard.modal.style.display = 'block';
    dom.wizard.modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    createWizardFallbackBackdrop();
    updateWizardUi();
  } else {
    dom.wizard.modal.classList.remove('show');
    dom.wizard.modal.style.display = 'none';
    dom.wizard.modal.setAttribute('aria-hidden', 'true');
    dom.wizard.modal.classList.add('d-none');
    document.body.classList.remove('modal-open');
    removeWizardFallbackBackdrop();
    resetWizardFormState();
  }
}

function createWizardFallbackBackdrop() {
  if (dom.wizard.manualBackdrop) return;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop fade show';
  backdrop.dataset.tcWizardBackdrop = 'true';
  document.body.appendChild(backdrop);
  dom.wizard.manualBackdrop = backdrop;
}

function removeWizardFallbackBackdrop() {
  if (!dom.wizard.manualBackdrop) return;
  dom.wizard.manualBackdrop.remove();
  dom.wizard.manualBackdrop = null;
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
  updateCodigoReadonlyState();
  updateImpuestoLabel(null);
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
    rol_aplica: rule.rol_aplica || 'ambos',
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
    state.wizard.mode === 'edit'
      ? `Editar regla ${data.codigo}`
      : state.wizard.mode === 'clone'
        ? 'Clonar regla'
        : 'Nueva regla';
  inputs.codigo.value = data.codigo || '';
  ensureCodigoValue();
  const planValue = data.plan_id || '';
  inputs.plan.value = planValue;
  refreshServicioOptionsForSelect(inputs.servicio, planValue, 'Todos');
  inputs.servicio.value = data.servicio_id || '';
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
  updateCodigoReadonlyState();
  updateImpuestoLabel(inputs.vigenciaDesde.value || inputs.vigenciaHasta.value || null);
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
    indicator.classList.toggle('btn-outline-primary', !isCurrent);
    indicator.disabled = indicatorStep > step;
  });
  dom.wizard.prev.hidden = step === 1;
  dom.wizard.next.hidden = step === 3;
  dom.wizard.save.hidden = step !== 3;
  if (dom.wizard.saveInactive) {
    dom.wizard.saveInactive.hidden = step !== 3;
  }
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
  ensureCodigoValue();
  const codigo = inputs.codigo.value.trim();
  if (!codigo) {
    inputs.codigo.setCustomValidity('El código es obligatorio');
    inputs.codigo.reportValidity();
    return false;
  }
  inputs.codigo.setCustomValidity('');
  if (inputs.descripcion.value.length > 160) {
    inputs.descripcion.setCustomValidity('La descripción no puede exceder 160 caracteres');
    inputs.descripcion.reportValidity();
    return false;
  }
  inputs.descripcion.setCustomValidity('');
  if (inputs.servicio) {
    inputs.servicio.setCustomValidity('');
  }
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

  const payload = buildRulePayload(state.wizard.data);
  hideConflict();
  if (!validateUniqueCombination(payload)) {
    return false;
  }
  if (payload.activo && !validateOverlap(payload)) {
    return false;
  }
  hideConflict();
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
    if (dom.wizard.inputs?.parametros) {
      dom.wizard.inputs.parametros.classList.add('is-invalid');
    }
    return false;
  }
  if (dom.wizard.inputs?.parametros) {
    dom.wizard.inputs.parametros.classList.remove('is-invalid');
  }
  if (inputs.descripcion.value.length > 160) {
    inputs.descripcion.setCustomValidity('La descripción no puede exceder 160 caracteres');
    inputs.descripcion.reportValidity();
    return false;
  }
  inputs.descripcion.setCustomValidity('');
  if (tipo === 'estacional' && (!inputs.valor.value || Number(inputs.valor.value) < 0)) {
    inputs.valor.setCustomValidity('Debe establecer un valor base para reglas estacionales');
    inputs.valor.reportValidity();
    return false;
  }
  inputs.valor.setCustomValidity('');
  const schemaValidation = validateParametrosSchema(tipo, parametros);
  if (!schemaValidation.valid) {
    window.alert(schemaValidation.message || 'Verifica los parámetros ingresados.');
    return false;
  }
  if (tipo === 'estacional') {
    const seasonalValidation = validateEstacionalRanges(parametros.multiplicadores);
    if (!seasonalValidation.valid) {
      window.alert(seasonalValidation.messages.join('\n'));
      return false;
    }
  }
  setParametrosState(parametros);
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
  const previousTipo = state.wizard.data.tipo_calculo;
  let parametros = cloneParametros(state.wizard.data.parametros);
  if (!parametros || !Object.keys(parametros).length || previousTipo !== tipo) {
    parametros = cloneTemplate(tipo);
  }
  state.wizard.data = { ...state.wizard.data, tipo_calculo: tipo };
  setParametrosState(parametros);
  const showValor = tipo === 'estacional';
  const valorGroup = dom.wizard.inputs.valor.closest('.form-group');
  if (valorGroup) {
    valorGroup.classList.toggle('d-none', !showValor);
  }
}

function handleWizardServicioChange() {
  dom.wizard.inputs.step3Plan.value = dom.wizard.inputs.plan.value || '';
}

function handleWizardPlanChange() {
  const planValue = dom.wizard.inputs.plan.value || '';
  refreshServicioOptionsForSelect(dom.wizard.inputs.servicio, planValue, 'Todos');
  dom.wizard.inputs.step3Plan.value = planValue;
}

function handleWizardMetodoChange() {
  dom.wizard.inputs.step3Metodo.value = dom.wizard.inputs.metodo.value || '';
}

function handleCodigoRegenerar() {
  const generated = generateCodigo();
  if (dom.wizard.inputs.codigo) {
    dom.wizard.inputs.codigo.value = generated;
  }
  state.wizard.data = { ...state.wizard.data, codigo: generated };
}

function handleSimulatorPlanChange() {
  const planValue = dom.simulator.inputs.plan.value || '';
  refreshServicioOptionsForSelect(dom.simulator.inputs.servicio, planValue, 'Todos');
}

function handleConflictAlertClick(event) {
  const button = event.target.closest('[data-tc-action="view-rules"]');
  if (!button) return;
  toggleWizard(false);
  if (dom.table?.body) {
    dom.table.body.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function updateCodigoReadonlyState() {
  if (!dom.wizard.inputs.codigo) return;
  const isActive = dom.wizard.inputs.activo?.checked;
  dom.wizard.inputs.codigo.readOnly = !!isActive;
  if (dom.wizard.inputs.codigoRegenerar) {
    dom.wizard.inputs.codigoRegenerar.disabled = isActive && state.wizard.mode === 'edit';
  }
}

function cloneTemplate(tipo, catalogs) {
  const sourceCatalogs = catalogs !== undefined ? catalogs : state.catalogs;
  return cloneTemplateFromCatalogs(tipo, sourceCatalogs);
}
async function saveWizard(forceInactive = false) {
  if (forceInactive && dom.wizard.inputs?.activo) {
    dom.wizard.inputs.activo.checked = false;
    updateCodigoReadonlyState();
  }
  if (!captureStep1() || !captureStep2()) return;
  if (forceInactive) {
    state.wizard.data = { ...state.wizard.data, activo: false };
  }
  hideConflict();
  try {
    const payload = buildRulePayload(state.wizard.data);
    if (forceInactive) {
      payload.activo = false;
    }
    if (!validateRuleBusiness(payload)) {
      return;
    }
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

function validateRuleBusiness(payload) {
  if (!payload) return true;
  hideConflict();

  if (!validateUniqueCombination(payload)) {
    return false;
  }
  if (payload.activo && !validateOverlap(payload)) {
    return false;
  }
  hideConflict();

  return true;
}

function sameScopeValue(ruleValue, payloadValue) {
  return normalizeNullableValue(ruleValue) === normalizeNullableValue(payloadValue);
}

function validateUniqueCombination(payload, { silent = false } = {}) {
  const currentId = state.wizard.mode === 'edit' ? state.wizard.id : null;
  const duplicates = state.rules.filter((rule) => {
    if (currentId && rule.id === currentId) return false;
    if (!!rule.activo !== !!payload.activo) return false;
    if (!sameScopeValue(rule.servicio_id, payload.servicio_id)) return false;
    if (!sameScopeValue(rule.plan_id, payload.plan_id)) return false;
    if (!sameScopeValue(rule.rol_aplica, payload.rol_aplica)) return false;
    if (!sameScopeValue(rule.ambito_region, payload.ambito_region)) return false;
    if (!sameScopeValue(rule.metodo_pago, payload.metodo_pago)) return false;
    if (!sameScopeValue(rule.moneda, payload.moneda)) return false;
    if (normalizeDateValue(rule.vigencia_desde) !== normalizeDateValue(payload.vigencia_desde)) return false;
    if (normalizeDateValue(rule.vigencia_hasta) !== normalizeDateValue(payload.vigencia_hasta)) return false;
    return true;
  });
  if (duplicates.length) {
    if (!silent) {
      showConflict(duplicates, 'Ya existe una regla con la misma combinación de ámbito y vigencia.', { reason: 'duplicate' });
    }
    return false;
  }
  return true;
}

function validateOverlap(payload, { silent = false } = {}) {
  const currentId = state.wizard.mode === 'edit' ? state.wizard.id : null;
  const conflicts = state.rules.filter((rule) => {
    if (!rule.activo) return false;
    if (currentId && rule.id === currentId) return false;
    if (!sameScopeValue(rule.servicio_id, payload.servicio_id)) return false;
    if (!sameScopeValue(rule.plan_id, payload.plan_id)) return false;
    if (!sameScopeValue(rule.rol_aplica, payload.rol_aplica)) return false;
    if (!sameScopeValue(rule.ambito_region, payload.ambito_region)) return false;
    if (!sameScopeValue(rule.metodo_pago, payload.metodo_pago)) return false;
    if (!sameScopeValue(rule.moneda, payload.moneda)) return false;
    return rangesOverlap(rule.vigencia_desde, rule.vigencia_hasta, payload.vigencia_desde, payload.vigencia_hasta);
  });
  if (conflicts.length) {
    if (!silent) {
      showConflict(conflicts, 'La vigencia se solapa con otra regla activa del mismo ámbito.', { reason: 'overlap' });
    }
    return false;
  }
  return true;
}

function showConflict(conflicts, message, { reason = 'conflict' } = {}) {
  if (!dom.wizard.alert) return;
  dom.wizard.alert.classList.remove('d-none');
  dom.wizard.alert.dataset.tcConflictReason = reason;
  const safeMessage = escapeHtml(message || 'Existen reglas en conflicto con la combinación seleccionada.');
  const listItems = (conflicts || [])
    .map((rule) => `<li><strong>${escapeHtml(rule.codigo)}</strong> — ${formatVigencia(rule.vigencia_desde, rule.vigencia_hasta)}</li>`)
    .join('');
  const details = listItems ? `<ul class="mb-2">${listItems}</ul>` : '';
  const content = `
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
      <div>
        <div class="fw-semibold">${safeMessage}</div>
        ${details}
      </div>
      <div class="d-flex gap-2">
        <button type="button" class="btn btn-outline-primary btn-sm" data-tc-action="view-rules">Ver reglas</button>
      </div>
    </div>
  `;
  dom.wizard.alert.innerHTML = content;
}

function hideConflict() {
  if (!dom.wizard.alert) return;
  dom.wizard.alert.classList.add('d-none');
  dom.wizard.alert.innerHTML = '';
  delete dom.wizard.alert.dataset.tcConflictReason;
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
  const servicioId = inputs.servicio.value ? Number(inputs.servicio.value) : null;
  const planId = inputs.plan.value ? Number(inputs.plan.value) : null;
  return {
    servicio_id: Number.isFinite(servicioId) ? servicioId : null,
    plan_id: Number.isFinite(planId) ? planId : null,
    rol_aplica: inputs.rol.value,
    moneda: inputs.moneda.value || state.catalogs.econconfig?.moneda_defecto || null,
    metodo_pago: inputs.metodo.value || null,
    ambito_region: inputs.region.value || null,
    fecha: inputs.fecha.value || new Date().toISOString().substring(0, 10),
    consumo: Number(inputs.consumo.value || 0),
  };
}

async function simulateFromWizard() {
  if (!captureStep1() || !captureStep2()) return;
  const payload = buildRulePayload(state.wizard.data);
  const overrides = {
    servicio_id: payload.servicio_id,
    plan_id: dom.wizard.inputs.step3Plan.value ? Number(dom.wizard.inputs.step3Plan.value) : payload.plan_id,
    rol_aplica: payload.rol_aplica,
    moneda: payload.moneda,
    metodo_pago: dom.wizard.inputs.step3Metodo.value || payload.metodo_pago,
    ambito_region: payload.ambito_region,
    fecha: dom.wizard.inputs.step3Fecha.value || new Date().toISOString().substring(0, 10),
    consumo: Number(dom.wizard.inputs.step3Consumo.value || 0),
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
        <h6 class="fw-semibold mb-1">Regla aplicada: ${escapeHtml(regla.codigo)} — ${escapeHtml(regla.descripcion || 'Sin descripción')}</h6>
        <dl class="row gy-2 mb-0">
          <dt class="col-6 col-sm-5">Subtotal</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.subtotal || 0)}</dd>
          <dt class="col-6 col-sm-5">Impuestos</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.impuestos || 0)}</dd>
          <dt class="col-6 col-sm-5">Total cliente</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.totalCliente || 0)}</dd>
          <dt class="col-6 col-sm-5">Neto abogado</dt>
          <dd class="col-6 col-sm-7 text-end mb-0">${formatter.format(desglose.netoAbogado || 0)}</dd>
        </dl>
        <p class="text-muted small fst-italic mb-0 mt-3">Nota: Redondeo según econconfig.${state.catalogs.econconfig?.regla_redondeo || 'dos_decimales'}.</p>
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

  function createEmptyRule(catalogs) {
    const sourceCatalogs = catalogs !== undefined ? catalogs : state.catalogs;
    const econconfig = sourceCatalogs?.econconfig;
    return {
    codigo: '',
    descripcion: '',
    servicio_id: '',
    plan_id: '',
    rol_aplica: 'ambos',
    moneda: econconfig?.moneda_defecto || '',
    metodo_pago: '',
    ambito_region: '',
    prioridad: '',
    vigencia_desde: '',
    vigencia_hasta: '',
    tipo_calculo: 'fijo',
    valor: '',
    parametros: cloneTemplateFromCatalogs('fijo', sourceCatalogs),
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
    if (!element || !bootstrapLib?.Modal) return null;
    return bootstrapLib.Modal.getOrCreateInstance(element);
  }
  
  function switchView(view) {
    const allowed = ['reglas', 'impuestos', 'econconfig'];
    const normalized = allowed.includes(view) ? view : 'reglas';
    if (state.ui.view !== normalized) {
      state.ui.view = normalized;
    }
    updateViewVisibility();
    if (normalized === 'impuestos') {
      refreshImpuestosList();
    } else if (normalized === 'econconfig') {
      loadEconfig();
    }
  }
  
  function updateViewVisibility() {
    if (dom.views?.containers) {
      dom.views.containers.forEach((container) => {
        const id = container.getAttribute('data-tc-view');
        const isActive = id === state.ui.view;
        container.classList.toggle('d-none', !isActive);
      });
    }
    if (dom.views?.buttons) {
      dom.views.buttons.forEach((button) => {
        const id = button.getAttribute('data-tc-view-button');
        const isActive = id === state.ui.view;
        button.classList.toggle('btn-primary', isActive);
        button.classList.toggle('btn-outline-primary', !isActive);
      });
    }
  }
  
  async function refreshImpuestosList() {
    if (!dom.impuestos?.tableBody) return;
    const estado = dom.impuestos.estado?.value || '';
    try {
      const params = {};
      if (estado) params.estado = estado;
      const response = await apiGet('/impuestos', params);
      const items = Array.isArray(response) ? response : response.items || [];
      state.quick.impuestos = items;
      state.quick.impuestosLoaded = true;
      renderImpuestosTable();
    } catch (error) {
      console.error('Error cargando impuestos:', error);
      window.alert(error.message || 'No se pudieron cargar los impuestos.');
    }
  }
  
  function renderImpuestosTable() {
    const body = dom.impuestos?.tableBody;
    if (!body) return;
    body.innerHTML = '';
    if (!state.quick.impuestos.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 7;
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
        row.classList.add('table-active');
      }
      const porcentaje = Number(imp.porcentaje ?? 0);
      row.innerHTML = `
        <td class="fw-semibold">${escapeHtml(imp.codigo)}</td>
        <td>${escapeHtml(imp.nombre)}</td>
        <td>${porcentaje.toFixed(2)}%</td>
        <td>${imp.incluido_en_precio ? 'Sí' : 'No'}</td>
        <td>${formatVigencia(imp.vigencia_desde, imp.vigencia_hasta)}</td>
        <td><span class="badge ${imp.activo ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}">${imp.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="text-end">
          <div class="btn-group btn-group-sm" role="group">
            <button type="button" class="btn btn-outline-primary" data-action="edit" data-id="${imp.id}">Editar</button>
            <button type="button" class="btn btn-outline-secondary" data-action="toggle" data-id="${imp.id}">${imp.activo ? 'Desactivar' : 'Activar'}</button>
            <button type="button" class="btn btn-outline-secondary" data-action="history" data-id="${imp.id}">Historial</button>
          </div>
        </td>
      `;
      fragment.appendChild(row);
    });
    body.appendChild(fragment);
  }
  
  function handleImpuestoTableClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (!id) return;
    const action = button.dataset.action;
    const impuesto = state.quick.impuestos.find((item) => item.id === id);
    if (!impuesto) return;
    if (action === 'edit') {
      populateImpuestoForm(impuesto);
    } else if (action === 'toggle') {
      toggleImpuestoState(impuesto);
    } else if (action === 'history') {
      showImpuestoHistory(impuesto);
    }
  }
  
  function populateImpuestoForm(impuesto) {
    if (!dom.impuestos?.form) return;
    state.quick.currentImpuestoId = impuesto.id;
    dom.impuestos.id.value = impuesto.id;
    dom.impuestos.codigo.value = impuesto.codigo || '';
    dom.impuestos.nombre.value = impuesto.nombre || '';
    dom.impuestos.porcentaje.value = Number(impuesto.porcentaje ?? 0);
    dom.impuestos.vigenciaDesde.value = impuesto.vigencia_desde ? impuesto.vigencia_desde.substring(0, 10) : '';
    dom.impuestos.vigenciaHasta.value = impuesto.vigencia_hasta ? impuesto.vigencia_hasta.substring(0, 10) : '';
    dom.impuestos.incluido.checked = !!impuesto.incluido_en_precio;
    dom.impuestos.activo.checked = impuesto.activo !== false;
    Array.from(dom.impuestos.tableBody.querySelectorAll('tr')).forEach((row) => {
      row.classList.toggle('table-active', Number(row.dataset.id) === impuesto.id);
    });
  }
  
  function resetImpuestoForm() {
    if (!dom.impuestos?.form) return;
    dom.impuestos.form.reset();
    dom.impuestos.id.value = '';
    dom.impuestos.incluido.checked = false;
    dom.impuestos.activo.checked = true;
    state.quick.currentImpuestoId = null;
    Array.from(dom.impuestos.tableBody?.querySelectorAll('tr') || []).forEach((row) => row.classList.remove('table-active'));
  }
  
  function parseDateInput(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  }
  
  function validateImpuestoPayload(payload, excludeId) {
    const start = parseDateInput(payload.vigencia_desde);
    const end = parseDateInput(payload.vigencia_hasta);
    if (start && end && start > end) {
      return 'La vigencia hasta debe ser posterior a la vigencia desde.';
    }
    if (!payload.activo) {
      return null;
    }
    const overlaps = state.quick.impuestos.some((item) => {
      if (!item.activo) return false;
      if (excludeId && item.id === excludeId) return false;
      const itemStart = parseDateInput(item.vigencia_desde);
      const itemEnd = parseDateInput(item.vigencia_hasta);
      const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY;
      const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;
      const itemStartTime = itemStart ? itemStart.getTime() : Number.NEGATIVE_INFINITY;
      const itemEndTime = itemEnd ? itemEnd.getTime() : Number.POSITIVE_INFINITY;
      return startTime <= itemEndTime && itemStartTime <= endTime;
    });
    if (overlaps) {
      return 'Existe un impuesto activo con vigencia traslapada. Ajusta las fechas o desactiva el existente.';
    }
    return null;
  }
  
  async function submitImpuestoForm(event) {
    event.preventDefault();
    if (!dom.impuestos?.form) return;
    const id = dom.impuestos.id.value ? Number(dom.impuestos.id.value) : null;
    const codigo = dom.impuestos.codigo.value.trim();
    const nombre = dom.impuestos.nombre.value.trim();
    const porcentajeValue = dom.impuestos.porcentaje.value;
    if (!codigo || !nombre) {
      window.alert('Código y nombre son obligatorios.');
      return;
    }
    if (porcentajeValue === '' || Number(porcentajeValue) < 0) {
      window.alert('El porcentaje debe ser mayor o igual a 0.');
      return;
    }
    const payload = {
      codigo,
      nombre,
      porcentaje: Number(porcentajeValue),
      incluido_en_precio: dom.impuestos.incluido.checked,
      activo: dom.impuestos.activo.checked,
      vigencia_desde: dom.impuestos.vigenciaDesde.value || null,
      vigencia_hasta: dom.impuestos.vigenciaHasta.value || null,
    };
    const validationMessage = validateImpuestoPayload(payload, id);
    if (validationMessage) {
      window.alert(validationMessage);
      return;
    }
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
  
  async function toggleImpuestoState(impuesto) {
    const nextState = !impuesto.activo;
    const confirmed = window.confirm(`¿Desea ${nextState ? 'activar' : 'desactivar'} el impuesto ${impuesto.codigo}?`);
    if (!confirmed) return;
    try {
      await apiPut(`/impuestos/${impuesto.id}`, { activo: nextState });
      await Promise.all([refreshImpuestosList(), loadCatalogs()]);
      window.alert(`Impuesto ${nextState ? 'activado' : 'desactivado'} correctamente`);
      if (state.quick.currentImpuestoId === impuesto.id) {
        const updated = state.quick.impuestos.find((item) => item.id === impuesto.id);
        if (updated) {
          populateImpuestoForm(updated);
        }
      }
    } catch (error) {
      console.error('Error actualizando impuesto:', error);
      window.alert(error.message || 'No se pudo actualizar el impuesto.');
    }
  }
  
  function showImpuestoHistory(impuesto) {
    if (!dom.impuestos?.historyContent) return;
    const creado = impuesto.creado_el ? formatDateTime(impuesto.creado_el) : 'Sin registro';
    dom.impuestos.historyContent.innerHTML = `
      <dl class="row mb-0">
        <dt class="col-5">Código</dt><dd class="col-7">${escapeHtml(impuesto.codigo)}</dd>
        <dt class="col-5">Nombre</dt><dd class="col-7">${escapeHtml(impuesto.nombre)}</dd>
        <dt class="col-5">Porcentaje</dt><dd class="col-7">${Number(impuesto.porcentaje ?? 0).toFixed(2)}%</dd>
        <dt class="col-5">Incluido en precio</dt><dd class="col-7">${impuesto.incluido_en_precio ? 'Sí' : 'No'}</dd>
        <dt class="col-5">Vigencia</dt><dd class="col-7">${formatVigencia(impuesto.vigencia_desde, impuesto.vigencia_hasta)}</dd>
        <dt class="col-5">Estado</dt><dd class="col-7">${impuesto.activo ? 'Activo' : 'Inactivo'}</dd>
        <dt class="col-5">Creado el</dt><dd class="col-7">${creado}</dd>
      </dl>
    `;
    const modal = getBootstrapModal(dom.impuestos.historyModal);
    modal?.show();
  }
  
  async function loadEconfig() {
    try {
      const response = await apiGet('/econconfig');
      const config = response?.config || response || null;
      state.quick.econconfig = config;
      populateEconfigForm(config);
    } catch (error) {
      console.error('Error obteniendo econconfig:', error);
      window.alert(error.message || 'No se pudo cargar la configuración económica.');
    }
  }
  
  function populateEconfigForm(config) {
    if (!dom.econconfig?.form) return;
    const fallback = state.catalogs.econconfig || {};
    const current = config || state.quick.econconfig || fallback || {};
    dom.econconfig.moneda.value = current.moneda_defecto || '';
    dom.econconfig.decimales.value = current.decimales ?? 2;
    dom.econconfig.regla.value = current.regla_redondeo || 'dos_decimales';
    dom.econconfig.activo.checked = current.activo !== false;
    if (dom.econconfig.updatedLabel) {
      dom.econconfig.updatedLabel.textContent = current.actualizado_el
        ? `Actualizado el ${formatDateTime(current.actualizado_el)}`
        : 'Sin actualizaciones registradas';
    }
    updateEconfigPreview();
  }
  
  function updateEconfigPreview() {
    if (!dom.econconfig?.previewResult) return;
    const rawValue = dom.econconfig.previewInput?.value;
    if (!rawValue) {
      dom.econconfig.previewResult.textContent = '—';
      return;
    }
    const number = Number(rawValue);
    if (Number.isNaN(number)) {
      dom.econconfig.previewResult.textContent = 'Valor inválido';
      return;
    }
    const config = {
      decimales: Number(dom.econconfig.decimales?.value ?? 2),
      regla_redondeo: dom.econconfig.regla?.value || 'dos_decimales',
    };
    const rounded = applyPreviewRounding(number, config);
    dom.econconfig.previewResult.textContent = Number.isFinite(rounded)
      ? rounded.toFixed(config.decimales ?? 2)
      : '—';
  }
  
  function applyPreviewRounding(value, config) {
    if (!config) return Number((value ?? 0).toFixed(2));
    const decimales = Number.isInteger(config.decimales) ? config.decimales : 2;
    const regla = config.regla_redondeo || 'dos_decimales';
    const factor = 10 ** decimales;
    const raw = Number(value ?? 0);
    if (Number.isNaN(raw)) return 0;
    switch (regla) {
      case 'a_0_05':
        return Math.ceil(raw * 20) / 20;
      case 'entero_superior':
        return Math.ceil(raw);
      case 'dos_decimales':
      default:
        return Math.round(raw * factor) / factor;
    }
  }
  
  async function submitEconfigForm(event) {
    event.preventDefault();
    if (!dom.econconfig?.form) return;
    const moneda = dom.econconfig.moneda.value.trim().toUpperCase();
    const decimalesValue = dom.econconfig.decimales.value;
    const regla = dom.econconfig.regla.value;
    const activo = dom.econconfig.activo.checked;
    if (!moneda || moneda.length !== 3) {
      window.alert('La moneda debe tener 3 caracteres.');
      return;
    }
    const decimales = Number(decimalesValue);
    if (!Number.isInteger(decimales) || decimales < 0 || decimales > 6) {
      window.alert('Los decimales deben ser un número entre 0 y 6.');
      return;
    }
    const payload = {
      moneda_defecto: moneda,
      decimales,
      regla_redondeo: regla,
      activo,
    };
    try {
      const response = await apiPut('/econconfig', payload);
      const config = response?.config || payload;
      state.catalogs.econconfig = config;
      state.quick.econconfig = config;
      populateCatalogSelects();
      hydrateSimulatorInputs();
      populateEconfigForm(config);
      window.alert('Configuración guardada correctamente');
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

function exportExcel() {
    if (!state.rules.length) {
      window.alert('No hay reglas para exportar.');
      return;
    }
    const headers = ['Código', 'Descripción', 'Servicio', 'Plan', 'Rol', 'Moneda', 'Método de pago', 'Región', 'Tipo de cálculo', 'Vigencia desde', 'Vigencia hasta', 'Prioridad', 'Activo'];
    const rows = state.rules.map((rule) => [
      rule.codigo,
      rule.descripcion || '',
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
      rule.activo ? 'Sí' : 'No',
    ]);
    const headerRow = `<tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>`;
    const bodyRows = rows
      .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`)
      .join('');
    const tableHtml = `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
    const blob = new Blob(['\ufeff' + tableHtml], {
      type: 'application/vnd.ms-excel;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tarifas_${new Date().toISOString().substring(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
