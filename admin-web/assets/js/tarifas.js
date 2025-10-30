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

const SCOPE_TYPES = {
  PLAN_SERVICIO: 'plan-servicio',
  SERVICIO: 'servicio',
  PLAN: 'plan',
};

const DOCS_TARIFAS_URL =
  (typeof window !== 'undefined' && window.LEGALBOT_DOCS_TARIFAS_URL) ||
  'https://docs.legalbot.app/admin/tarifas-y-comisiones';

function createEmptyScopeFilters() {
  return {
    estado: '',
    servicio: '',
    plan: '',
  };
}

const state = {
  ready: false,
  monedaFallback: 'PEN',
  tabs: 'tarifas',
  tarifas: {
    items: [],
    filters: createEmptyScopeFilters(),
    pendingFilters: createEmptyScopeFilters(),
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  comisiones: {
    items: [],
    filters: createEmptyScopeFilters(),
    pendingFilters: createEmptyScopeFilters(),
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  simulator: {
    loading: false,
    result: null,
    inputs: {
      ambito: 'servicio',
      planId: null,
      servicioId: null,
      consumoIa: 0,
      tarifaId: null,
      comisiones: {
        clienteId: null,
        abogadoId: null,
      },
      comisionSeleccion: 'auto',
      moneda: null,
    },
    meta: {
      tipoCalculo: null,
      requiresConsumoIa: false,
      showMonedaSelect: false,
      autoComisiones: { clienteId: null, abogadoId: null },
    },
    options: {
      tarifas: [],
      comisiones: {
        cliente: [],
        abogado: [],
      },
      monedas: [],
    },
  },
  quick: {
    impuestos: [],
    econconfig: null,
    impuestoCache: new Map(),
    comisionesCache: new Map(),
    tarifasCache: new Map(),
  },
  econconfigForm: {
    mode: 'update',
  },
  catalogs: {
    planes: [],
    servicios: [],
    planServicios: [],
    planAssignments: new Map(),
    ready: false,
    loading: {
      planes: null,
      servicios: null,
      planAssignments: new Map(),
    },
  },
  dom: {},
};

/**
 * ------------------------------
 * Inicialización principal
 * ------------------------------
 */

document.addEventListener('DOMContentLoaded', () => {
  setupLayout();
  init();
});

function setupLayout() {
  const main = document.querySelector('main');
  if (!main || document.getElementById('tarifas-layout')) return;

  const layout = `
    <div class="d-flex flex-column gap-3" id="tarifas-layout">
      <section class="card shadow-sm border-0 compact-card">
        <div class="card-body py-3 px-3 d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2">
          <div>
            <h2 class="fs-4 fw-semibold mb-1">Tarifas &amp; Comisiones</h2>
            <p class="text-muted small mb-0">Administra las reglas económicas, comisiones e impuestos de LegalBot.</p>
          </div>
          <div class="d-flex flex-wrap gap-2 justify-content-end" id="tarifas-header-actions">
            <button type="button" class="btn btn-outline-primary btn-sm" id="tarifas-simulator-btn">Simulador de reglas</button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              id="tarifas-export-btn"
              data-scope="tarifas"
            >
              Exportar tarifas
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              id="tarifas-new-btn"
              data-scope="tarifas"
            >
              Nueva tarifa
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm d-none"
              id="comisiones-export-btn"
              data-scope="comisiones"
            >
              Exportar comisión
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm d-none"
              id="comisiones-new-btn"
              data-scope="comisiones"
            >
              Nueva comisión
            </button>
          </div>
        </div>
      </section>

      <section class="card shadow-sm border-0 compact-card">
        <div class="card-body py-2 px-3 d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary btn-sm" data-lb-tab="tarifas">Tarifas</button>
          <button type="button" class="btn btn-outline-primary btn-sm" data-lb-tab="comisiones">Comisiones</button>
          <button type="button" class="btn btn-outline-primary btn-sm" data-lb-tab="impuestos">Impuestos</button>
          <button type="button" class="btn btn-outline-primary btn-sm" data-lb-tab="econconfig">Config. económica</button>
        </div>
      </section>

      <div id="tarifas-help-banner"></div>

      <div data-lb-view="tarifas" class="d-flex flex-column gap-3">
        <section class="card shadow-sm border-0 compact-card filters-card">
          <div class="card-body py-3 px-3">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <h2 class="fs-6 text-uppercase text-muted mb-0">Filtros de tarifas</h2>
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="tarifas-filter-reset">Limpiar</button>
                <button type="button" class="btn btn-primary btn-sm" id="tarifas-filter-apply">Aplicar filtros</button>
              </div>
            </div>
            <div class="row g-2 align-items-end">
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="tarifas-filter-estado" class="form-label">Estado</label>
                <select id="tarifas-filter-estado" class="form-select form-select-sm">
                  <option value="activas">Activas</option>
                  <option value="inactivas">Inactivas</option>
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="tarifas-filter-servicio" class="form-label">Servicio</label>
                <input
                  type="text"
                  class="form-control form-control-sm"
                  id="tarifas-filter-servicio"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="tarifas-filter-plan" class="form-label">Plan</label>
                <input
                  type="text"
                  class="form-control form-control-sm"
                  id="tarifas-filter-plan"
                  placeholder="Nombre o ID"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="card shadow-sm border-0">
          <div class="card-header bg-white border-0">
            <div>
              <h5 class="card-title mb-0">Listado de tarifas</h5>
              <p class="text-muted small mb-0">Gestiona reglas por servicio o plan.</p>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Descripción</th>
                    <th>Ámbito</th>
                    <th>Importe</th>
                    <th>Tipo cálculo</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th>Actualizado</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody id="tarifas-table-body">
                  <tr>
                    <td colspan="8" class="text-center py-4 text-muted">Cargando tarifas...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card-footer bg-white border-0">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div class="d-flex align-items-center gap-2">
                <label for="tarifas-rows-per-page" class="form-label mb-0">Filas por página</label>
                <select id="tarifas-rows-per-page" class="form-select form-select-sm" style="max-width: 120px;">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div id="tarifas-pagination" class="d-flex flex-wrap gap-2 justify-content-md-end"></div>
            </div>
          </div>
        </section>

        
      </div>

      <div data-lb-view="comisiones" class="d-none d-flex flex-column gap-3">
        <section class="card shadow-sm border-0 compact-card filters-card">
          <div class="card-body py-3 px-3">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div>
                <h2 class="fs-6 text-uppercase text-muted mb-1">Filtros de comisiones</h2>
                <p class="text-muted small mb-0">Define porcentajes por servicio o plan y consulta su estado.</p>
              </div>
              <div class="d-flex flex-wrap gap-2">
                <button type="button" class="btn btn-outline-secondary btn-sm" id="comisiones-filter-reset">Limpiar</button>
                <button type="button" class="btn btn-primary btn-sm" id="comisiones-filter-apply">Aplicar filtros</button>
              </div>
            </div>
            <div class="row g-2 align-items-end">
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="comisiones-filter-estado" class="form-label">Estado</label>
                <select id="comisiones-filter-estado" class="form-select form-select-sm">
                  <option value="activas">Activas</option>
                  <option value="inactivas">Inactivas</option>
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="comisiones-filter-servicio" class="form-label">Servicio</label>
                <input
                  type="text"
                  id="comisiones-filter-servicio"
                  class="form-control form-control-sm"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 col-sm-6 col-lg-3">
                <label for="comisiones-filter-plan" class="form-label">Plan</label>
                <input
                  type="text"
                  id="comisiones-filter-plan"
                  class="form-control form-control-sm"
                  placeholder="Nombre o ID"
                />
              </div>
            </div>
          </div>
        </section>

        <section class="card shadow-sm border-0">
          <div class="card-header bg-white border-0">
            <div>
              <h5 class="card-title mb-0">Listado de comisiones</h5>
              <p class="text-muted small mb-0">Controla las comisiones aplicadas a cada rol.</p>
            </div>
          </div>
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover align-middle mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Descripción</th>
                    <th>Ámbito</th>
                    <th>Rol</th>
                    <th>Porcentaje</th>
                    <th>Vigencia</th>
                    <th>Estado</th>
                    <th>Actualizado</th>
                    <th class="text-end">Acciones</th>
                  </tr>
                </thead>
                <tbody id="comisiones-table-body">
                  <tr>
                    <td colspan="8" class="text-center py-4 text-muted">Cargando comisiones...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="card-footer bg-white border-0">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div class="d-flex align-items-center gap-2">
                <label for="comisiones-rows-per-page" class="form-label mb-0">Filas por página</label>
                <select id="comisiones-rows-per-page" class="form-select form-select-sm" style="max-width: 120px;">
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div id="comisiones-pagination" class="d-flex flex-wrap gap-2 justify-content-md-end"></div>
            </div>
          </div>
        </section>
      </div>

      <div data-lb-view="impuestos" class="d-none">
        <div class="row g-4">
          <div class="col-12 col-xl-7">
            <section class="card shadow-sm border-0 h-100">
              <div class="card-header bg-white border-0 d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center">
                <div>
                  <h5 class="card-title mb-0">Lista de impuestos</h5>
                  <small class="text-muted">Vigencias, porcentajes y estado actual.</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <label for="tc-impuestos-estado" class="form-label mb-0">Estado</label>
                  <select id="tc-impuestos-estado" class="form-select form-select-sm" style="min-width: 160px;">
                    <option value="">Todos</option>
                    <option value="true">Activos</option>
                    <option value="false">Inactivos</option>
                  </select>
                </div>
              </div>
              <div class="card-body p-0">
                <div class="table-responsive">
                  <table class="table table-hover align-middle mb-0" id="tc-impuestos-table">
                    <thead class="table-light">
                      <tr>
                        <th>Código</th>
                        <th>Nombre</th>
                        <th>%</th>
                        <th>Vigencia</th>
                        <th>Activo</th>
                      </tr>
                    </thead>
                    <tbody id="tc-impuestos-table-body"></tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-5">
            <section class="card shadow-sm border-0 h-100">
              <div class="card-body">
                <h5 class="card-title">Registrar / editar impuesto</h5>
                <p class="text-muted small">Validamos automáticamente solapes de vigencia para impuestos activos.</p>
                <form id="tc-impuestos-form" class="row g-3" autocomplete="off">
                  <input type="hidden" id="tc-impuestos-id" />
                  <div class="col-12">
                    <label for="tc-impuestos-codigo" class="form-label">Código <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="tc-impuestos-codigo" required />
                  </div>
                  <div class="col-12">
                    <label for="tc-impuestos-nombre" class="form-label">Nombre <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="tc-impuestos-nombre" required />
                  </div>
                  <div class="col-12 col-sm-6">
                    <label for="tc-impuestos-porcentaje" class="form-label">Porcentaje (%) <span class="text-danger">*</span></label>
                    <input type="number" class="form-control" id="tc-impuestos-porcentaje" min="0" step="0.01" required />
                  </div>
                  <div class="col-12 col-sm-6">
                    <label for="tc-impuestos-vigencia-desde" class="form-label">Vigencia desde</label>
                    <input type="date" class="form-control" id="tc-impuestos-vigencia-desde" />
                  </div>
                  <div class="col-12 col-sm-6">
                    <label for="tc-impuestos-vigencia-hasta" class="form-label">Vigencia hasta</label>
                    <input type="date" class="form-control" id="tc-impuestos-vigencia-hasta" />
                  </div>
                  <div class="col-12">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" role="switch" id="tc-impuestos-activo" checked />
                      <label class="form-check-label" for="tc-impuestos-activo">Activo</label>
                    </div>
                  </div>
                  <div class="col-12 d-flex justify-content-between gap-2">
                    <button type="button" class="btn btn-outline-secondary" id="tc-impuestos-reset">Limpiar</button>
                    <button type="submit" class="btn btn-primary">Guardar</button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div data-lb-view="econconfig" class="d-none">
        <div class="row g-3 align-items-stretch">
          <div class="col-12 col-xl-7">
            <section class="card shadow-sm border-0 h-100">
              <div class="card-body d-flex flex-column gap-3">
                <div class="d-flex flex-column flex-lg-row justify-content-between gap-3">
                  <div>
                    <h5 class="card-title mb-1">Configuración económica</h5>
                    <p class="text-muted small mb-0">Revisa la configuración activa y sus reglas de redondeo.</p>
                  </div>
                  <div class="text-muted small text-lg-end" id="tc-econfig-actualizado">&nbsp;</div>
                </div>
                <div id="tc-econfig-summary" class="flex-grow-1"></div>
              </div>
            </section>
          </div>
          <div class="col-12 col-xl-5">
            <section class="card shadow-sm border-0 h-100">
              <div class="card-body d-flex flex-column gap-3">
                <div class="btn-group" role="group" id="tc-econfig-mode-group">
                  <button type="button" class="btn btn-outline-primary active" data-econfig-mode="update">
                    Editar configuración activa
                  </button>
                  <button type="button" class="btn btn-outline-secondary" data-econfig-mode="create">
                    Nueva configuración
                  </button>
                </div>
                <form id="tc-econfig-form" class="row g-3" autocomplete="off">
                  <div class="col-12 col-md-6">
                    <label for="tc-econfig-moneda" class="form-label">Moneda por defecto <span class="text-danger">*</span></label>
                    <input type="text" class="form-control" id="tc-econfig-moneda" maxlength="3" required />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="tc-econfig-decimales" class="form-label">Decimales <span class="text-danger">*</span></label>
                    <input type="number" class="form-control" id="tc-econfig-decimales" min="0" max="6" required />
                  </div>
                  <div class="col-12">
                    <label for="tc-econfig-regla" class="form-label">Regla de redondeo</label>
                    <select id="tc-econfig-regla" class="form-select">
                      <option value="dos_decimales">Dos decimales (0.00)</option>
                      <option value="a_0_05">Múltiplo de 0.05</option>
                      <option value="entero_superior">Entero superior</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" role="switch" id="tc-econfig-activo" checked />
                      <label class="form-check-label" for="tc-econfig-activo">Configuración activa</label>
                    </div>
                  </div>
                  <div class="col-12">
                    <label for="tc-econfig-preview" class="form-label">Previsualización de redondeo</label>
                    <div class="input-group">
                      <input type="number" class="form-control" id="tc-econfig-preview" step="0.01" placeholder="Importe base" />
                      <span class="input-group-text" id="tc-econfig-preview-result">—</span>
                    </div>
                    <small class="text-muted">Introduce un importe para ver cómo se aplica la regla seleccionada.</small>
                  </div>
                  <div class="col-12 d-flex justify-content-end gap-2">
                    <button type="submit" class="btn btn-primary" id="tc-econfig-submit">Guardar cambios</button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  `;

  main.innerHTML = layout;

  if (!document.getElementById('tarifas-form-modal')) {
    const modals = `
      <div class="modal fade" id="tarifas-form-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" data-modal-title>Nueva tarifa</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <form id="tarifas-form">
              <div class="modal-body overflow-y-auto" style="max-height: 70vh;">
                <div class="row g-3">
                  <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="form-label mb-0">Ámbito de aplicación</label>
                      <span class="text-muted small">Selecciona el ámbito de aplicación.</span>
                    </div>
                    <input type="hidden" name="scope_tipo" id="tarifas-form-scope" />
                    <div
                      class="btn-group w-100 flex-column flex-lg-row"
                      role="group"
                      data-scope-options="tarifa"
                    >
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="tarifa"
                        data-scope-value="plan-servicio"
                      >
                        <i class="bi bi-diagram-3"></i>
                        <span class="fw-semibold">Plan + Servicio</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="tarifa"
                        data-scope-value="servicio"
                      >
                        <i class="bi bi-box-seam"></i>
                        <span class="fw-semibold">Solo servicio</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="tarifa"
                        data-scope-value="plan"
                      >
                        <i class="bi bi-grid-3x3-gap"></i>
                        <span class="fw-semibold">Solo plan</span>
                      </button>
                    </div>
                    <p class="form-text mb-1">
                      Define si la tarifa aplica a un plan con un servicio específico, únicamente a un servicio o al plan completo.
                    </p>
                    <div class="invalid-feedback d-block d-none" data-scope-error="tarifa">
                      Selecciona un ámbito para continuar.
                    </div>
                  </div>
                  <div class="col-12 col-md-6 d-none" data-scope-plan-group="tarifa">
                    <label for="tarifas-form-plan" class="form-label">Plan</label>
                    <select id="tarifas-form-plan" name="plan_id" class="form-select">
                      <option value="">Selecciona un plan</option>
                    </select>
                  </div>
                  <div class="col-12 col-md-6 d-none" data-scope-servicio-group="tarifa">
                    <label for="tarifas-form-servicio" class="form-label">Servicio</label>
                    <select id="tarifas-form-servicio" name="servicio_id" class="form-select" disabled>
                      <option value="">Selecciona un servicio</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label for="tarifas-form-descripcion" class="form-label">Descripción</label>
                    <input
                      type="text"
                      id="tarifas-form-descripcion"
                      name="descripcion"
                      class="form-control"
                      placeholder="Describe la regla"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="tarifas-form-valor" class="form-label">Valor</label>
                    <input
                      type="number"
                      id="tarifas-form-valor"
                      name="valor"
                      class="form-control"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="tarifas-form-tipo" class="form-label">Tipo de cálculo</label>
                    <select id="tarifas-form-tipo" name="tipo_calculo" class="form-select">
                      <option value="fijo">Fijo</option>
                      <option value="consumo_ia">Consumo IA</option>
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <div class="form-check form-switch mt-md-4 pt-md-2">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="tarifas-form-incluye-impuesto"
                        name="incluye_impuesto"
                      />
                      <label class="form-check-label" for="tarifas-form-incluye-impuesto">Incluye impuesto</label>
                    </div>
                  </div>
                  <div class="col-12" data-json-group>
                    <label for="tarifas-form-parametros" class="form-label">Parámetros (JSON)</label>
                    <textarea
                      id="tarifas-form-parametros"
                      name="parametros"
                      class="form-control"
                      rows="5"
                      spellcheck="false"
                      placeholder="{ }"
                    ></textarea>
                    <div class="form-text">Solo requerido para reglas basadas en consumo.</div>
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="tarifas-form-desde" class="form-label">Vigencia desde</label>
                    <input type="date" id="tarifas-form-desde" name="vigencia_desde" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="tarifas-form-hasta" class="form-label">Vigencia hasta</label>
                    <input type="date" id="tarifas-form-hasta" name="vigencia_hasta" class="form-control" />
                  </div>
                  <div class="col-12">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="tarifas-form-activo" name="activo" />
                      <label class="form-check-label" for="tarifas-form-activo">Activo</label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar tarifa</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal fade" id="tarifas-conflict-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Conflicto de vigencia</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              La nueva tarifa se solapa con otra activa. ¿Cómo deseas continuar?
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-conflict-action="cancelar">Cancelar</button>
              <button type="button" class="btn btn-outline-danger" data-conflict-action="desactivar">Desactivar existente</button>
              <button type="button" class="btn btn-primary" data-conflict-action="cerrar">Cerrar vigencia anterior</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" id="simulator-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Simulador de reglas</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted">Completa los datos para estimar montos para cliente y abogado.</p>
              <form id="simulator-form" class="row g-3" autocomplete="off">
                <div class="col-12 col-lg-4">
                  <label for="simulator-ambito" class="form-label">Ámbito</label>
                  <select id="simulator-ambito" name="ambito" class="form-select">
                    <option value="servicio">Servicio</option>
                    <option value="plan">Plan</option>
                    <option value="plan-servicio">Plan + Servicio</option>
                    <option value="general">General</option>
                  </select>
                  <div
                    class="invalid-feedback d-block d-none"
                    id="simulator-scope-error"
                    data-default-message="Selecciona el ámbito y los identificadores requeridos."
                  >
                    Selecciona el ámbito y los identificadores requeridos.
                  </div>
                </div>
                <div class="col-12 col-md-6 d-none" data-simulator-plan-group>
                  <label for="simulator-plan" class="form-label">Plan</label>
                  <select id="simulator-plan" name="plan_id" class="form-select">
                    <option value="">Selecciona un plan</option>
                  </select>
                </div>
                <div class="col-12 col-md-6 d-none" data-simulator-servicio-group>
                  <label for="simulator-servicio" class="form-label">Servicio</label>
                  <select id="simulator-servicio" name="servicio_id" class="form-select" disabled>
                    <option value="">Selecciona un servicio</option>
                  </select>
                </div>
                <div class="col-12 col-lg-4" data-simulator-tarifa-group>
                  <label for="simulator-tarifa" class="form-label">Tarifa vigente</label>
                  <select id="simulator-tarifa" name="tarifa_id" class="form-select">
                    <option value="">Selecciona un ámbito para cargar tarifas</option>
                  </select>
                  <div class="invalid-feedback d-block d-none" id="simulator-tarifa-error">
                    No hay tarifa vigente para esta operación
                  </div>
                </div>
                <div class="col-12 col-lg-4" data-simulator-comision-group>
                  <label for="simulator-comision" class="form-label">Comisión vigente</label>
                  <select id="simulator-comision" name="comision_id" class="form-select" disabled>
                    <option value="">Selecciona un ámbito para cargar comisiones</option>
                  </select>
                </div>
                <div class="col-12 col-md-6 d-none" data-simulator-moneda-group>
                  <label for="simulator-moneda" class="form-label">Moneda</label>
                  <select id="simulator-moneda" name="moneda" class="form-select"></select>
                </div>
                <div class="col-12 col-md-6 d-none" data-simulator-consumo-ia-group>
                  <label for="simulator-consumo-ia" class="form-label">Consumo IA</label>
                  <input
                    type="number"
                    id="simulator-consumo-ia"
                    name="consumo_ia"
                    class="form-control"
                    min="0"
                    step="0.01"
                    placeholder="0"
                  />
                </div>
                <div class="col-12 d-flex justify-content-end">
                  <button type="submit" class="btn btn-primary">Simular</button>
                </div>
              </form>
              <div id="simulator-loading" class="text-center py-4 d-none">Generando simulación...</div>
              <div id="simulator-result" class="mt-3"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" id="comisiones-form-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-scrollable modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" data-modal-title>Nueva comisión</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <form id="comisiones-form">
              <div class="modal-body overflow-y-auto" style="max-height: 70vh;">
                <div class="row g-3">
                  <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                      <label class="form-label mb-0">Ámbito de aplicación</label>
                      <span class="text-muted small">Selecciona el ámbito de aplicación.</span>
                    </div>
                    <input type="hidden" name="scope_tipo" id="comisiones-form-scope" />
                    <div
                      class="btn-group w-100 flex-column flex-lg-row"
                      role="group"
                      data-scope-options="comision"
                    >
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="comision"
                        data-scope-value="plan-servicio"
                      >
                        <i class="bi bi-diagram-3"></i>
                        <span class="fw-semibold">Plan + Servicio</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="comision"
                        data-scope-value="servicio"
                      >
                        <i class="bi bi-box-seam"></i>
                        <span class="fw-semibold">Solo servicio</span>
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-secondary flex-fill d-flex align-items-center justify-content-center gap-2 py-3"
                        data-scope-option="comision"
                        data-scope-value="plan"
                      >
                        <i class="bi bi-grid-3x3-gap"></i>
                        <span class="fw-semibold">Solo plan</span>
                      </button>
                    </div>
                    <p class="form-text mb-1">
                      Define si la comisión se aplica a un plan con servicio, únicamente a un servicio o al plan completo.
                    </p>
                    <div class="invalid-feedback d-block d-none" data-scope-error="comision">
                      Selecciona un ámbito para continuar.
                    </div>
                  </div>
                  <div class="col-12 col-md-6 d-none" data-scope-plan-group="comision">
                    <label for="comisiones-form-plan" class="form-label">Plan</label>
                    <select id="comisiones-form-plan" name="plan_id" class="form-select">
                      <option value="">Selecciona un plan</option>
                    </select>
                  </div>
                  <div class="col-12 col-md-6 d-none" data-scope-servicio-group="comision">
                    <label for="comisiones-form-servicio" class="form-label">Servicio</label>
                    <select id="comisiones-form-servicio" name="servicio_id" class="form-select" disabled>
                      <option value="">Selecciona un servicio</option>
                    </select>
                  </div>
                  <div class="col-12">
                    <label for="comisiones-form-descripcion" class="form-label">Descripción</label>
                    <input
                      type="text"
                      id="comisiones-form-descripcion"
                      name="descripcion"
                      class="form-control"
                      placeholder="Describe la comisión"
                    />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="comisiones-form-rol" class="form-label">Rol aplica</label>
                    <select id="comisiones-form-rol" name="rol_aplica" class="form-select">
                      <option value="cliente">Cliente</option>
                      <option value="abogado">Abogado</option>
                    </select>
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="comisiones-form-porcentaje" class="form-label">Porcentaje</label>
                    <input type="number" id="comisiones-form-porcentaje" name="porcentaje" class="form-control" min="0" step="0.01" required />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="comisiones-form-desde" class="form-label">Vigencia desde</label>
                    <input type="date" id="comisiones-form-desde" name="vigencia_desde" class="form-control" />
                  </div>
                  <div class="col-12 col-md-6">
                    <label for="comisiones-form-hasta" class="form-label">Vigencia hasta</label>
                    <input type="date" id="comisiones-form-hasta" name="vigencia_hasta" class="form-control" />
                  </div>
                  <div class="col-12">
                    <div class="form-check form-switch">
                      <input class="form-check-input" type="checkbox" id="comisiones-form-activo" name="activo" />
                      <label class="form-check-label" for="comisiones-form-activo">Activo</label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar comisión</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal fade" id="comisiones-conflict-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Conflicto de comisión</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">
              La nueva comisión se superpone con otra activa. Elige cómo proceder.
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-conflict-action="cancelar">Cancelar</button>
              <button type="button" class="btn btn-outline-danger" data-conflict-action="desactivar">Desactivar existente</button>
              <button type="button" class="btn btn-primary" data-conflict-action="cerrar">Cerrar vigencia anterior</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal fade" id="tc-impuestos-history-modal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Historial del impuesto</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body" id="tc-impuestos-history-content"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modals);
  }
}

async function init() {
  cacheDom();
  bindGlobalEvents();
  await Promise.all([
    loadTarifaCatalogs(),
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

  dom.header = {
    actions: document.getElementById('tarifas-header-actions'),
    tarifasButtons: document.querySelectorAll('#tarifas-header-actions [data-scope="tarifas"]'),
    comisionesButtons: document.querySelectorAll('#tarifas-header-actions [data-scope="comisiones"]'),
  };

  dom.tarifas = {
    tableBody: document.getElementById('tarifas-table-body'),
    filters: {
      estado: document.getElementById('tarifas-filter-estado'),
      servicio: document.getElementById('tarifas-filter-servicio'),
      plan: document.getElementById('tarifas-filter-plan'),
      reset: document.getElementById('tarifas-filter-reset'),
      apply: document.getElementById('tarifas-filter-apply'),
    },
    paginator: document.getElementById('tarifas-pagination'),
    rowsPerPage: document.getElementById('tarifas-rows-per-page'),
    newButton: document.getElementById('tarifas-new-btn'),
    exportBtn: document.getElementById('tarifas-export-btn'),
    conflictModal: document.getElementById('tarifas-conflict-modal'),
    conflictResolveButtons: document.querySelectorAll(
      '#tarifas-conflict-modal [data-conflict-action]'
    ),
    formModal: document.getElementById('tarifas-form-modal'),
    form: document.getElementById('tarifas-form'),
  };

  if (dom.tarifas.form) {
    const form = dom.tarifas.form;
    dom.tarifas.scope = {
      hidden: form.querySelector('#tarifas-form-scope'),
      options: form.querySelectorAll('[data-scope-option="tarifa"]'),
      planGroup: form.querySelector('[data-scope-plan-group="tarifa"]'),
      servicioGroup: form.querySelector('[data-scope-servicio-group="tarifa"]'),
      planSelect: form.querySelector('#tarifas-form-plan'),
      servicioSelect: form.querySelector('#tarifas-form-servicio'),
      error: form.querySelector('[data-scope-error="tarifa"]'),
    };
  }

  dom.comisiones = {
    tableBody: document.getElementById('comisiones-table-body'),
    filters: {
      estado: document.getElementById('comisiones-filter-estado'),
      servicio: document.getElementById('comisiones-filter-servicio'),
      plan: document.getElementById('comisiones-filter-plan'),
      reset: document.getElementById('comisiones-filter-reset'),
      apply: document.getElementById('comisiones-filter-apply'),
    },
    paginator: document.getElementById('comisiones-pagination'),
    rowsPerPage: document.getElementById('comisiones-rows-per-page'),
    newButton: document.getElementById('comisiones-new-btn'),
    exportBtn: document.getElementById('comisiones-export-btn'),
    conflictModal: document.getElementById('comisiones-conflict-modal'),
    conflictResolveButtons: document.querySelectorAll(
      '#comisiones-conflict-modal [data-conflict-action]'
    ),
    formModal: document.getElementById('comisiones-form-modal'),
    form: document.getElementById('comisiones-form'),
  };

  if (dom.comisiones.form) {
    const form = dom.comisiones.form;
    dom.comisiones.scope = {
      hidden: form.querySelector('#comisiones-form-scope'),
      options: form.querySelectorAll('[data-scope-option="comision"]'),
      planGroup: form.querySelector('[data-scope-plan-group="comision"]'),
      servicioGroup: form.querySelector('[data-scope-servicio-group="comision"]'),
      planSelect: form.querySelector('#comisiones-form-plan'),
      servicioSelect: form.querySelector('#comisiones-form-servicio'),
      error: form.querySelector('[data-scope-error="comision"]'),
    };
  }

  dom.simulator = {
    open: document.getElementById('tarifas-simulator-btn'),
    modal: document.getElementById('simulator-modal'),
    form: document.getElementById('simulator-form'),
    result: document.getElementById('simulator-result'),
    loading: document.getElementById('simulator-loading'),
    ambito: document.getElementById('simulator-ambito'),
    consumoIa: document.getElementById('simulator-consumo-ia'),
    planSelect: document.getElementById('simulator-plan'),
    servicioSelect: document.getElementById('simulator-servicio'),
    tarifaSelect: document.getElementById('simulator-tarifa'),
    comisionSelect: document.getElementById('simulator-comision'),
    monedaSelect: document.getElementById('simulator-moneda'),
    planGroup: document.querySelector('[data-simulator-plan-group]'),
    servicioGroup: document.querySelector('[data-simulator-servicio-group]'),
    tarifaGroup: document.querySelector('[data-simulator-tarifa-group]'),
    comisionGroup: document.querySelector('[data-simulator-comision-group]'),
    monedaGroup: document.querySelector('[data-simulator-moneda-group]'),
    scopeError: document.getElementById('simulator-scope-error'),
    tarifaError: document.getElementById('simulator-tarifa-error'),
  };

  if (dom.simulator.consumoIa) {
    dom.simulator.consumoIaGroup = dom.simulator.consumoIa.closest('.col-12');
  }

  if (dom.simulator.modal && window.bootstrap?.Modal) {
    dom.simulator.modalInstance = window.bootstrap.Modal.getOrCreateInstance(
      dom.simulator.modal
    );
  }

  if (dom.simulator.consumoIa) {
    dom.simulator.consumoIa.value =
      typeof state.simulator.inputs.consumoIa === 'number'
        ? state.simulator.inputs.consumoIa
        : '';
  }

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
    modeGroup: document.getElementById('tc-econfig-mode-group'),
    modeButtons: document.querySelectorAll('#tc-econfig-mode-group [data-econfig-mode]'),
    submit: document.getElementById('tc-econfig-submit'),
    summary: document.getElementById('tc-econfig-summary'),
    previewSamples: document.getElementById('tc-econfig-preview-samples') || null,
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

  renderHeaderActions();
}

function renderHelpBanner() {
  const banner = state.dom.helpBanner;
  if (!banner) return;
  const url = DOCS_TARIFAS_URL;
  banner.innerHTML = `
    <a
      class="alert alert-info d-flex align-items-center justify-content-between gap-3 text-decoration-none"
      href="${escapeAttribute(url)}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span class="fw-semibold text-dark">Ver documentación de impuestos y configuración económica</span>
      <span class="text-primary fw-semibold d-flex align-items-center gap-2">
        Abrir guía
        <i class="bi bi-box-arrow-up-right"></i>
      </span>
    </a>
  `;
}

function renderHeaderActions() {
  const header = state.dom.header;
  if (!header) return;
  const isComisiones = state.tabs === 'comisiones';
  header.tarifasButtons?.forEach((btn) => {
    btn.classList.toggle('d-none', isComisiones);
  });
  header.comisionesButtons?.forEach((btn) => {
    btn.classList.toggle('d-none', !isComisiones);
  });
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
      });
    } else if (key === 'apply') {
      input.addEventListener('click', () => {
        applyTarifaFilterChanges();
      });
    } else {
      const handler = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(handler, () => {
        setTarifaFilterDraft(key, input.value);
      });
    }
  });

  syncTarifaFilterInputs();

  tarifas.rowsPerPage?.addEventListener('change', () => {
    const perPage = Number(tarifas.rowsPerPage.value) || 10;
    state.tarifas.paginator.perPage = perPage;
    state.tarifas.paginator.page = 1;
    renderTarifas();
  });

  tarifas.newButton?.addEventListener('click', () => {
    openTarifaForm('create');
  });

  tarifas.exportBtn?.addEventListener('click', () => exportTarifas());

  if (tarifas.tableBody) {
    tarifas.tableBody.addEventListener('click', handleTarifasTableClick);
    tarifas.tableBody.addEventListener('change', handleTarifasTableChange);
  }

  if (tarifas.form) {
    tarifas.form.addEventListener('submit', submitTarifaForm);
    tarifas.form
      .querySelectorAll('[name="tipo_calculo"],[name="incluye_impuesto"]')
      .forEach((field) => field.addEventListener('change', updateTarifaFormUi));
    const jsonField = tarifas.form.querySelector('[name="parametros"]');
    jsonField?.addEventListener('input', () => validateJsonField(jsonField));
  }

  state.dom.tarifas.conflictResolveButtons.forEach((btn) =>
    btn.addEventListener('click', () => resolveTarifaConflict(btn.dataset.conflictAction))
  );

  if (tarifas.conflictModal) {
    tarifas.conflictModal.addEventListener('hidden.bs.modal', () => {
      const modal = getBootstrapModal(tarifas.conflictModal);
      clearConflictContext(tarifas.conflictModal, modal);
    });
  }

  initScopeControls('tarifas');
}

function renderTarifas() {
  const { items } = state.tarifas;
  const filtered = applyTarifaFilters(items);
  const sorted = sortByDefaultOrder(filtered);
  const paginated = paginate(sorted, state.tarifas.paginator);
  state.tarifas.paginator.total = filtered.length;

  const body = state.dom.tarifas.tableBody;

  if (!body) return;
  body.innerHTML = '';

  paginated.forEach((tarifa) => {
    const tr = document.createElement('tr');
    tr.dataset.id = tarifa.id;
    tr.innerHTML = tarifaRowTemplate(tarifa);
    body.appendChild(tr);
    attachRelativeTooltip(tr.querySelector('[data-updated]'), tarifa.actualizado_el);
  });

  renderTarifaPagination();
}

function tarifaRowTemplate(tarifa) {
  const badge = tarifa.incluye_impuesto
    ? '<span class="badge bg-success ms-2">Incluye IGV</span>'
    : '';
  const chip = statusChip(tarifa);
  const displayName = tarifa.descripcion
    ? escapeHtml(tarifa.descripcion)
    : `Tarifa #${tarifa.id}`;
  const identifier = tarifa.id != null ? `ID ${tarifa.id}` : '';
  const metadataParts = [chip];
  if (identifier) {
    metadataParts.push(`<span class="text-muted small">${identifier}</span>`);
  }
  const metadata = metadataParts.filter(Boolean).join('');
  return `
    <td>
      <div class="fw-semibold">${displayName}</div>
      <div class="d-flex flex-wrap align-items-center gap-2 mt-1">${metadata}</div>
    </td>
    <td>
      <div class="fw-semibold">${ambitoLabel(tarifa)}</div>
      <div class="small text-muted">${scopeTypeLabel(tarifa)}</div>
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
  const hasServicio = !!filters.servicio;
  const hasPlan = !!filters.plan;
  return items.filter((item) => {
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    const scopeType = resolveScopeType(item);
    if (hasServicio && !matchesAutocomplete(item, filters.servicio, 'servicio')) return false;
    if (hasPlan && !matchesAutocomplete(item, filters.plan, 'plan')) return false;
    if (!hasServicio && hasPlan && scopeType === SCOPE_TYPES.SERVICIO) return false;
    if (!hasPlan && hasServicio && scopeType === SCOPE_TYPES.PLAN) return false;
    return true;
  });
}

function resetTarifaFilters() {
  state.tarifas.pendingFilters = createEmptyScopeFilters();
  syncTarifaFilterInputs();
}

function setTarifaFilterDraft(key, value) {
  state.tarifas.pendingFilters[key] = typeof value === 'string' ? value.trim() : value;
}

function syncTarifaFilterInputs() {
  const { filters } = state.dom.tarifas;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset' || key === 'apply') return;
    const nextValue = state.tarifas.pendingFilters[key] || '';
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  });
}

function applyTarifaFilterChanges() {
  state.tarifas.filters = { ...state.tarifas.pendingFilters };
  state.tarifas.paginator.page = 1;
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

function handleTarifasTableClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('button[data-action="edit"]')) {
    openTarifaForm('edit', id);
  } else if (event.target.matches('button[data-action="audit"]')) {
    openAuditoria('tarifas', id);
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

async function openTarifaForm(mode, id) {
  const form = state.dom.tarifas.form;
  const modalElement = state.dom.tarifas.formModal;
  if (!form || !modalElement) return;
  const modal = getBootstrapModal(modalElement);

  state.tarifas.form.mode = mode;
  state.tarifas.form.data =
    mode === 'edit' ? state.tarifas.items.find((item) => item.id === id) : null;

  await populateTarifaForm();
  modal.show();
}

async function populateTarifaForm() {
  const { form, formModal } = state.dom.tarifas;
  if (!form) return;
  const data = state.tarifas.form.data || getDefaultTarifa();
  await prepareScopeOptions('tarifas', data);
  form.querySelector('[name="descripcion"]').value = data.descripcion || '';
  form.querySelector('[name="valor"]').value = (data.valor ?? '').toString();
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

  const scopeControls = state.dom.tarifas.scope || {};
  const scopeType = scopeControls.hidden?.value || '';
  const planId = parseOptionalId(form.plan_id?.value);
  const servicioId = parseOptionalId(form.servicio_id?.value);
  clearScopeError('tarifas');

  if (!scopeType) {
    showScopeError('tarifas', 'Selecciona el ámbito de aplicación antes de guardar.');
    return;
  }

  if (
    (scopeType === SCOPE_TYPES.PLAN || scopeType === SCOPE_TYPES.PLAN_SERVICIO) &&
    !planId
  ) {
    scopeControls.planSelect?.classList.add('is-invalid');
    showScopeError('tarifas', 'Selecciona un plan para definir el ámbito.');
    scopeControls.planSelect?.focus();
    return;
  }
  scopeControls.planSelect?.classList.remove('is-invalid');

  if (
    (scopeType === SCOPE_TYPES.SERVICIO || scopeType === SCOPE_TYPES.PLAN_SERVICIO) &&
    !servicioId
  ) {
    scopeControls.servicioSelect?.classList.add('is-invalid');
    showScopeError('tarifas', 'Selecciona un servicio para definir el ámbito.');
    scopeControls.servicioSelect?.focus();
    return;
  }
  scopeControls.servicioSelect?.classList.remove('is-invalid');

  const base = state.tarifas.form.data || {};
  const rawValorInput = form.valor.value.trim();
  const normalizedValorInput = rawValorInput.replace(/,/g, '.');
  const parsedValor =
    normalizedValorInput === '' ? Number.NaN : Number(normalizedValorInput);

  if (!Number.isFinite(parsedValor) || parsedValor < 0) {
    form.valor.classList.add('is-invalid');
    return;
  }
  form.valor.classList.remove('is-invalid');
  if (rawValorInput !== normalizedValorInput) {
    form.valor.value = normalizedValorInput;
  }

  const payload = {
    descripcion: form.descripcion.value.trim() || null,
    valor: parsedValor,
    incluye_impuesto: form.incluye_impuesto.checked,
    tipo_calculo: form.tipo_calculo.value,
    parametros: jsonField.value ? JSON.parse(jsonField.value) : {},
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
    activo: form.activo.checked,
    plan_id: planId,
    servicio_id: servicioId,
  };
  if (payload.tipo_calculo !== 'consumo_ia') {
    payload.parametros = {};
  }

  const requestBody = {
    ...(base.id ? { id: base.id } : {}),
    ...payload,
    actualizado_el: base.actualizado_el || null,
  };

  const conflict = findTarifaConflict(requestBody, state.tarifas.form.data?.id);
  if (conflict) {
    showTarifaConflictModal(conflict, requestBody);
    return;
  }

  await persistTarifa(requestBody, state.tarifas.form);
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
    const responseBody = await response.json();
    const saved = resolveEntityFromResponse(responseBody, 'tarifa');
    if (!saved?.id) {
      throw new Error('La respuesta del servidor no contiene la tarifa guardada.');
    }
    upsertTarifa(saved);
    if (state.quick.tarifasCache instanceof Map) {
      state.quick.tarifasCache.clear();
    }
    state.dom.tarifas.form.reset();
    await prepareScopeOptions('tarifas', getDefaultTarifa());
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
    if (!item.activo || !tarifa.activo) return false;
    if (!hasSameScope(item, tarifa)) return false;
    return rangesOverlap(
      item.vigencia_desde,
      item.vigencia_hasta,
      tarifa.vigencia_desde,
      tarifa.vigencia_hasta
    );
  });
}

function showTarifaConflictModal(conflict, payload) {
  const modalElement = state.dom.tarifas.conflictModal;
  const modal = getBootstrapModal(modalElement);
  if (!modal) return;
  assignConflictContext(modalElement, modal, conflict, payload);
  modal.show();
}

async function resolveTarifaConflict(action) {
  const modalElement = state.dom.tarifas.conflictModal;
  const modal = getBootstrapModal(modalElement);
  const context = readConflictContext(modalElement, modal);
  const payload = context?.payload;
  const conflict = context?.conflict;
  if (!modal || !payload || !conflict) return;

  modal.hide();

  if (action === 'cancelar') {
    clearConflictContext(modalElement, modal);
    return;
  }

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
    clearConflictContext(modalElement, modal);
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

function exportTarifas() {
  const params = new URLSearchParams({ ...state.tarifas.filters });
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
      });
    } else if (key === 'apply') {
      input.addEventListener('click', () => {
        applyComisionFilterChanges();
      });
    } else {
      const handler = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(handler, () => setComisionFilterDraft(key, input.value));
    }
  });

  syncComisionFilterInputs();

  comisiones.rowsPerPage?.addEventListener('change', () => {
    state.comisiones.paginator.perPage = Number(comisiones.rowsPerPage.value) || 10;
    state.comisiones.paginator.page = 1;
    renderComisiones();
  });

  comisiones.newButton?.addEventListener('click', () => openComisionForm('create'));
  comisiones.exportBtn?.addEventListener('click', () => exportComisiones());

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

  if (comisiones.conflictModal) {
    comisiones.conflictModal.addEventListener('hidden.bs.modal', () => {
      const modal = getBootstrapModal(comisiones.conflictModal);
      clearConflictContext(comisiones.conflictModal, modal);
    });
  }

  initScopeControls('comisiones');
}

function initScopeControls(formKey) {
  const scope = getScopeDom(formKey);
  if (!scope) return;

  scope.options?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.scopeValue || '';
      selectScope(formKey, type).catch((error) => {
        console.error('Error seleccionando ámbito', error);
      });
    });
  });

  scope.planSelect?.addEventListener('change', () => {
    scope.planSelect.classList.remove('is-invalid');
    updateScopeServiceOptions(formKey, null).catch((error) => {
      console.error('Error actualizando servicios del ámbito', error);
    });
    if (scope.servicioSelect && scope.hidden?.value === SCOPE_TYPES.PLAN_SERVICIO) {
      scope.servicioSelect.value = '';
      scope.servicioSelect.classList.remove('is-invalid');
    }
    clearScopeError(formKey);
  });

  scope.servicioSelect?.addEventListener('change', () => {
    scope.servicioSelect.classList.remove('is-invalid');
    clearScopeError(formKey);
  });
}

function getScopeDom(formKey) {
  if (formKey === 'tarifas') return state.dom.tarifas.scope || null;
  if (formKey === 'comisiones') return state.dom.comisiones.scope || null;
  return null;
}

async function selectScope(formKey, type, options = {}) {
  const scope = getScopeDom(formKey);
  if (!scope) return;

  const normalized = type || '';
  if (scope.hidden) {
    scope.hidden.value = normalized;
  }

  scope.options?.forEach((btn) => {
    const isActive = btn.dataset.scopeValue === normalized;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline-secondary', !isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });

  const showPlan = normalized === SCOPE_TYPES.PLAN || normalized === SCOPE_TYPES.PLAN_SERVICIO;
  const showServicio =
    normalized === SCOPE_TYPES.SERVICIO || normalized === SCOPE_TYPES.PLAN_SERVICIO;

  toggleScopeGroup(scope.planGroup, showPlan);
  toggleScopeGroup(scope.servicioGroup, showServicio);

  if (scope.planSelect) {
    if (showPlan) {
      scope.planSelect.setAttribute('required', '');
      if (!options.skipPlanPopulate) {
        await ensurePlanCatalogs();
        populatePlanOptions(scope.planSelect);
      }
    } else {
      scope.planSelect.removeAttribute('required');
      scope.planSelect.value = '';
    }
  }

  if (scope.servicioSelect) {
    if (showServicio) {
      scope.servicioSelect.setAttribute('required', '');
    } else {
      scope.servicioSelect.removeAttribute('required');
      scope.servicioSelect.value = '';
    }
  }

  if (!options.skipServiceUpdate) {
    await updateScopeServiceOptions(formKey, options.selectedServiceId);
  }

  clearScopeError(formKey);
  scope.planSelect?.classList.remove('is-invalid');
  scope.servicioSelect?.classList.remove('is-invalid');
}

function toggleScopeGroup(element, visible) {
  if (!element) return;
  element.classList.toggle('d-none', !visible);
}

async function prepareScopeOptions(formKey, data) {
  const scope = getScopeDom(formKey);
  if (!scope) return;

  const planId = normalizeId(data?.plan_id ?? data?.plan?.id);
  const servicioId = normalizeId(data?.servicio_id ?? data?.servicio?.id);
  const scopeType = determineScopeType(planId, servicioId, data?.ambito);

  if (scope.planSelect) {
    try {
      await ensurePlanCatalogs();
    } catch (error) {
      console.error('Error cargando planes para el ámbito', error);
    }
    populatePlanOptions(scope.planSelect, planId, data?.plan);
    scope.planSelect.value = planId ? String(planId) : '';
  }

  await selectScope(formKey, scopeType, {
    skipServiceUpdate: true,
    skipPlanPopulate: true,
    selectedServiceId: servicioId,
  });
  await updateScopeServiceOptions(formKey, servicioId, data?.servicio);
  if (scope.servicioSelect) {
    scope.servicioSelect.value = servicioId ? String(servicioId) : '';
  }

  clearScopeError(formKey);
  scope.planSelect?.classList.remove('is-invalid');
  scope.servicioSelect?.classList.remove('is-invalid');
}

function populatePlanOptions(select, selectedId, fallbackPlan) {
  if (!select) return;
  const source = [...(state.catalogs.planes || [])];
  const targetId = normalizeId(selectedId);
  const fallbackId = normalizeId(fallbackPlan?.id);
  const fallbackNormalized = sanitizePlan(fallbackPlan);
  if (fallbackNormalized && fallbackId && !source.some((plan) => plan.id === fallbackId)) {
    source.push(fallbackNormalized);
  }
  const existing = targetId ? findPlanById(targetId) : null;
  if (existing && !source.some((plan) => plan.id === existing.id)) {
    source.push(existing);
  }

  const seen = new Set();
  const unique = [];
  source.forEach((plan) => {
    if (!plan || seen.has(plan.id)) return;
    seen.add(plan.id);
    unique.push(plan);
  });

  unique.sort((a, b) => {
    const nameA = (a?.nombre || '').toString();
    const nameB = (b?.nombre || '').toString();
    return nameA.localeCompare(nameB, 'es', { sensitivity: 'base' });
  });

  select.innerHTML = '<option value="">Selecciona un plan</option>';
  unique.forEach((plan) => {
    const option = document.createElement('option');
    option.value = plan.id;
    const suffix = plan.activo === false ? ' (inactivo)' : '';
    option.textContent = `${plan.nombre || `ID ${plan.id}`}${suffix}`;
    select.appendChild(option);
  });

  if (targetId) {
    select.value = String(targetId);
  }
}

async function updateScopeServiceOptions(formKey, selectedId, fallbackService) {
  const scope = getScopeDom(formKey);
  if (!scope?.servicioSelect) return;
  const select = scope.servicioSelect;
  const scopeType = scope.hidden?.value || '';
  const planId = normalizeId(scope.planSelect?.value);
  let services = [];
  let disable = false;
  let placeholder = 'Selecciona un servicio';

  select.innerHTML = '<option value="">Cargando servicios...</option>';
  select.disabled = true;

  try {
    if (scopeType === SCOPE_TYPES.PLAN_SERVICIO) {
      if (planId) {
        await ensurePlanCatalogs();
        await ensureServiceCatalogs();
        await ensurePlanAssignments(planId);
        services = getServicesForPlan(planId);
        placeholder = services.length
          ? 'Selecciona un servicio'
          : 'No hay servicios vinculados al plan';
        disable = services.length === 0;
      } else {
        disable = true;
        placeholder = 'Selecciona un plan para ver servicios';
      }
    } else if (scopeType === SCOPE_TYPES.SERVICIO) {
      await ensureServiceCatalogs();
      services = [...(state.catalogs.servicios || [])];
      placeholder = services.length ? 'Selecciona un servicio' : 'No hay servicios disponibles';
      disable = services.length === 0;
    } else {
      disable = true;
      placeholder = 'Selecciona un ámbito para continuar';
    }
  } catch (error) {
    console.error('Error actualizando catálogo de servicios', error);
    services = [];
    disable = true;
    placeholder = 'No se pudieron cargar los servicios';
  }

  const desiredId = normalizeId(selectedId ?? select.value);
  const fallback = fallbackService && normalizeId(fallbackService.id) ? sanitizeService(fallbackService) : null;
  if (fallback && fallback.id && services.every((svc) => svc.id !== fallback.id)) {
    services.push(fallback);
  }
  if (desiredId) {
    const existing = findServiceById(desiredId);
    if (existing && services.every((svc) => svc.id !== existing.id)) {
      services.push(existing);
    }
  }

  const seen = new Set();
  const unique = [];
  services.forEach((service) => {
    if (!service || seen.has(service.id)) return;
    seen.add(service.id);
    unique.push(service);
  });

  unique.sort((a, b) => {
    const labelA = (a.nombre || a.codigo || '').toString();
    const labelB = (b.nombre || b.codigo || '').toString();
    return labelA.localeCompare(labelB, 'es', { sensitivity: 'base' });
  });

  select.innerHTML = `<option value="">${placeholder}</option>`;
  unique.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    const parts = [];
    if (service.nombre) parts.push(service.nombre);
    if (service.codigo && service.codigo !== service.nombre) parts.push(service.codigo);
    const label = parts.length ? parts.join(' · ') : `ID ${service.id}`;
    const suffixParts = [];
    if (service.activo === false) suffixParts.push('servicio inactivo');
    if (service.__assignmentActivo === false) suffixParts.push('vinculación inactiva');
    const suffix = suffixParts.length ? ` (${suffixParts.join(' · ')})` : '';
    option.textContent = `${label}${suffix}`;
    select.appendChild(option);
  });

  select.disabled = disable;
  if (!disable && desiredId) {
    select.value = String(desiredId);
  } else {
    select.value = '';
  }
}

async function refreshSimulatorRuleSelectors(context = {}) {
  const { simulator } = state.dom;
  if (!simulator) return;

  const scopeType = context.scopeType || simulator.ambito?.value || 'servicio';
  const planId =
    context.planId !== undefined
      ? context.planId
      : parseOptionalId(simulator.planSelect?.value);
  const servicioId =
    context.servicioId !== undefined
      ? context.servicioId
      : parseOptionalId(simulator.servicioSelect?.value);
  const fechaReferencia = new Date().toISOString().slice(0, 10);

  let tarifas = [];
  let comisionesCliente = [];
  let comisionesAbogado = [];

  try {
    const [tarifaItems, comClienteItems, comAbogadoItems] = await Promise.all([
      fetchSimulatorTarifasList({ scope: scopeType, planId, servicioId, fecha: fechaReferencia }),
      fetchSimulatorComisionesList({ rol: 'cliente', planId, servicioId, fecha: fechaReferencia }),
      fetchSimulatorComisionesList({ rol: 'abogado', planId, servicioId, fecha: fechaReferencia }),
    ]);
    tarifas = tarifaItems;
    comisionesCliente = comClienteItems;
    comisionesAbogado = comAbogadoItems;
  } catch (error) {
    console.error('Error obteniendo reglas económicas para el simulador', error);
  }

  state.simulator.options.tarifas = tarifas;
  state.simulator.options.comisiones = {
    cliente: comisionesCliente,
    abogado: comisionesAbogado,
  };

  const selectedTarifa = selectBestScopedRule(tarifas, {
    planId,
    servicioId,
    fecha: fechaReferencia,
  });
  const currentTarifaId = state.simulator.inputs.tarifaId;
  const availableTarifaIds = new Set(
    tarifas.map((item) => normalizeId(item.id)).filter((id) => id != null)
  );
  const selectedTarifaId = availableTarifaIds.has(normalizeId(currentTarifaId))
    ? currentTarifaId
    : selectedTarifa?.id ?? null;

  populateSimulatorTarifaOptions(tarifas, selectedTarifaId);
  state.simulator.inputs.tarifaId = selectedTarifaId ?? null;
  handleSimulatorTarifaChange();

  const selectedCliente = selectBestScopedRule(comisionesCliente, {
    planId,
    servicioId,
    fecha: fechaReferencia,
  });
  const selectedAbogado = selectBestScopedRule(comisionesAbogado, {
    planId,
    servicioId,
    fecha: fechaReferencia,
  });

  const availableClienteIds = new Set(
    comisionesCliente.map((item) => normalizeId(item.id)).filter((id) => id != null)
  );
  const availableAbogadoIds = new Set(
    comisionesAbogado.map((item) => normalizeId(item.id)).filter((id) => id != null)
  );

  const findComisionById = (lista, id) =>
    lista.find((item) => normalizeId(item?.id) === normalizeId(id)) || null;

  const autoCliente = selectedCliente || null;
  const autoAbogado = selectedAbogado || null;

  state.simulator.meta = {
    ...state.simulator.meta,
    autoComisiones: {
      clienteId: autoCliente?.id ?? null,
      abogadoId: autoAbogado?.id ?? null,
    },
  };

  if (!state.simulator.inputs.comisiones) {
    state.simulator.inputs.comisiones = { clienteId: null, abogadoId: null };
  }

  let resolvedSelection = state.simulator.inputs.comisionSeleccion || 'auto';
  let resolvedCliente = null;
  let resolvedAbogado = null;

  const ensureCliente = (id) => findComisionById(comisionesCliente, id);
  const ensureAbogado = (id) => findComisionById(comisionesAbogado, id);

  if (resolvedSelection === 'none') {
    resolvedCliente = null;
    resolvedAbogado = null;
  } else if (resolvedSelection.startsWith('cliente:')) {
    const manualId = resolvedSelection.split(':')[1];
    const match = ensureCliente(manualId);
    if (match) {
      resolvedCliente = match;
    } else {
      resolvedSelection = 'auto';
    }
  } else if (resolvedSelection.startsWith('abogado:')) {
    const manualId = resolvedSelection.split(':')[1];
    const match = ensureAbogado(manualId);
    if (match) {
      resolvedAbogado = match;
    } else {
      resolvedSelection = 'auto';
    }
  } else {
    resolvedSelection = 'auto';
  }

  if (resolvedSelection === 'auto') {
    resolvedCliente = autoCliente;
    resolvedAbogado = autoAbogado;
  }

  if (resolvedSelection !== 'none' && !resolvedCliente && !resolvedAbogado) {
    resolvedSelection = 'none';
  }

  const resolvedClienteId = resolvedCliente?.id ?? null;
  const resolvedAbogadoId = resolvedAbogado?.id ?? null;

  state.simulator.inputs.comisiones = {
    clienteId:
      resolvedClienteId != null && availableClienteIds.has(normalizeId(resolvedClienteId))
        ? resolvedClienteId
        : null,
    abogadoId:
      resolvedAbogadoId != null && availableAbogadoIds.has(normalizeId(resolvedAbogadoId))
        ? resolvedAbogadoId
        : null,
  };
  state.simulator.inputs.comisionSeleccion = resolvedSelection;

  populateSimulatorComisionOptions({
    disponibles: {
      cliente: comisionesCliente,
      abogado: comisionesAbogado,
    },
  });

  try {
    await prepareSimulatorMonedaOptions();
  } catch (error) {
    console.error('Error preparando monedas para el simulador', error);
  }
  updateSimulatorDynamicFields();
}

function populateSimulatorTarifaOptions(items, selectedId) {
  const { simulator } = state.dom;
  const select = simulator?.tarifaSelect;
  const error = simulator?.tarifaError;
  if (!select) return;

  if (!Array.isArray(items)) items = [];

  if (!items.length) {
    select.innerHTML = '<option value="">No hay tarifas vigentes disponibles</option>';
    select.value = '';
    select.setAttribute('disabled', '');
    select.classList.add('is-invalid');
    if (error) error.classList.remove('d-none');
    return;
  }

  const optionsHtml = items
    .map((item) => {
      const id = item?.id != null ? String(item.id) : '';
      const label = formatTarifaOptionLabel(item);
      const selected = normalizeId(selectedId) === normalizeId(item?.id) ? ' selected' : '';
      return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(label)}</option>`;
    })
    .join('');

  select.removeAttribute('disabled');
  select.classList.remove('is-invalid');
  select.innerHTML = optionsHtml;
  if (normalizeId(selectedId) != null) {
    select.value = String(selectedId);
  } else {
    select.selectedIndex = 0;
  }
  if (error) error.classList.add('d-none');
}

function populateSimulatorComisionOptions({ disponibles }) {
  const { simulator } = state.dom;
  const select = simulator?.comisionSelect;
  if (!select) return;

  const listadoCliente = Array.isArray(disponibles?.cliente) ? disponibles.cliente : [];
  const listadoAbogado = Array.isArray(disponibles?.abogado) ? disponibles.abogado : [];

  const findComisionById = (lista, id) =>
    lista.find((item) => normalizeId(item?.id) === normalizeId(id)) || null;

  if (!listadoCliente.length && !listadoAbogado.length) {
    select.innerHTML = '<option value="">Sin comisiones vigentes para este ámbito</option>';
    select.value = '';
    select.setAttribute('disabled', '');
    return;
  }

  const autoMeta = state.simulator.meta?.autoComisiones || { clienteId: null, abogadoId: null };
  const autoCliente = findComisionById(listadoCliente, autoMeta.clienteId);
  const autoAbogado = findComisionById(listadoAbogado, autoMeta.abogadoId);

  const partes = [];
  if (autoCliente) {
    const pct = Number(autoCliente.porcentaje ?? autoCliente.porcentaje_aplicada ?? 0);
    const etiqueta = Number.isFinite(pct) ? formatPercentage(pct) : '—';
    const descripcion = autoCliente.descripcion ? ` · ${autoCliente.descripcion}` : '';
    partes.push(`Cliente ${etiqueta}${descripcion}`);
  }
  if (autoAbogado) {
    const pct = Number(autoAbogado.porcentaje ?? autoAbogado.porcentaje_aplicada ?? 0);
    const etiqueta = Number.isFinite(pct) ? formatPercentage(pct) : '—';
    const descripcion = autoAbogado.descripcion ? ` · ${autoAbogado.descripcion}` : '';
    partes.push(`Abogado ${etiqueta}${descripcion}`);
  }

  const autoLabel = partes.length
    ? `Automática: ${partes.join(' · ')}`
    : 'Automática: sin comisiones vigentes';

  const selection = state.simulator.inputs.comisionSeleccion || 'auto';
  const options = [];
  const optionValues = [];
  options.push(
    `<option value="auto"${selection === 'auto' ? ' selected' : ''}>${escapeHtml(autoLabel)}</option>`
  );
  optionValues.push('auto');
  options.push(
    `<option value="none"${selection === 'none' ? ' selected' : ''}>Sin comisión</option>`
  );
  optionValues.push('none');

  listadoCliente.forEach((item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (!id) return;
    const value = `cliente:${id}`;
    const selected = selection === value ? ' selected' : '';
    options.push(
      `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(formatComisionOptionLabel(item))}</option>`
    );
    optionValues.push(value);
  });

  listadoAbogado.forEach((item) => {
    const id = item?.id != null ? String(item.id) : '';
    if (!id) return;
    const value = `abogado:${id}`;
    const selected = selection === value ? ' selected' : '';
    options.push(
      `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(formatComisionOptionLabel(item))}</option>`
    );
    optionValues.push(value);
  });

  select.innerHTML = options.join('');
  if (optionValues.includes(selection)) {
    select.value = selection;
  } else if (optionValues.includes('auto')) {
    select.value = 'auto';
    state.simulator.inputs.comisionSeleccion = 'auto';
    const autoMeta = state.simulator.meta?.autoComisiones || { clienteId: null, abogadoId: null };
    state.simulator.inputs.comisiones = {
      clienteId: autoMeta.clienteId ?? null,
      abogadoId: autoMeta.abogadoId ?? null,
    };
  } else if (optionValues.length) {
    select.value = optionValues[0];
    state.simulator.inputs.comisionSeleccion = optionValues[0];
    handleSimulatorComisionChange();
  } else {
    select.value = '';
  }
  select.removeAttribute('disabled');
}

function handleSimulatorTarifaChange() {
  const { simulator } = state.dom;
  const select = simulator?.tarifaSelect;
  const tarifaId = parseOptionalId(select?.value);
  state.simulator.inputs.tarifaId = tarifaId;

  const tarifa =
    tarifaId != null
      ? state.simulator.options.tarifas.find((item) => normalizeId(item.id) === normalizeId(tarifaId)) || null
      : null;
  const tipoCalculo = (tarifa?.tipo_calculo || tarifa?.tipoCalculo || '').toLowerCase();
  const prevMeta = state.simulator.meta || {};
  state.simulator.meta = {
    ...prevMeta,
    tipoCalculo: tipoCalculo || null,
    requiresConsumoIa: tipoCalculo === 'consumo_ia',
  };

  updateSimulatorDynamicFields();
}

function handleSimulatorComisionChange() {
  const { simulator } = state.dom;
  const select = simulator?.comisionSelect;
  if (!select) return;

  const rawValue = select.value || '';
  const options = state.simulator.options?.comisiones || {};
  const listadoCliente = Array.isArray(options.cliente) ? options.cliente : [];
  const listadoAbogado = Array.isArray(options.abogado) ? options.abogado : [];
  const autoMeta = state.simulator.meta?.autoComisiones || { clienteId: null, abogadoId: null };

  const findComisionById = (lista, id) =>
    lista.find((item) => normalizeId(item?.id) === normalizeId(id)) || null;

  let selection = rawValue || 'auto';
  let resolvedCliente = null;
  let resolvedAbogado = null;

  if (selection === 'none') {
    resolvedCliente = null;
    resolvedAbogado = null;
  } else if (selection.startsWith('cliente:')) {
    const manualId = selection.split(':')[1];
    resolvedCliente = findComisionById(listadoCliente, manualId);
    resolvedAbogado = null;
    if (!resolvedCliente) {
      selection = 'auto';
    }
  } else if (selection.startsWith('abogado:')) {
    const manualId = selection.split(':')[1];
    resolvedAbogado = findComisionById(listadoAbogado, manualId);
    resolvedCliente = null;
    if (!resolvedAbogado) {
      selection = 'auto';
    }
  } else {
    selection = 'auto';
  }

  if (selection === 'auto') {
    resolvedCliente = findComisionById(listadoCliente, autoMeta.clienteId);
    resolvedAbogado = findComisionById(listadoAbogado, autoMeta.abogadoId);
  }

  if (selection !== 'none' && !resolvedCliente && !resolvedAbogado) {
    selection = 'none';
  }

  state.simulator.inputs.comisionSeleccion = selection;
  if (!state.simulator.inputs.comisiones) {
    state.simulator.inputs.comisiones = { clienteId: null, abogadoId: null };
  }
  state.simulator.inputs.comisiones.clienteId = resolvedCliente?.id ?? null;
  state.simulator.inputs.comisiones.abogadoId = resolvedAbogado?.id ?? null;

  populateSimulatorComisionOptions({
    disponibles: options,
  });
}

async function prepareSimulatorMonedaOptions() {
  const econ = await ensureQuickEconconfigData();
  const { simulator } = state.dom;
  const select = simulator?.monedaSelect;

  if (!select) {
    state.simulator.meta.showMonedaSelect = false;
    return;
  }

  const monedas = extractAvailableMonedas(econ);
  state.simulator.options.monedas = monedas;

  if (!monedas.length) {
    select.innerHTML = '';
    select.value = '';
    state.simulator.meta.showMonedaSelect = false;
    state.simulator.inputs.moneda =
      econ?.moneda_defecto || econ?.monedaDefecto || state.monedaFallback;
    return;
  }

  if (monedas.length === 1) {
    const unica = monedas[0];
    select.innerHTML = `<option value="${escapeHtml(unica)}">${escapeHtml(unica)}</option>`;
    select.value = unica;
    state.simulator.meta.showMonedaSelect = false;
    state.simulator.inputs.moneda = unica;
    return;
  }

  const current =
    state.simulator.inputs.moneda
      || econ?.moneda_defecto
      || econ?.monedaDefecto
      || state.monedaFallback;
  const optionsHtml = monedas
    .map((code) => {
      const selected = code === current ? ' selected' : '';
      return `<option value="${escapeHtml(code)}"${selected}>${escapeHtml(code)}</option>`;
    })
    .join('');
  select.innerHTML = optionsHtml;
  const resolvedMoneda = monedas.includes(current) ? current : monedas[0];
  select.value = resolvedMoneda;
  state.simulator.meta.showMonedaSelect = true;
  state.simulator.inputs.moneda = resolvedMoneda;
}

function extractAvailableMonedas(econconfig) {
  if (!econconfig || typeof econconfig !== 'object') return [];
  const candidates = [
    econconfig.monedas_disponibles,
    econconfig.monedasDisponibles,
    econconfig.monedas,
  ].find((value) => Array.isArray(value));
  if (!Array.isArray(candidates)) return [];
  return candidates
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => item.length === 3)
    .filter((item, index, arr) => arr.indexOf(item) === index);
}

function formatTarifaOptionLabel(tarifa) {
  if (!tarifa || typeof tarifa !== 'object') return 'Tarifa sin identificación';
  const idPart = tarifa.id != null ? `Tarifa ${tarifa.id}` : 'Tarifa sin ID';
  const tipoRaw = (tarifa.tipo_calculo || tarifa.tipoCalculo || '').toLowerCase();
  const tipo = TARIFA_TIPO_CALCULO_LABEL[tipoRaw] || capitalize(tipoRaw || 'Desconocido');
  const vigenciaDesde = tarifa.vigencia_desde || tarifa.vigenciaDesde || '';
  const vigenciaHasta = tarifa.vigencia_hasta || tarifa.vigenciaHasta || '';
  let vigencia = '';
  if (vigenciaDesde || vigenciaHasta) {
    const desde = vigenciaDesde ? formatShortDate(vigenciaDesde) : '—';
    const hasta = vigenciaHasta ? formatShortDate(vigenciaHasta) : '—';
    vigencia = ` · Vigencia ${desde} - ${hasta}`;
  }
  return `${idPart} · ${tipo}${vigencia}`;
}

function formatComisionOptionLabel(comision) {
  if (!comision || typeof comision !== 'object') return 'Comisión';
  const idPart = comision.id != null ? `Regla ${comision.id}` : 'Regla sin ID';
  const rolRaw = (comision.rol_aplica || comision.rolAplica || '').trim().toLowerCase();
  const rolLabel = rolRaw ? capitalize(rolRaw) : 'Comisión';
  const porcentaje = Number(comision.porcentaje);
  const pctLabel = Number.isFinite(porcentaje) ? `${porcentaje.toFixed(2)}%` : '0%';
  const vigenciaDesde = comision.vigencia_desde || comision.vigenciaDesde || '';
  const vigenciaHasta = comision.vigencia_hasta || comision.vigenciaHasta || '';
  let vigencia = '';
  if (vigenciaDesde || vigenciaHasta) {
    const desde = vigenciaDesde ? formatShortDate(vigenciaDesde) : '—';
    const hasta = vigenciaHasta ? formatShortDate(vigenciaHasta) : '—';
    vigencia = ` · Vigencia ${desde} - ${hasta}`;
  }
  const descripcion = comision.descripcion ? ` · ${comision.descripcion}` : '';
  return `${rolLabel} · ${idPart} · ${pctLabel}${vigencia}${descripcion}`;
}

function getServicesForPlan(planId) {
  const targetId = normalizeId(planId);
  if (!targetId) return [];
  if (!(state.catalogs.planAssignments instanceof Map)) return [];
  const assignments = state.catalogs.planAssignments.get(targetId) || [];
  return assignments
    .filter(Boolean)
    .map((assignment) => {
      const base = assignment.servicio
        || findServiceById(assignment.servicio_id)
        || sanitizeService({ id: assignment.servicio_id });
      if (!base) return null;
      return { ...base, __assignmentActivo: assignment.activo !== false };
    })
    .filter(Boolean);
}

function findPlanById(id) {
  const targetId = normalizeId(id);
  if (!targetId) return null;
  return (state.catalogs.planes || []).find((plan) => plan.id === targetId) || null;
}

function findServiceById(id) {
  const targetId = normalizeId(id);
  if (!targetId) return null;
  return (state.catalogs.servicios || []).find((svc) => svc.id === targetId) || null;
}

function showScopeError(formKey, message) {
  const scope = getScopeDom(formKey);
  if (!scope?.error) return;
  if (message) {
    scope.error.textContent = message;
  }
  scope.error.classList.remove('d-none');
}

function clearScopeError(formKey) {
  const scope = getScopeDom(formKey);
  if (!scope?.error) return;
  scope.error.classList.add('d-none');
}

function determineScopeType(planId, servicioId, fallbackAmbito) {
  if (planId && servicioId) return SCOPE_TYPES.PLAN_SERVICIO;
  if (planId) return SCOPE_TYPES.PLAN;
  if (servicioId) return SCOPE_TYPES.SERVICIO;
  if (fallbackAmbito === 'plan') return SCOPE_TYPES.PLAN;
  if (fallbackAmbito === 'servicio') return SCOPE_TYPES.SERVICIO;
  return '';
}

function renderComisiones() {
  const filtered = applyComisionFilters(state.comisiones.items);
  const sorted = sortByDefaultOrder(filtered);
  const paginated = paginate(sorted, state.comisiones.paginator);
  state.comisiones.paginator.total = filtered.length;

  const body = state.dom.comisiones.tableBody;
  if (!body) return;
  body.innerHTML = '';

  paginated.forEach((comision) => {
    const tr = document.createElement('tr');
    tr.dataset.id = comision.id;
    tr.innerHTML = comisionRowTemplate(comision);
    body.appendChild(tr);
    attachRelativeTooltip(tr.querySelector('[data-updated]'), comision.actualizado_el);
  });

  renderComisionPagination();
}

function comisionRowTemplate(comision) {
  const chip = statusChip(comision);
  const rolBadge = `<span class="badge bg-primary">${
    comision.rol_aplica === 'abogado' ? 'Abogado' : 'Cliente'
  }</span>`;
  const displayName = comision.descripcion
    ? escapeHtml(comision.descripcion)
    : `Comisión #${comision.id}`;
  const identifier = comision.id != null ? `ID ${comision.id}` : '';
  const metadataParts = [chip];
  if (identifier) {
    metadataParts.push(`<span class="text-muted small">${identifier}</span>`);
  }
  const metadata = metadataParts.filter(Boolean).join('');
  return `
    <td>
      <div class="fw-semibold">${displayName}</div>
      <div class="d-flex flex-wrap align-items-center gap-2 mt-1">${metadata}</div>
    </td>
    <td>
      <div class="fw-semibold">${ambitoLabel(comision)}</div>
      <div class="small text-muted">${scopeTypeLabel(comision)}</div>
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
  const hasServicio = !!filters.servicio;
  const hasPlan = !!filters.plan;
  return items.filter((item) => {
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    const scopeType = resolveScopeType(item);
    if (hasServicio && !matchesAutocomplete(item, filters.servicio, 'servicio')) return false;
    if (hasPlan && !matchesAutocomplete(item, filters.plan, 'plan')) return false;
    if (!hasServicio && hasPlan && scopeType === SCOPE_TYPES.SERVICIO) return false;
    if (!hasPlan && hasServicio && scopeType === SCOPE_TYPES.PLAN) return false;
    return true;
  });
}

function resetComisionFilters() {
  state.comisiones.pendingFilters = createEmptyScopeFilters();
  syncComisionFilterInputs();
}

function setComisionFilterDraft(key, value) {
  state.comisiones.pendingFilters[key] = typeof value === 'string' ? value.trim() : value;
}

function syncComisionFilterInputs() {
  const { filters } = state.dom.comisiones;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset' || key === 'apply') return;
    const nextValue = state.comisiones.pendingFilters[key] || '';
    if (input.value !== nextValue) {
      input.value = nextValue;
    }
  });
}

function applyComisionFilterChanges() {
  state.comisiones.filters = { ...state.comisiones.pendingFilters };
  state.comisiones.paginator.page = 1;
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

function handleComisionesTableClick(event) {
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  if (event.target.matches('button[data-action="edit"]')) {
    openComisionForm('edit', id);
  } else if (event.target.matches('button[data-action="audit"]')) {
    openAuditoria('comisiones', id);
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

async function openComisionForm(mode, id) {
  const form = state.dom.comisiones.form;
  const modalElement = state.dom.comisiones.formModal;
  if (!form || !modalElement) return;
  const modal = getBootstrapModal(modalElement);

  state.comisiones.form.mode = mode;
  state.comisiones.form.data =
    mode === 'edit' ? state.comisiones.items.find((item) => item.id === id) : null;

  await populateComisionForm();
  modal.show();
}

async function populateComisionForm() {
  const { form, formModal } = state.dom.comisiones;
  if (!form) return;
  const data = state.comisiones.form.data || getDefaultComision();
  await prepareScopeOptions('comisiones', data);
  form.querySelector('[name="descripcion"]').value = data.descripcion || '';
  form.querySelector('[name="rol_aplica"]').value = data.rol_aplica || 'cliente';
  form.querySelector('[name="porcentaje"]').value = (data.porcentaje ?? '').toString();
  form.querySelector('[name="vigencia_desde"]').value = data.vigencia_desde || '';
  form.querySelector('[name="vigencia_hasta"]').value = data.vigencia_hasta || '';
  form.querySelector('[name="activo"]').checked = data.activo !== false;

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

  const scopeControls = state.dom.comisiones.scope || {};
  const scopeType = scopeControls.hidden?.value || '';
  const planId = parseOptionalId(form.plan_id?.value);
  const servicioId = parseOptionalId(form.servicio_id?.value);
  clearScopeError('comisiones');

  if (!scopeType) {
    showScopeError('comisiones', 'Selecciona el ámbito de aplicación antes de guardar.');
    return;
  }

  if (
    (scopeType === SCOPE_TYPES.PLAN || scopeType === SCOPE_TYPES.PLAN_SERVICIO) &&
    !planId
  ) {
    scopeControls.planSelect?.classList.add('is-invalid');
    showScopeError('comisiones', 'Selecciona un plan para definir el ámbito.');
    scopeControls.planSelect?.focus();
    return;
  }
  scopeControls.planSelect?.classList.remove('is-invalid');

  if (
    (scopeType === SCOPE_TYPES.SERVICIO || scopeType === SCOPE_TYPES.PLAN_SERVICIO) &&
    !servicioId
  ) {
    scopeControls.servicioSelect?.classList.add('is-invalid');
    showScopeError('comisiones', 'Selecciona un servicio para definir el ámbito.');
    scopeControls.servicioSelect?.focus();
    return;
  }
  scopeControls.servicioSelect?.classList.remove('is-invalid');

  const base = state.comisiones.form.data || {};
  const payload = {
    descripcion: form.descripcion.value.trim() || null,
    rol_aplica: form.rol_aplica.value,
    porcentaje,
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
    activo: form.activo.checked,
    plan_id: planId,
    servicio_id: servicioId,
  };

  const requestBody = {
    ...(base.id ? { id: base.id } : {}),
    ...payload,
    actualizado_el: base.actualizado_el || null,
  };

  const conflict = findComisionConflict(requestBody, state.comisiones.form.data?.id);
  if (conflict) {
    showComisionConflictModal(conflict, requestBody);
    return;
  }

  await persistComision(requestBody, state.comisiones.form);
}


function findComisionConflict(comision, ignoreId) {
  return state.comisiones.items.find((item) => {
    if (item.id === ignoreId) return false;
    if (!hasSameScope(item, comision)) return false;
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
  const modalElement = state.dom.comisiones.conflictModal;
  const modal = getBootstrapModal(modalElement);
  if (!modal) return;
  assignConflictContext(modalElement, modal, conflict, payload);
  modal.show();
}

async function resolveComisionConflict(action) {
  const modalElement = state.dom.comisiones.conflictModal;
  const modal = getBootstrapModal(modalElement);
  const context = readConflictContext(modalElement, modal);
  const payload = context?.payload;
  const conflict = context?.conflict;
  if (!modal || !payload || !conflict) return;

  modal.hide();
  if (action === 'cancelar') {
    clearConflictContext(modalElement, modal);
    return;
  }

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
    clearConflictContext(modalElement, modal);
  } catch (error) {
    console.error('Error resolviendo conflicto', error);
    window.alert('No se pudo resolver el conflicto.');
  }
}

function assignConflictContext(modalElement, modalInstance, conflict, payload) {
  if (!modalInstance) return;
  const safePayload = cloneConflictPayload(payload);
  modalInstance.relatedPayload = safePayload;
  modalInstance.relatedConflict = conflict || null;
  if (modalElement) {
    modalElement.__lbConflictContext = { payload: safePayload, conflict: conflict || null };
  }
}

function readConflictContext(modalElement, modalInstance) {
  if (modalInstance?.relatedPayload && modalInstance?.relatedConflict) {
    return { payload: modalInstance.relatedPayload, conflict: modalInstance.relatedConflict };
  }
  const stored = modalElement?.__lbConflictContext;
  if (stored?.payload && stored?.conflict) {
    return stored;
  }
  return null;
}

function clearConflictContext(modalElement, modalInstance) {
  if (modalInstance) {
    modalInstance.relatedPayload = null;
    modalInstance.relatedConflict = null;
  }
  if (modalElement && modalElement.__lbConflictContext) {
    delete modalElement.__lbConflictContext;
  }
}

function cloneConflictPayload(source) {
  if (source == null) return source ?? null;
  if (typeof source !== 'object') return source;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(source);
    } catch (error) {
      // Fallback if structuredClone fails
    }
  }
  try {
    return JSON.parse(JSON.stringify(source));
  } catch (error) {
    return { ...source };
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
    const responseBody = await response.json();
    const saved = resolveEntityFromResponse(responseBody, 'comision');
    if (!saved?.id) {
      throw new Error('La respuesta del servidor no contiene la comisión guardada.');
    }
    upsertComision(saved);
    state.dom.comisiones.form.reset();
    await prepareScopeOptions('comisiones', getDefaultComision());
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

function exportComisiones() {
  const params = new URLSearchParams();
  const { estado, servicio, plan } = state.comisiones.filters;
  params.set('estado', estado || '');
  if (servicio) params.set('servicio', servicio);
  if (plan) params.set('plan', plan);
  const query = params.toString();
  const url = `${API_BASE_URL}/comisiones/export${query ? `?${query}` : ''}`;
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

  simulator.open?.addEventListener('click', () => {
    simulator.modalInstance?.show();
    renderSimulator();
  });

  simulator.ambito?.addEventListener('change', () => {
    state.simulator.inputs.ambito = simulator.ambito?.value || 'servicio';
    updateSimulatorScopeUi({ resetService: true }).catch((error) => {
      console.error('Error actualizando el ámbito del simulador', error);
    });
  });

  simulator.planSelect?.addEventListener('change', () => {
    simulator.planSelect.classList.remove('is-invalid');
    state.simulator.inputs.planId = parseOptionalId(simulator.planSelect.value);
    updateSimulatorScopeUi({ preserveSelections: true }).catch((error) => {
      console.error('Error actualizando el plan del simulador', error);
    });
    hideSimulatorScopeError();
  });

  simulator.servicioSelect?.addEventListener('change', () => {
    simulator.servicioSelect.classList.remove('is-invalid');
    state.simulator.inputs.servicioId = parseOptionalId(simulator.servicioSelect.value);
    hideSimulatorScopeError();
    refreshSimulatorRuleSelectors().catch((error) => {
      console.error('Error cargando reglas del simulador', error);
    });
  });

  simulator.tarifaSelect?.addEventListener('change', () => {
    handleSimulatorTarifaChange();
  });

  simulator.comisionSelect?.addEventListener('change', () => {
    handleSimulatorComisionChange();
  });

  simulator.monedaSelect?.addEventListener('change', () => {
    const moneda = simulator.monedaSelect.value || null;
    state.simulator.inputs.moneda = moneda;
  });

  simulator.modal?.addEventListener('shown.bs.modal', () => {
    prepareSimulatorForm()
      .then(() => {
        renderSimulator();
        simulator.ambito?.focus();
      })
      .catch((error) => {
        console.error('Error preparando el simulador', error);
        renderSimulator();
      });
  });

  simulator.modal?.addEventListener('hidden.bs.modal', () => {
    state.simulator.loading = false;
    state.simulator.result = null;
    simulator.planSelect?.classList.remove('is-invalid');
    simulator.servicioSelect?.classList.remove('is-invalid');
    simulator.tarifaSelect?.classList.remove('is-invalid');
    simulator.tarifaError?.classList.add('d-none');
    hideSimulatorScopeError();
    state.simulator.meta = {
      tipoCalculo: null,
      requiresConsumoIa: false,
      showMonedaSelect: false,
      autoComisiones: { clienteId: null, abogadoId: null },
    };
    state.simulator.inputs.comisionSeleccion = 'auto';
    state.simulator.inputs.comisiones = { clienteId: null, abogadoId: null };
    state.simulator.inputs.consumoIa = 0;
    state.simulator.inputs.moneda = null;
    updateSimulatorDynamicFields();
    renderSimulator();
  });

  simulator.form?.addEventListener('submit', submitSimulator);
}

async function prepareSimulatorForm() {
  const { simulator } = state.dom;
  if (!simulator?.form) return;
  const inputs = state.simulator.inputs || {};
  if (simulator.ambito) {
    const fallback = inputs.ambito || 'servicio';
    simulator.ambito.value = fallback;
  }
  if (simulator.comisionSelect) {
    simulator.comisionSelect.value = inputs.comisionSeleccion || 'auto';
  }
  if (simulator.consumoIa) {
    simulator.consumoIa.value =
      typeof inputs.consumoIa === 'number' && Number.isFinite(inputs.consumoIa)
        ? inputs.consumoIa
        : '';
  }

  await updateSimulatorScopeUi({
    planId: inputs.planId,
    servicioId: inputs.servicioId,
    preserveSelections: true,
  });

  updateSimulatorDynamicFields();

  if (simulator.planSelect && inputs.planId) {
    simulator.planSelect.value = String(inputs.planId);
  }
  if (simulator.servicioSelect && inputs.servicioId) {
    simulator.servicioSelect.value = String(inputs.servicioId);
  }

  if (simulator.tarifaSelect && inputs.tarifaId != null) {
    simulator.tarifaSelect.value = String(inputs.tarifaId);
  }
  if (simulator.monedaSelect && inputs.moneda) {
    simulator.monedaSelect.value = inputs.moneda;
  }
}

function hideSimulatorScopeError() {
  const { simulator } = state.dom;
  if (!simulator?.scopeError) return;
  simulator.scopeError.classList.add('d-none');
  simulator.scopeError.textContent =
    simulator.scopeError.dataset.defaultMessage ||
    'Selecciona el ámbito y los identificadores requeridos.';
}

function showSimulatorScopeError(message) {
  const { simulator } = state.dom;
  if (!simulator?.scopeError) return;
  if (simulator.scopeError.dataset) {
    simulator.scopeError.dataset.defaultMessage = simulator.scopeError.dataset.defaultMessage
      || simulator.scopeError.textContent
      || 'Selecciona el ámbito y los identificadores requeridos.';
  }
  simulator.scopeError.textContent = message || simulator.scopeError.dataset.defaultMessage;
  simulator.scopeError.classList.remove('d-none');
}

async function updateSimulatorScopeUi(options = {}) {
  const { simulator } = state.dom;
  if (!simulator) return;

  const scopeType = simulator.ambito?.value || 'servicio';
  const planRequired = scopeType === SCOPE_TYPES.PLAN || scopeType === 'plan'
    || scopeType === SCOPE_TYPES.PLAN_SERVICIO;
  const servicioRequired = scopeType === SCOPE_TYPES.SERVICIO || scopeType === 'servicio'
    || scopeType === SCOPE_TYPES.PLAN_SERVICIO;

  if (simulator.planGroup) {
    simulator.planGroup.classList.toggle('d-none', !planRequired);
  }
  if (simulator.servicioGroup) {
    simulator.servicioGroup.classList.toggle('d-none', !servicioRequired);
  }

  const selectedPlanId =
    options.planId !== undefined
      ? options.planId
      : parseOptionalId(simulator.planSelect?.value);

  const selectedServicioId = options.resetService
    ? null
    : options.servicioId !== undefined
    ? options.servicioId
    : parseOptionalId(simulator.servicioSelect?.value);

  if (simulator.planSelect) {
    if (planRequired) {
      simulator.planSelect.setAttribute('required', '');
      try {
        await ensurePlanCatalogs();
        populatePlanOptions(simulator.planSelect, selectedPlanId);
      } catch (error) {
        console.error('Error cargando planes para el simulador', error);
      }
      if (selectedPlanId) {
        simulator.planSelect.value = String(selectedPlanId);
      }
    } else {
      simulator.planSelect.removeAttribute('required');
      simulator.planSelect.value = '';
    }
  }

  await populateSimulatorServiceOptions({
    scopeType,
    planId: selectedPlanId,
    selectedServiceId: selectedServicioId,
    reset: options.resetService,
  });

  if (!planRequired && !servicioRequired) {
    hideSimulatorScopeError();
  }

  if (options.skipRules !== true) {
    await refreshSimulatorRuleSelectors({
      scopeType,
      planId: selectedPlanId,
      servicioId: selectedServicioId,
    });
  }
}

async function populateSimulatorServiceOptions({
  scopeType,
  planId,
  selectedServiceId,
  reset,
}) {
  const { simulator } = state.dom;
  if (!simulator?.servicioSelect) return;

  const select = simulator.servicioSelect;
  const normalizedScope = scopeType || 'servicio';
  let services = [];
  let placeholder = 'Selecciona un servicio';
  let disable = false;

  select.innerHTML = '<option value="">Cargando servicios...</option>';
  select.disabled = true;

  try {
    if (normalizedScope === SCOPE_TYPES.PLAN_SERVICIO || normalizedScope === 'plan-servicio') {
      if (planId) {
        await ensurePlanCatalogs();
        await ensureServiceCatalogs();
        await ensurePlanAssignments(planId);
        services = getServicesForPlan(planId);
        placeholder = services.length
          ? 'Selecciona un servicio'
          : 'No hay servicios vinculados al plan';
        disable = services.length === 0;
      } else {
        disable = true;
        placeholder = 'Selecciona un plan para ver servicios';
      }
    } else if (normalizedScope === SCOPE_TYPES.SERVICIO || normalizedScope === 'servicio') {
      await ensureServiceCatalogs();
      services = [...(state.catalogs.servicios || [])];
      placeholder = services.length
        ? 'Selecciona un servicio'
        : 'No hay servicios disponibles';
      disable = services.length === 0;
    } else {
      disable = true;
      placeholder = 'Selecciona un ámbito para continuar';
    }
  } catch (error) {
    console.error('Error cargando servicios para el simulador', error);
    services = [];
    disable = true;
    placeholder = 'No se pudieron cargar los servicios';
  }

  const desiredId = reset ? null : normalizeId(selectedServiceId);
  const seen = new Set();
  const unique = [];
  services.forEach((service) => {
    const sanitized = sanitizeService(service);
    if (!sanitized || seen.has(sanitized.id)) return;
    seen.add(sanitized.id);
    unique.push({
      ...sanitized,
      __assignmentActivo: service?.__assignmentActivo !== undefined
        ? service.__assignmentActivo
        : sanitized.activo,
    });
  });

  unique.sort((a, b) => {
    const labelA = (a.nombre || a.codigo || '').toString();
    const labelB = (b.nombre || b.codigo || '').toString();
    return labelA.localeCompare(labelB, 'es', { sensitivity: 'base' });
  });

  select.innerHTML = `<option value="">${placeholder}</option>`;
  unique.forEach((service) => {
    const option = document.createElement('option');
    option.value = service.id;
    const parts = [];
    if (service.nombre) parts.push(service.nombre);
    if (service.codigo && service.codigo !== service.nombre) parts.push(service.codigo);
    const baseLabel = parts.length ? parts.join(' · ') : `ID ${service.id}`;
    const suffixes = [];
    if (service.activo === false) suffixes.push('servicio inactivo');
    if (service.__assignmentActivo === false) suffixes.push('vinculación inactiva');
    const suffix = suffixes.length ? ` (${suffixes.join(' · ')})` : '';
    option.textContent = `${baseLabel}${suffix}`;
    select.appendChild(option);
  });

  select.disabled = disable;
  if (!disable && desiredId) {
    select.value = String(desiredId);
  } else {
    select.value = '';
  }
}

function updateSimulatorDynamicFields() {
  const { simulator } = state.dom;
  if (!simulator?.form) return;

  const meta = state.simulator.meta || {};
  const requiresConsumoIa = !!meta.requiresConsumoIa;

  const consumoIaGroup = simulator.consumoIaGroup;
  const consumoIaInput = simulator.consumoIa;
  if (consumoIaGroup) {
    consumoIaGroup.classList.toggle('d-none', !requiresConsumoIa);
  }
  if (consumoIaInput) {
    if (requiresConsumoIa) {
      consumoIaInput.removeAttribute('disabled');
      consumoIaInput.setAttribute('min', '0');
    } else {
      consumoIaInput.value = '';
      consumoIaInput.setAttribute('disabled', '');
    }
    consumoIaInput.removeAttribute('required');
  }

  if (simulator.monedaGroup) {
    simulator.monedaGroup.classList.toggle('d-none', meta.showMonedaSelect !== true);
  }

  if (simulator.monedaSelect) {
    if (meta.showMonedaSelect) {
      simulator.monedaSelect.removeAttribute('disabled');
    } else {
      simulator.monedaSelect.setAttribute('disabled', '');
    }
  }
}

function renderSimulator() {
  const { simulator } = state.dom;
  if (!simulator) return;

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
  const { simulator } = state.dom;

  state.simulator.loading = true;
  renderSimulator();

  const scopeRaw = form.ambito?.value || 'servicio';
  const scopeNormalized = scopeRaw || 'servicio';
  const planId = parseOptionalId(form.plan_id?.value);
  const servicioId = parseOptionalId(form.servicio_id?.value);
  const tarifaId = parseOptionalId(form.tarifa_id?.value);
  const monedaSeleccionada = form.moneda?.value?.trim().toUpperCase() || null;
  const fechaReferencia = new Date().toISOString().slice(0, 10);
  const consumoIaValue = Number(form.consumo_ia?.value);
  const consumoIa = Number.isFinite(consumoIaValue) && consumoIaValue >= 0 ? consumoIaValue : 0;

  let hasError = false;
  const requiresPlan =
    scopeNormalized === 'plan' || scopeNormalized === SCOPE_TYPES.PLAN || scopeNormalized === SCOPE_TYPES.PLAN_SERVICIO;
  const requiresServicio =
    scopeNormalized === 'servicio' || scopeNormalized === SCOPE_TYPES.SERVICIO || scopeNormalized === SCOPE_TYPES.PLAN_SERVICIO;

  if (requiresPlan && !planId) {
    simulator?.planSelect?.classList.add('is-invalid');
    showSimulatorScopeError('Selecciona un plan para simular en este ámbito.');
    hasError = true;
  } else {
    simulator?.planSelect?.classList.remove('is-invalid');
  }

  if (requiresServicio && !servicioId) {
    simulator?.servicioSelect?.classList.add('is-invalid');
    showSimulatorScopeError('Selecciona un servicio para simular en este ámbito.');
    hasError = true;
  } else if (!hasError) {
    simulator?.servicioSelect?.classList.remove('is-invalid');
  }

  if (!requiresPlan && !requiresServicio) {
    hideSimulatorScopeError();
  }

  if (Number(form.consumo_ia?.value) < 0) {
    form.consumo_ia.classList.add('is-invalid');
    hasError = true;
  } else {
    form.consumo_ia?.classList.remove('is-invalid');
  }

  simulator?.tarifaSelect?.classList.remove('is-invalid');
  simulator?.tarifaError?.classList.add('d-none');

  if (hasError) {
    state.simulator.loading = false;
    renderSimulator();
    return;
  }

  hideSimulatorScopeError();

  const previousInputs = state.simulator.inputs || {};
  state.simulator.inputs = {
    ambito: scopeNormalized,
    planId,
    servicioId,
    consumoIa,
    tarifaId: tarifaId ?? previousInputs.tarifaId ?? null,
    comisiones: {
      clienteId: previousInputs.comisiones?.clienteId ?? null,
      abogadoId: previousInputs.comisiones?.abogadoId ?? null,
    },
    comisionSeleccion: previousInputs.comisionSeleccion || 'auto',
    moneda: monedaSeleccionada || previousInputs.moneda || null,
  };

  try {
    const tarifasDisponibles = Array.isArray(state.simulator.options.tarifas)
      ? state.simulator.options.tarifas
      : [];
    let tarifa = null;
    if (tarifaId != null) {
      tarifa = tarifasDisponibles.find((item) => normalizeId(item.id) === normalizeId(tarifaId)) || null;
    }
    if (!tarifa) {
      tarifa = selectBestScopedRule(tarifasDisponibles, {
        planId,
        servicioId,
        fecha: fechaReferencia,
      });
    }
    if (!tarifa && tarifaId != null) {
      tarifa = await fetchSimulatorTarifa({ tarifaId });
    }
    if (!tarifa) {
      tarifa = await fetchSimulatorTarifa({
        scope: scopeNormalized,
        planId,
        servicioId,
        fecha: fechaReferencia,
      });
    }

    if (!tarifa) {
      throw new Error('No hay tarifa vigente para esta operación');
    }

    state.simulator.inputs.tarifaId = tarifa.id ?? null;

    const tipoCalculo = (tarifa.tipo_calculo || tarifa.tipoCalculo || '').toLowerCase();
    state.simulator.meta = {
      ...state.simulator.meta,
      tipoCalculo: tipoCalculo || null,
      requiresConsumoIa: tipoCalculo === 'consumo_ia',
    };

    const econ = await ensureQuickEconconfigData();
    const impuesto = await ensureQuickImpuestoData(fechaReferencia);
    if (!state.simulator.inputs.comisiones) {
      state.simulator.inputs.comisiones = { clienteId: null, abogadoId: null };
    }

    const resolverComision = async (rol) => {
      const key = rol === 'abogado' ? 'abogado' : 'cliente';
      const seleccionModo = state.simulator.inputs.comisionSeleccion || 'auto';
      if (seleccionModo === 'none') return null;
      if (seleccionModo.startsWith('cliente:') && key === 'abogado') return null;
      if (seleccionModo.startsWith('abogado:') && key === 'cliente') return null;
      const storedId = state.simulator.inputs.comisiones?.[`${key}Id`];
      const listado = Array.isArray(state.simulator.options.comisiones?.[key])
        ? state.simulator.options.comisiones[key]
        : [];

      let comisionSeleccionada = null;
      if (storedId != null) {
        comisionSeleccionada =
          listado.find((item) => normalizeId(item.id) === normalizeId(storedId)) || null;
      }
      if (!comisionSeleccionada) {
        comisionSeleccionada = selectBestScopedRule(listado, {
          planId,
          servicioId,
          fecha: fechaReferencia,
        });
      }
      if (!comisionSeleccionada) {
        comisionSeleccionada = await ensureQuickComisionData({
          rol: key,
          planId,
          servicioId,
          fecha: fechaReferencia,
        });
      }
      if (comisionSeleccionada?.id != null) {
        state.simulator.inputs.comisiones[`${key}Id`] = comisionSeleccionada.id;
      }
      return comisionSeleccionada || null;
    };
    
    const comisionCliente = await resolverComision('cliente');
    const comisionAbogado = await resolverComision('abogado');

    const moneda =
      monedaSeleccionada
      || state.simulator.inputs.moneda
      || econ?.moneda_defecto
      || econ?.monedaDefecto
      || state.monedaFallback;

    state.simulator.inputs.moneda = moneda;

    state.simulator.result = buildSimulationBreakdown({
      tarifa,
      econ,
      impuesto,
      comisiones: [comisionCliente, comisionAbogado].filter(Boolean),
      consumoIa,
      scope: scopeNormalized,
      planId,
      servicioId,
      fecha: fechaReferencia,
      monedaSeleccionada: moneda,
    });
  } catch (error) {
    console.error('Error simulando', error);
    const moneda = state.quick.econconfig?.moneda_defecto || state.monedaFallback;
    state.simulator.meta = {
      tipoCalculo: null,
      requiresConsumoIa: false,
      showMonedaSelect: state.simulator.meta?.showMonedaSelect === true,
      autoComisiones: state.simulator.meta?.autoComisiones || { clienteId: null, abogadoId: null },
    };
    const monedaResuelta = monedaSeleccionada || state.simulator.inputs.moneda || moneda;
    state.simulator.result = {
      error: error.message === 'No hay tarifa vigente para esta operación'
        ? 'No hay tarifa vigente para esta operación'
        : error.message || 'No se pudo generar la simulación.',
      subtotal: 0,
      subtotalGravado: 0,
      base: 0,
      descuento: 0,
      impuestos: 0,
      tarifaIa: 0,
      tarifaIaDetalle: { monto: 0, consumoIa, tarifaUnit: 0, extraIa: 0, gravado: true },
      comisionPlataforma: 0,
      retencion: 0,
      totalCliente: 0,
      netoAbogado: 0,
      moneda: monedaResuelta,
      totalNoGravado: 0,
      tarifa: null,
      comisiones: { cliente: null, abogado: null },
      comisionClienteRegla: null,
      comisionAbogadoRegla: null,
      impuesto: null,
      econconfig: state.quick.econconfig || null,
      scope: { tipo: scopeNormalized, planId, servicioId },
      consumoIa,
      fecha: fechaReferencia,
      lineasNoGravables: [],
      monedaSeleccionada: monedaResuelta,
    };
  } finally {
    state.simulator.loading = false;
    updateSimulatorDynamicFields();
    renderSimulator();
  }
}

function simulatorResultTemplate(result) {
  const moneda = result?.moneda || state.quick.econconfig?.moneda_defecto || state.monedaFallback;
  if (!result) {
    return `
      <div class="card card-body text-center text-muted">
        Complete los datos y presione "Simular".
      </div>
    `;
  }

  const subtotal = formatCurrency(result.subtotal ?? 0, moneda);
  const subtotalGravado = formatCurrency(result.subtotalGravado ?? result.subtotal ?? 0, moneda);
  const base = formatCurrency(result.base ?? 0, moneda);
  const descuentoValue = Number(result.descuento ?? 0);
  const descuento =
    descuentoValue > 0
      ? `- ${formatCurrency(descuentoValue, moneda)}`
      : formatCurrency(0, moneda);
  const impuestos = formatCurrency(result.impuestos ?? 0, moneda);
  const tarifaIaDetalle = result.tarifaIaDetalle || {};
  const tarifaIa = formatCurrency(result.tarifaIa ?? 0, moneda);
  const tarifaIaLabel = tarifaIaDetalle.gravado === false ? 'Tarifa IA (no gravable)' : 'Tarifa IA';
  const totalNoGravado = formatCurrency(result.totalNoGravado ?? 0, moneda);
  const comisionesDetalle = result.comisiones || {};
  const comisionPlataformaMonto =
    comisionesDetalle.cliente?.monto ?? result.comisionPlataforma ?? 0;
  const retencionMonto = comisionesDetalle.abogado?.monto ?? result.retencion ?? 0;
  const comisionPlataforma = formatCurrency(comisionPlataformaMonto, moneda);
  const retencion = formatCurrency(retencionMonto, moneda);
  const totalCliente = formatCurrency(result.totalCliente ?? 0, moneda);
  const netoAbogado = formatCurrency(result.netoAbogado ?? 0, moneda);

  const tarifaInfo = result.tarifa || {};
  const comisionClienteInfo =
    comisionesDetalle.cliente?.regla || result.comisionClienteRegla || {};
  const comisionAbogadoInfo =
    comisionesDetalle.abogado?.regla || result.comisionAbogadoRegla || {};
  const impuestoInfo = result.impuesto || {};
  const econInfo = result.econconfig || {};
  const scopeInfo = result.scope || {};

  const tipoLabel = tarifaInfo.tipo_calculo
    ? TARIFA_TIPO_CALCULO_LABEL[tarifaInfo.tipo_calculo] || tarifaInfo.tipo_calculo
    : '—';
  const incluyeImpuestoLabel = tarifaInfo.incluye_impuesto === false ? 'No' : tarifaInfo.incluye_impuesto === true ? 'Sí' : '—';
  const scopeLabel = scopeInfo.tipo || '—';
  const planLabel = scopeInfo.planId != null ? scopeInfo.planId : '—';
  const servicioLabel = scopeInfo.servicioId != null ? scopeInfo.servicioId : '—';

  const comisionClientePct =
    comisionClienteInfo?.porcentaje != null
      ? formatPercentage(comisionClienteInfo.porcentaje)
      : '—';
  const comisionAbogadoPct =
    comisionAbogadoInfo?.porcentaje != null
      ? formatPercentage(comisionAbogadoInfo.porcentaje)
      : '—';
  const impuestoPct =
    impuestoInfo?.porcentaje != null ? formatPercentage(impuestoInfo.porcentaje) : '—';

  const consumoIaValor = Number.isFinite(result.consumoIa) ? result.consumoIa : 0;
  const lineasNoGravables = Array.isArray(result.lineasNoGravables)
    ? result.lineasNoGravables.filter((linea) => linea && Number(linea.monto) > 0)
    : [];

  const detalleNoGravado = lineasNoGravables.length
    ? `
      <div class="mt-3">
        <h6 class="mb-2">Detalle de líneas no gravables</h6>
        <ul class="list-unstyled small mb-0">
          ${lineasNoGravables
            .map((linea) => {
              const monto = formatCurrency(linea.monto ?? 0, moneda);
              const incluye = linea.incluyeImpuesto ? ' (incluye impuesto)' : '';
              const extras = [];
              if (linea?.metadata?.consumoIa) {
                extras.push(`consumo IA ${escapeHtml(String(linea.metadata.consumoIa))}`);
              }
              if (linea?.metadata?.extraIa) {
                extras.push(`extra ${formatCurrency(linea.metadata.extraIa, moneda)}`);
              }
              const extraLabel = extras.length ? ` <span class="text-muted">(${escapeHtml(extras.join(' · '))})</span>` : '';
              return `<li>${escapeHtml(linea.descripcion || 'Concepto')}: ${monto}${escapeHtml(incluye)}${extraLabel}</li>`;
            })
            .join('')}
        </ul>
      </div>
    `
    : '';

  return `
    <div class="card">
      <div class="card-body">
        ${
          result.error
            ? `<div class="alert alert-danger" role="alert">${escapeHtml(result.error)}</div>`
            : ''
        }
        <h5 class="card-title">Desglose del pago</h5>
        <dl class="row mb-0">
          <dt class="col-sm-6">Base gravable</dt>
          <dd class="col-sm-6 text-end">${base}</dd>
          <dt class="col-sm-6">${escapeHtml(tarifaIaLabel)}</dt>
          <dd class="col-sm-6 text-end">${tarifaIa}</dd>
          <dt class="col-sm-6">Subtotal gravado</dt>
          <dd class="col-sm-6 text-end">${subtotalGravado}</dd>
          <dt class="col-sm-6">Líneas no gravables</dt>
          <dd class="col-sm-6 text-end">${totalNoGravado}</dd>
          <dt class="col-sm-6">Subtotal</dt>
          <dd class="col-sm-6 text-end">${subtotal}</dd>
          <dt class="col-sm-6">Descuento</dt>
          <dd class="col-sm-6 text-end">${descuento}</dd>
          <dt class="col-sm-6">Impuestos</dt>
          <dd class="col-sm-6 text-end">${impuestos}</dd>
          <dt class="col-sm-6">Comisión plataforma</dt>
          <dd class="col-sm-6 text-end">${comisionPlataforma}</dd>
          <dt class="col-sm-6">Retención</dt>
          <dd class="col-sm-6 text-end">${retencion}</dd>
          <dt class="col-sm-6">Total cliente</dt>
          <dd class="col-sm-6 text-end">${totalCliente}</dd>
          <dt class="col-sm-6">Neto abogado</dt>
          <dd class="col-sm-6 text-end">${netoAbogado}</dd>
        </dl>
        ${detalleNoGravado}
      </div>
      <div class="card-footer bg-light">
        <h6 class="mb-2">Metadatos</h6>
        <ul class="list-unstyled mb-0 small">
          <li>Tarifa ID: ${tarifaInfo.id != null ? escapeHtml(String(tarifaInfo.id)) : '—'} (${escapeHtml(tipoLabel)})</li>
          <li>Descripción tarifa: ${escapeHtml(tarifaInfo.descripcion || '—')}</li>
          <li>Incluye impuesto: ${escapeHtml(incluyeImpuestoLabel)}</li>
          <li>Comisión cliente ID: ${
            comisionClienteInfo.id != null ? escapeHtml(String(comisionClienteInfo.id)) : '—'
          } (${escapeHtml(comisionClientePct)}) · Monto: ${comisionPlataforma}</li>
          <li>Descripción comisión cliente: ${escapeHtml(comisionClienteInfo.descripcion || '—')}</li>
          <li>Comisión abogado ID: ${
            comisionAbogadoInfo.id != null ? escapeHtml(String(comisionAbogadoInfo.id)) : '—'
          } (${escapeHtml(comisionAbogadoPct)}) · Monto: ${retencion}</li>
          ${
            comisionesDetalle.abogado?.componentes
              ? `<li>Detalle retención: porcentaje ${formatCurrency(
                  comisionesDetalle.abogado.componentes.porcentaje ?? 0,
                  moneda
                )}, monto fijo ${formatCurrency(
                  comisionesDetalle.abogado.componentes.monto ?? 0,
                  moneda
                )}</li>`
              : ''
          }
          <li>Descripción comisión abogado: ${escapeHtml(comisionAbogadoInfo.descripcion || '—')}</li>
          <li>Impuesto ID: ${impuestoInfo.id != null ? escapeHtml(String(impuestoInfo.id)) : '—'} (${escapeHtml(
            impuestoPct
          )})</li>
          <li>Config. económica ID: ${econInfo.id != null ? escapeHtml(String(econInfo.id)) : '—'} (${escapeHtml(
            econInfo.regla_redondeo || '—'
          )}, decimales: ${escapeHtml(String(econInfo.decimales ?? '—'))})</li>
          <li>Moneda usada: ${escapeHtml(moneda)}</li>
          <li>Moneda seleccionada: ${escapeHtml(result.monedaSeleccionada || moneda)}</li>
          <li>Ámbito simulado: ${escapeHtml(scopeLabel)}</li>
          <li>Plan ID: ${escapeHtml(String(planLabel))}</li>
          <li>Servicio ID: ${escapeHtml(String(servicioLabel))}</li>
          <li>Consumo IA declarado: ${escapeHtml(String(consumoIaValor))}</li>
        </ul>
      </div>
    </div>
  `;
}

async function fetchSimulatorTarifa({ tarifaId, scope, planId, servicioId, fecha }) {
  try {
    if (!(state.quick.tarifasCache instanceof Map)) {
      state.quick.tarifasCache = new Map();
    }
    const cacheKey = tarifaId
      ? `id:${tarifaId}`
      : `scope:${scope || 'servicio'}|plan:${planId || 0}|servicio:${servicioId || 0}|fecha:${
          fecha || ''
        }`;
    if (state.quick.tarifasCache.has(cacheKey)) {
      const cached = state.quick.tarifasCache.get(cacheKey);
      return cached ? cloneEntity(cached) : null;
    }

    if (tarifaId) {
      const response = await apiGet(`/tarifas/${tarifaId}`);
      const body = await response.json();
      const tarifa = body?.tarifa || body;
      const resolved = tarifa?.id ? tarifa : null;
      state.quick.tarifasCache.set(cacheKey, resolved ? cloneEntity(resolved) : null);
      return resolved;
    }

    const items = await fetchSimulatorTarifasList({ scope, planId, servicioId, fecha });
    const selected = selectBestScopedRule(items, { planId, servicioId, fecha });
    state.quick.tarifasCache.set(cacheKey, selected ? cloneEntity(selected) : null);
    return selected;
  } catch (error) {
    console.error('Error obteniendo tarifa para el simulador', error);
    throw error;
  }
}

async function ensureQuickEconconfigData() {
  if (!state.quick.econconfig) {
    await loadEconconfig();
  }
  return state.quick.econconfig || null;
}

async function ensureQuickImpuestoData(fecha) {
  if (!(state.quick.impuestoCache instanceof Map)) {
    state.quick.impuestoCache = new Map();
  }
  const key = fecha || '__default__';
  if (state.quick.impuestoCache.has(key)) {
    return state.quick.impuestoCache.get(key);
  }

  if (!Array.isArray(state.quick.impuestos) || !state.quick.impuestos.length) {
    await loadImpuestos();
  }
  const impuesto = selectActiveImpuesto(state.quick.impuestos, fecha);
  state.quick.impuestoCache.set(key, impuesto || null);
  return impuesto || null;
}

async function ensureQuickComisionData({ rol, planId, servicioId, fecha }) {
  const normalizedRol = rol || 'cliente';
  if (!(state.quick.comisionesCache instanceof Map)) {
    state.quick.comisionesCache = new Map();
  }
  const key = `${normalizedRol}|${planId || 0}|${servicioId || 0}|${fecha || ''}`;
  if (state.quick.comisionesCache.has(key)) {
    return state.quick.comisionesCache.get(key);
  }

  const items = await fetchSimulatorComisionesList({
    rol: normalizedRol,
    planId,
    servicioId,
    fecha,
  });

  const selected = selectBestScopedRule(items, { planId, servicioId, fecha });
  state.quick.comisionesCache.set(key, selected || null);
  return selected || null;
}

function selectActiveImpuesto(items, fecha) {
  if (!Array.isArray(items)) return null;
  const targetDate = fecha || new Date().toISOString().slice(0, 10);
  const candidates = items.filter((item) => {
    if (!item || item.activo === false) return false;
    return isDateWithinRange(targetDate, item.vigencia_desde, item.vigencia_hasta);
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const dateA = a.actualizado_el || a.actualizadoEl || a.vigencia_desde || '';
    const dateB = b.actualizado_el || b.actualizadoEl || b.vigencia_desde || '';
    return String(dateB).localeCompare(String(dateA));
  });
  return candidates[0] || null;
}

async function fetchSimulatorTarifasList({ scope, planId, servicioId, fecha }) {
  const normalizedScope = scope || 'servicio';
  if (!(state.quick.tarifasCache instanceof Map)) {
    state.quick.tarifasCache = new Map();
  }
  const cacheKey = `list:${normalizedScope}|plan:${planId || 0}|servicio:${servicioId || 0}|fecha:${
    fecha || ''
  }`;
  if (state.quick.tarifasCache.has(cacheKey)) {
    const cached = state.quick.tarifasCache.get(cacheKey);
    return Array.isArray(cached) ? cached.map((item) => cloneEntity(item)) : [];
  }

  const params = { vigencia: 'vigentes' };
  if (fecha) params.fecha = fecha;
  if (planId) params.plan_id = planId;
  if (servicioId) params.servicio_id = servicioId;
  if (normalizedScope && normalizedScope !== 'general' && normalizedScope !== 'servicio') {
    params.ambito = normalizedScope;
  }

  try {
    const response = await apiGet('/tarifas', params);
    const body = await response.json();
    const items = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
      ? body
      : [];
    state.quick.tarifasCache.set(cacheKey, items.map((item) => cloneEntity(item)));
    return items.map((item) => cloneEntity(item));
  } catch (error) {
    console.error('Error obteniendo listado de tarifas para el simulador', error);
    state.quick.tarifasCache.set(cacheKey, []);
    return [];
  }
}

async function fetchSimulatorComisionesList({ rol, planId, servicioId, fecha }) {
  const normalizedRol = rol || 'cliente';
  if (!(state.quick.comisionesCache instanceof Map)) {
    state.quick.comisionesCache = new Map();
  }
  const cacheKey = `list:${normalizedRol}|${planId || 0}|${servicioId || 0}|${fecha || ''}`;
  if (state.quick.comisionesCache.has(cacheKey)) {
    const cached = state.quick.comisionesCache.get(cacheKey);
    return Array.isArray(cached) ? cached.map((item) => cloneEntity(item)) : [];
  }

  const params = {
    rol_aplica: normalizedRol,
    vigencia: 'vigentes',
  };
  if (fecha) params.fecha = fecha;
  if (planId) params.plan_id = planId;
  if (servicioId) params.servicio_id = servicioId;

  try {
    const response = await apiGet('/comisiones', params);
    const body = await response.json();
    const items = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body)
      ? body
      : [];
    state.quick.comisionesCache.set(cacheKey, items.map((item) => cloneEntity(item)));
    return items.map((item) => cloneEntity(item));
  } catch (error) {
    console.error('Error obteniendo listado de comisiones para el simulador', error);
    state.quick.comisionesCache.set(cacheKey, []);
    return [];
  }
}

function selectBestScopedRule(items, { planId, servicioId, fecha }) {
  if (!Array.isArray(items)) return null;
  const targetPlan = normalizeId(planId);
  const targetServicio = normalizeId(servicioId);
  const targetDate = fecha || new Date().toISOString().slice(0, 10);

  let best = null;
  let bestScore = -1;

  items.forEach((item) => {
    if (!item || item.activo === false) return;
    const desde = item.vigencia_desde ?? item.vigenciaDesde;
    const hasta = item.vigencia_hasta ?? item.vigenciaHasta;
    if (!isDateWithinRange(targetDate, desde, hasta)) return;

    const itemPlan = normalizeId(item.plan_id ?? item.planId ?? item.plan?.id);
    const itemServicio = normalizeId(item.servicio_id ?? item.servicioId ?? item.servicio?.id);

    let score = -1;
    if (targetPlan && targetServicio) {
      if (itemPlan === targetPlan && itemServicio === targetServicio) score = 4;
      else if (itemPlan === targetPlan && itemServicio == null) score = 3;
      else if (itemPlan == null && itemServicio === targetServicio) score = 2;
      else if (itemPlan == null && itemServicio == null) score = 1;
    } else if (targetPlan) {
      if (itemPlan === targetPlan && itemServicio == null) score = 3;
      else if (itemPlan == null && itemServicio == null) score = 1;
    } else if (targetServicio) {
      if (itemPlan == null && itemServicio === targetServicio) score = 2;
      else if (itemPlan == null && itemServicio == null) score = 1;
    } else {
      if (itemPlan == null && itemServicio == null) score = 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = item;
    } else if (score >= 0 && score === bestScore) {
      const currentDate = item.actualizado_el || item.actualizadoEl || item.vigencia_desde || '';
      const bestDate = best?.actualizado_el || best?.actualizadoEl || best?.vigencia_desde || '';
      if (String(currentDate).localeCompare(String(bestDate)) > 0) {
        best = item;
      }
    }
  });

  return best || null;
}

function isDateWithinRange(date, desde, hasta) {
  const target = date || new Date().toISOString().slice(0, 10);
  const start = desde || '0000-00-00';
  const end = hasta || '9999-12-31';
  return start <= target && target <= end;
}

function cloneEntity(entity) {
  if (!entity || typeof entity !== 'object') return entity;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(entity);
    } catch (error) {
      // Ignorar y usar el fallback
    }
  }
  try {
    return JSON.parse(JSON.stringify(entity));
  } catch (error) {
    return entity;
  }
}

function resolveIaUnitPrice(parametros) {
  if (!parametros || typeof parametros !== 'object') return 0;
  const candidates = [
    'tarifa_ia',
    'tarifaIA',
    'precio_unitario_ia',
    'precioUnitarioIa',
    'costo_unitario_ia',
    'costoUnitarioIa',
    'precio_unitario',
    'precioUnitario',
    'costo_unitario',
  ];
  for (const key of candidates) {
    if (parametros[key] !== undefined && parametros[key] !== null && parametros[key] !== '') {
      const value = Number(parametros[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return 0;
}

function resolveFixedBaseAmount(parametros, fallback = 0) {
  if (!parametros || typeof parametros !== 'object') return Math.max(0, Number(fallback) || 0);
  const candidates = [
    'tarifa_base',
    'tarifaBase',
    'cargo_fijo',
    'cargoFijo',
    'monto_base',
    'montoBase',
    'base',
  ];
  for (const key of candidates) {
    if (parametros[key] !== undefined && parametros[key] !== null && parametros[key] !== '') {
      const value = Number(parametros[key]);
      if (Number.isFinite(value)) return Math.max(0, value);
    }
  }
  return Math.max(0, Number(fallback) || 0);
}

function resolveSimulationDiscount(parametros, subtotalRaw) {
  if (!parametros || typeof parametros !== 'object') return 0;
  let discount = 0;
  const percentageKeys = ['descuento_porcentaje', 'porcentaje_descuento', 'descuentoPercent'];
  for (const key of percentageKeys) {
    if (parametros[key] !== undefined && parametros[key] !== null && parametros[key] !== '') {
      const pct = Number(parametros[key]);
      if (Number.isFinite(pct)) {
        discount += subtotalRaw * (pct / 100);
        break;
      }
    }
  }
  const amountKeys = ['descuento_monto', 'monto_descuento', 'descuento'];
  for (const key of amountKeys) {
    if (parametros[key] !== undefined && parametros[key] !== null && parametros[key] !== '') {
      const amount = Number(parametros[key]);
      if (Number.isFinite(amount)) {
        discount += amount;
        break;
      }
    }
  }
  return Math.max(0, discount);
}

function extractNonTaxableLines(parametros) {
  if (!parametros || typeof parametros !== 'object') return [];
  const candidates = [
    parametros.lineas_no_gravables,
    parametros.lineasNoGravables,
    parametros.lineas_exentas,
    parametros.lineasExentas,
  ].find((value) => Array.isArray(value));

  const fallbackAmount = Number(parametros.no_gravado ?? parametros.noGravado);
  const fallbackLines = Number.isFinite(fallbackAmount) && fallbackAmount > 0
    ? [{ descripcion: 'Concepto no gravable', monto: fallbackAmount, incluyeImpuesto: false }]
    : [];

  const source = Array.isArray(candidates) ? candidates : fallbackLines;

  return source
    .map((item) => {
      if (item == null) return null;
      if (typeof item === 'number') {
        return {
          descripcion: 'Concepto no gravable',
          monto: item,
          incluyeImpuesto: false,
        };
      }
      if (typeof item === 'object') {
        const monto = Number(item.monto ?? item.valor ?? item.importe);
        if (!Number.isFinite(monto)) return null;
        return {
          descripcion: item.descripcion || item.nombre || 'Concepto no gravable',
          monto,
          incluyeImpuesto: item.incluye_impuesto === true || item.incluyeImpuesto === true,
        };
      }
      return null;
    })
    .filter((linea) => linea && Number.isFinite(linea.monto) && linea.monto > 0);
}

function resolveExtraIaAmount(parametros) {
  if (!parametros || typeof parametros !== 'object') return 0;
  const keys = [
    'extraIA',
    'extraIa',
    'extra_ia',
    'ia_extra',
    'costo_extra_ia',
    'costoExtraIa',
    'recargo_ia',
    'recargoIa',
  ];
  for (const key of keys) {
    if (parametros[key] !== undefined && parametros[key] !== null && parametros[key] !== '') {
      const value = Number(parametros[key]);
      if (Number.isFinite(value)) {
        return Math.max(0, value);
      }
    }
  }
  return 0;
}

function shouldExcludeIaFromTaxes(parametros) {
  if (!parametros || typeof parametros !== 'object') return false;
  const truthyKeys = [
    'ia_no_gravado',
    'iaNoGravado',
    'consumo_ia_no_gravado',
    'consumoIaNoGravado',
    'ia_exento',
    'iaExento',
    'ia_sin_impuestos',
    'iaSinImpuestos',
    'excluir_consumo_ia',
    'excluirConsumoIa',
  ];
  for (const key of truthyKeys) {
    const coerced = coerceBoolean(parametros[key]);
    if (coerced === true) return true;
    if (typeof parametros[key] === 'string') {
      const normalized = parametros[key].trim().toLowerCase();
      if (normalized === 'no_gravado' || normalized === 'exento') return true;
    }
  }

  const gravadoKeys = ['ia_gravado', 'iaGravado', 'consumoIaGravado', 'consumo_ia_gravado'];
  for (const key of gravadoKeys) {
    const coerced = coerceBoolean(parametros[key]);
    if (coerced === true) return false;
    if (coerced === false) return true;
  }

  return false;
}

function normalizeComisionesByRol(comisiones) {
  const result = { cliente: null, abogado: null };
  if (!comisiones) return result;

  if (Array.isArray(comisiones)) {
    comisiones.forEach((item) => {
      if (!item) return;
      const rol = (item.rol_aplica || item.rolAplica || '').toLowerCase();
      if (rol === 'cliente' && !result.cliente) {
        result.cliente = item;
      } else if (rol === 'abogado' && !result.abogado) {
        result.abogado = item;
      }
    });
    return result;
  }

  if (typeof comisiones === 'object') {
    if (comisiones.cliente) result.cliente = comisiones.cliente;
    if (comisiones.abogado) result.abogado = comisiones.abogado;
    const otros = Object.values(comisiones).filter((value) => value && typeof value === 'object');
    otros.forEach((item) => {
      const rol = (item.rol_aplica || item.rolAplica || '').toLowerCase();
      if (rol === 'cliente' && !result.cliente) result.cliente = item;
      if (rol === 'abogado' && !result.abogado) result.abogado = item;
    });
  }

  return result;
}

function parsePercentageValue(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric / 100 : 0;
}

function extractRetencionMonto(comision) {
  if (!comision || typeof comision !== 'object') return 0;
  const candidates = [
    comision.retencion_monto,
    comision.retencionMonto,
    comision.monto_retencion,
    comision.montoRetencion,
    comision.parametros?.retencion_monto,
    comision.parametros?.retencionMonto,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const value = Number(candidate);
    if (Number.isFinite(value)) {
      return Math.max(0, value);
    }
  }
  return 0;
}

function resolveAbogadoSinImpuestosFlag(tarifa, econ) {
  const sources = [
    tarifa?.parametros?.abogado_sin_impuestos,
    tarifa?.parametros?.abogadoSinImpuestos,
    econ?.abogado_sin_impuestos,
    econ?.abogadoSinImpuestos,
    econ?.parametros?.abogado_sin_impuestos,
    econ?.parametros?.abogadoSinImpuestos,
  ];

  for (const value of sources) {
    const coerced = coerceBoolean(value);
    if (coerced !== null) return coerced;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'sin_impuestos' || normalized === 'sinimpuestos') return true;
      if (normalized === 'con_impuestos' || normalized === 'conimpuestos') return false;
    }
  }

  return true;
}

function serializeComisionForResult(comision) {
  if (!comision || typeof comision !== 'object') return null;
  return {
    id: comision.id ?? null,
    porcentaje: Number(comision.porcentaje ?? 0),
    rol_aplica: comision.rol_aplica || comision.rolAplica || null,
    descripcion: comision.descripcion || null,
  };
}

function coerceBoolean(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['1', 'true', 'si', 'sí', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return null;
}

// QA: Validar manualmente con una tarifa fija de 100 PEN, impuesto IGV activo al 18 %
// y comisión al cliente del 15 %. El simulador debe calcular subtotal S/ 100.00,
// impuestos S/ 18.00, comisión plataforma S/ 17.70, total cliente S/ 135.70 y neto abogado S/ 100.00.
function buildSimulationBreakdown({
  tarifa,
  econ,
  impuesto,
  comisiones,
  consumoIa,
  scope,
  planId,
  servicioId,
  fecha,
  monedaSeleccionada,
}) {
  const regla = econ?.regla_redondeo || econ?.reglaRedondeo || 'dos_decimales';
  const decimales = Number.isInteger(econ?.decimales) ? econ.decimales : 2;
  const round = (value) => applyRoundingRule(value, regla, decimales);

  const tipoCalculo = (tarifa?.tipo_calculo || tarifa?.tipoCalculo || 'fijo').toLowerCase();
  const impuestoRate = impuesto?.porcentaje != null ? Number(impuesto.porcentaje) / 100 : 0;
  const incluyeImpuesto = tarifa?.incluye_impuesto === true || tarifa?.incluyeImpuesto === true;

  const safeConsumoIa = Number.isFinite(consumoIa) && consumoIa >= 0 ? consumoIa : 0;

  const baseFallback = Number(tarifa?.valor) || 0;
  const baseFijaGross = resolveFixedBaseAmount(tarifa?.parametros, baseFallback);

  const iaUnitPrice = resolveIaUnitPrice(tarifa?.parametros);
  const extraIaGross = resolveExtraIaAmount(tarifa?.parametros);
  const consumoIaGross = Math.max(0, safeConsumoIa * iaUnitPrice);
  const tarifaIaGrossTotal = Math.max(0, consumoIaGross + extraIaGross);

  const iaNoGravado = shouldExcludeIaFromTaxes(tarifa?.parametros);
  const iaIncluyeImpuesto = !iaNoGravado && incluyeImpuesto;

  const toNet = (gross, subjectIncludesTax = incluyeImpuesto) =>
    subjectIncludesTax && impuestoRate > 0 ? gross / (1 + impuestoRate) : gross;

  const consumoIaNetRaw = toNet(consumoIaGross, iaIncluyeImpuesto);
  const extraIaNetRaw = toNet(extraIaGross, iaIncluyeImpuesto);
  const tarifaIaNetRaw = consumoIaNetRaw + extraIaNetRaw;

  const baseFijoNetRaw = toNet(baseFijaGross);

  const lineasNoGravablesRaw = extractNonTaxableLines(tarifa?.parametros).map((linea) => {
    const monto = Number(linea.monto) || 0;
    const incluye = linea.incluyeImpuesto === true;
    const neto = toNet(monto, incluye && impuestoRate > 0);
    return {
      descripcion: linea.descripcion || 'Línea no gravable',
      montoBruto: monto,
      incluyeImpuesto: incluye,
      monto,
      montoNeto: neto,
    };
  });

  if (iaNoGravado && tarifaIaNetRaw > 0) {
    lineasNoGravablesRaw.push({
      descripcion: 'Consumo IA no gravable',
      montoBruto: tarifaIaGrossTotal,
      incluyeImpuesto: false,
      monto: tarifaIaGrossTotal,
      montoNeto: tarifaIaNetRaw,
      metadata: {
        consumoIa: safeConsumoIa,
        tarifaUnit: iaUnitPrice,
        extraIa: extraIaNetRaw,
      },
    });
  }

  const totalNoGravadoRaw = lineasNoGravablesRaw.reduce((acc, linea) => acc + (linea.montoNeto || 0), 0);

  let subtotalGravadoRaw = baseFijoNetRaw;
  let baseDisplayRaw = baseFijoNetRaw;
  if (tipoCalculo === 'consumo_ia') {
    baseDisplayRaw += tarifaIaNetRaw;
    if (!iaNoGravado) {
      subtotalGravadoRaw += tarifaIaNetRaw;
    }
  }

  const subtotalAntesDescuentoRaw = subtotalGravadoRaw;
  const descuentoRaw = resolveSimulationDiscount(tarifa?.parametros, subtotalAntesDescuentoRaw);
  const descuentoAplicadoRaw = Math.min(Math.max(descuentoRaw, 0), subtotalAntesDescuentoRaw);

  const basePostDescuentoRaw = Math.max(0, subtotalAntesDescuentoRaw - descuentoAplicadoRaw);
  const impuestosRaw = Math.max(0, basePostDescuentoRaw * impuestoRate);

  const { cliente: comisionCliente, abogado: comisionAbogado } = normalizeComisionesByRol(comisiones);
  const comisionClienteRate = parsePercentageValue(comisionCliente?.porcentaje);
  const comisionAbogadoRate = parsePercentageValue(comisionAbogado?.porcentaje);
  const retencionMontoFijoRaw = extractRetencionMonto(comisionAbogado);

  const comisionClienteRaw = Math.max(0, basePostDescuentoRaw * comisionClienteRate);
  const retencionPorcentajeRaw = Math.max(0, basePostDescuentoRaw * comisionAbogadoRate);
  const retencionRaw = Math.max(0, retencionPorcentajeRaw + retencionMontoFijoRaw);

  const subtotalTotalRaw = subtotalAntesDescuentoRaw + totalNoGravadoRaw;
  const totalClienteRaw = basePostDescuentoRaw + impuestosRaw + comisionClienteRaw + totalNoGravadoRaw;

  const abogadoSinImpuestos = resolveAbogadoSinImpuestosFlag(tarifa, econ);
  let netoAbogadoRaw = basePostDescuentoRaw - retencionRaw + totalNoGravadoRaw;
  if (!abogadoSinImpuestos) {
    netoAbogadoRaw += impuestosRaw;
  }

  const moneda =
    monedaSeleccionada
    || econ?.moneda_defecto
    || econ?.monedaDefecto
    || state.simulator.inputs.moneda
    || state.monedaFallback;

  const lineasNoGravables = lineasNoGravablesRaw.map((linea) => ({
    descripcion: linea.descripcion,
    montoBruto: linea.montoBruto,
    incluyeImpuesto: linea.incluyeImpuesto,
    monto: round(linea.montoNeto || 0),
    metadata: linea.metadata || null,
  }));

  const resultado = {
    subtotal: round(subtotalTotalRaw),
    subtotalGravado: round(subtotalAntesDescuentoRaw),
    base: round(baseDisplayRaw),
    tarifaIa: round(tarifaIaNetRaw),
    tarifaIaDetalle: {
      monto: round(tarifaIaNetRaw),
      consumoIa: safeConsumoIa,
      tarifaUnit: iaUnitPrice,
      extraIa: round(extraIaNetRaw),
      gravado: !iaNoGravado,
    },
    totalNoGravado: round(totalNoGravadoRaw),
    lineasNoGravables,
    descuento: round(descuentoAplicadoRaw),
    impuestos: round(impuestosRaw),
    comisionPlataforma: round(comisionClienteRaw),
    retencion: round(retencionRaw),
    totalCliente: round(totalClienteRaw),
    netoAbogado: round(netoAbogadoRaw),
    moneda,
    tarifa: tarifa
      ? {
          id: tarifa.id ?? null,
          tipo_calculo: tarifa.tipo_calculo || tarifa.tipoCalculo || null,
          incluye_impuesto: incluyeImpuesto,
          descripcion: tarifa.descripcion || null,
          parametros: tarifa.parametros || null,
        }
      : null,
    comisiones: {
      cliente: comisionCliente
        ? {
            regla: serializeComisionForResult(comisionCliente),
            monto: round(comisionClienteRaw),
            porcentaje: Number(comisionCliente.porcentaje ?? 0),
          }
        : null,
      abogado: comisionAbogado
        ? {
            regla: serializeComisionForResult(comisionAbogado),
            monto: round(retencionRaw),
            porcentaje: Number(comisionAbogado.porcentaje ?? 0),
            componentes: {
              porcentaje: round(retencionPorcentajeRaw),
              monto: round(retencionMontoFijoRaw),
            },
          }
        : null,
    },
    impuesto: impuesto
      ? {
          id: impuesto.id ?? null,
          codigo: impuesto.codigo || null,
          porcentaje: Number(impuesto.porcentaje ?? 0),
        }
      : null,
    econconfig: econ
      ? {
          id: econ.id ?? null,
          regla_redondeo: econ.regla_redondeo || econ.reglaRedondeo || 'dos_decimales',
          decimales: econ.decimales ?? 2,
          moneda_defecto: econ.moneda_defecto || econ.monedaDefecto || moneda,
        }
      : null,
    scope: { tipo: scope, planId, servicioId },
    consumoIa: safeConsumoIa,
    fecha,
    monedaSeleccionada: moneda,
  };

  resultado.comisionClienteRegla = resultado.comisiones.cliente?.regla || null;
  resultado.comisionAbogadoRegla = resultado.comisiones.abogado?.regla || null;

  return resultado;
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
  impuestos.tableBody?.addEventListener('change', handleImpuestoTableChange);
  impuestos.form?.addEventListener('submit', submitImpuestoForm);
  impuestos.reset?.addEventListener('click', resetImpuestoForm);
}

async function loadImpuestos() {
  try {
    const response = await apiGet('/impuestos');
    const { items } = await response.json();
    state.quick.impuestos = items || [];
    if (state.quick.impuestoCache instanceof Map) {
      state.quick.impuestoCache.clear();
    }
  } catch (error) {
    console.error('Error cargando impuestos', error);
    state.quick.impuestos = [];
    if (state.quick.impuestoCache instanceof Map) {
      state.quick.impuestoCache.clear();
    }
  }
}

function renderImpuestosTable() {
  const body = state.dom.impuestos.tableBody;
  if (!body) return;
  body.innerHTML = '';

  const estado = state.dom.impuestos.estado?.value ?? '';
  const items = state.quick.impuestos.filter((impuesto) => {
    if (!estado) return true;
    return String(impuesto.activo) === estado;
  });

  if (!items.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td colspan="5" class="text-center py-4 text-muted">
        No se encontraron impuestos con los filtros aplicados.
      </td>`;
    body.appendChild(tr);
    return;
  }

  items.forEach((impuesto) => {
    const tr = document.createElement('tr');
    tr.dataset.id = impuesto.id;
    tr.innerHTML = `
      <td>${impuesto.codigo}</td>
      <td>${impuesto.nombre}</td>
      <td>${formatPercentage(impuesto.porcentaje)}</td>
      <td>${vigenciaLabel(impuesto.vigencia_desde, impuesto.vigencia_hasta)}</td>
      <td>
        <div class="form-check form-switch">
          <input
            class="form-check-input"
            type="checkbox"
            data-impuesto-toggle
            ${impuesto.activo ? 'checked' : ''}
          >
        </div>
      </td>
    `;
    body.appendChild(tr);
  });

  const selectedId = Number(state.dom.impuestos.id?.value) || null;
  if (selectedId) {
    highlightImpuestoRow(selectedId);
  }
}

function handleImpuestoTableClick(event) {
  if (event.target.matches('[data-impuesto-toggle]')) {
    return;
  }
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  fillImpuestoForm(id);
}

function handleImpuestoTableChange(event) {
  if (!event.target.matches('[data-impuesto-toggle]')) return;
  const tr = event.target.closest('tr');
  if (!tr) return;
  const id = Number(tr.dataset.id);
  toggleImpuesto(id, event.target.checked, event.target);
}

function fillImpuestoForm(id) {
  const impuesto = state.quick.impuestos.find((item) => item.id === id);
  if (!impuesto) return;
  const dom = state.dom.impuestos;
  if (!dom?.form) return;
  dom.id.value = impuesto.id;
  dom.codigo.value = impuesto.codigo || '';
  dom.nombre.value = impuesto.nombre || '';
  dom.porcentaje.value = Number(impuesto.porcentaje ?? 0);
  dom.vigenciaDesde.value = impuesto.vigencia_desde?.slice(0, 10) || '';
  dom.vigenciaHasta.value = impuesto.vigencia_hasta?.slice(0, 10) || '';
  dom.activo.checked = impuesto.activo !== false;
  dom.form.dataset.updatedAt = impuesto.actualizado_el || '';
  highlightImpuestoRow(id);
}

function highlightImpuestoRow(id) {
  const rows = state.dom.impuestos.tableBody?.querySelectorAll('tr') || [];
  rows.forEach((row) => {
    row.classList.toggle('table-active', Number(row.dataset.id) === id);
  });
}

function resetImpuestoForm() {
  const dom = state.dom.impuestos;
  if (!dom?.form) return;
  dom.form.reset();
  dom.id.value = '';
  dom.form.dataset.updatedAt = '';
  highlightImpuestoRow(null);
}

async function submitImpuestoForm(event) {
  event.preventDefault();
  const dom = state.dom.impuestos;
  if (!dom?.form) return;
  const porcentaje = Number(dom.porcentaje.value);
  if (!Number.isFinite(porcentaje) || porcentaje < 0) {
    dom.porcentaje.classList.add('is-invalid');
    return;
  }
  dom.porcentaje.classList.remove('is-invalid');

  const payload = {
    codigo: dom.codigo.value.trim(),
    nombre: dom.nombre.value.trim(),
    porcentaje,
    vigencia_desde: dom.vigenciaDesde.value || null,
    vigencia_hasta: dom.vigenciaHasta.value || null,
    activo: dom.activo.checked,
  };

  if (!payload.codigo || !payload.nombre) {
    window.alert('Completa código y nombre antes de guardar.');
    return;
  }

  try {
    const id = dom.id.value ? Number(dom.id.value) : null;
    const headers = {};
    if (dom.form.dataset.updatedAt) {
      headers['If-Unmodified-Since'] = dom.form.dataset.updatedAt;
    }
    let response;
    if (id) {
      response = await apiPut(`/impuestos/${id}`, payload, headers);
    } else {
      response = await apiPost('/impuestos', payload);
    }
    const body = await response.json();
    const saved = body?.item || body;
    if (!saved?.id) {
      throw new Error('Respuesta inesperada del servidor');
    }
    dom.id.value = saved.id || '';
    dom.form.dataset.updatedAt = saved.actualizado_el || '';
    await loadImpuestos();
    renderImpuestosTable();
    fillImpuestoForm(saved.id);
  } catch (error) {
    console.error('Error guardando impuesto', error);
    window.alert(error.message || 'No se pudo guardar el impuesto.');
  }
}

async function toggleImpuesto(id, nextState, checkbox) {
  const previousState = !nextState;
  try {
    const response = await apiPatch(`/impuestos/${id}`, { activo: nextState });
    const body = await response.json();
    const saved = body?.item || body;
    if (!saved?.id) {
      throw new Error('Respuesta inesperada del servidor');
    }
    await loadImpuestos();
    renderImpuestosTable();
    highlightImpuestoRow(saved.id);
    const currentId = Number(state.dom.impuestos.id?.value) || null;
    if (currentId === saved.id) {
      fillImpuestoForm(saved.id);
    }
  } catch (error) {
    console.error('Error actualizando impuesto', error);
    if (checkbox) checkbox.checked = previousState;
    window.alert(error.message || 'No se pudo actualizar el impuesto.');
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
  econconfig.modeButtons?.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-econfig-mode');
      if (mode) {
        setEconfigMode(mode);
      }
    });
  });
}

async function loadEconconfig() {
  try {
    const response = await apiGet('/econconfig');
    const body = await response.json();
    const config =
      body && Object.prototype.hasOwnProperty.call(body, 'config') ? body.config : body;
    state.quick.econconfig = config || null;
    state.monedaFallback = config?.moneda_defecto || state.monedaFallback;
    if (config) {
      if (state.econconfigForm.mode !== 'create') {
        state.econconfigForm.mode = 'update';
      }
    } else {
      state.econconfigForm.mode = 'create';
    }
  } catch (error) {
    console.error('Error obteniendo econconfig', error);
    state.quick.econconfig = null;
    state.econconfigForm.mode = 'create';
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
  econconfig.moneda.classList.remove('is-invalid');
  econconfig.decimales.classList.remove('is-invalid');
  updateEconfigModeUi();
  renderEconfigSummary();
  updateEconfigPreview();
}

function setEconfigMode(nextMode) {
  const hasConfig = !!state.quick.econconfig;
  const normalized = nextMode === 'create' ? 'create' : 'update';
  state.econconfigForm.mode = normalized === 'update' && !hasConfig ? 'create' : normalized;
  updateEconfigModeUi();
}

function updateEconfigModeUi() {
  const { econconfig } = state.dom;
  if (!econconfig) return;

  const hasConfig = !!state.quick.econconfig;
  const mode = state.econconfigForm.mode === 'create' || !hasConfig ? 'create' : 'update';
  state.econconfigForm.mode = mode;

  econconfig.modeButtons?.forEach((btn) => {
    const btnMode = btn.getAttribute('data-econfig-mode');
    const isCreateButton = btnMode === 'create';
    const isActive = btnMode === mode || (!hasConfig && isCreateButton);
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('btn-primary', isActive);
    btn.classList.toggle('btn-outline-secondary', !isActive);
    btn.setAttribute('aria-pressed', String(isActive));
    if (!hasConfig && !isCreateButton) {
      btn.setAttribute('disabled', '');
    } else {
      btn.removeAttribute('disabled');
    }
  });

  if (econconfig.submit) {
    econconfig.submit.textContent =
      mode === 'create' ? 'Guardar nueva configuración' : 'Actualizar configuración';
  }

  if (econconfig.updatedLabel) {
    if (mode === 'create') {
      econconfig.updatedLabel.textContent = 'Se creará una nueva configuración al guardar.';
    } else if (state.quick.econconfig?.actualizado_el) {
      econconfig.updatedLabel.textContent = `Actualizado el ${formatExactDate(
        state.quick.econconfig.actualizado_el
      )}`;
    } else {
      econconfig.updatedLabel.textContent = 'Sin actualizar';
    }
  }
}

function renderEconfigSummary() {
  const { econconfig } = state.dom;
  if (!econconfig?.summary) return;
  const container = econconfig.summary;
  const config = state.quick.econconfig;

  if (!config) {
    container.innerHTML = `
      <div class="alert alert-light border text-muted mb-0">
        No existe una configuración económica activa. Usa el formulario para crear una nueva regla.
      </div>
    `;
    econconfig.previewSamples = container.querySelector('#tc-econfig-preview-samples');
    return;
  }

  const moneda = escapeHtml(config.moneda_defecto || state.monedaFallback);
  const decimales = Number.isFinite(Number(config.decimales)) ? Number(config.decimales) : 2;
  const regla = config.regla_redondeo || 'dos_decimales';
  const statusBadge = config.activo === false
    ? '<span class="badge text-bg-secondary">Inactiva</span>'
    : '<span class="badge text-bg-success">Activa</span>';
  const actualizado = config.actualizado_el ? escapeHtml(formatExactDate(config.actualizado_el)) : '—';

  container.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm align-middle mb-0">
        <tbody>
          <tr>
            <th scope="row" class="text-muted">Estado</th>
            <td>${statusBadge}</td>
          </tr>
          <tr>
            <th scope="row" class="text-muted">Moneda</th>
            <td class="fw-semibold">${moneda}</td>
          </tr>
          <tr>
            <th scope="row" class="text-muted">Decimales</th>
            <td>${decimales}</td>
          </tr>
          <tr>
            <th scope="row" class="text-muted">Regla de redondeo</th>
            <td>${escapeHtml(roundingRuleLabel(regla))}</td>
          </tr>
          <tr>
            <th scope="row" class="text-muted">Última actualización</th>
            <td>${actualizado}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3">
      <div class="fw-semibold small mb-1">Comparativa de redondeo</div>
      <div class="text-muted small mb-2">El resultado depende del importe ingresado en la previsualización.</div>
      <div class="d-flex flex-column gap-2" id="tc-econfig-preview-samples"></div>
    </div>
  `;

  econconfig.previewSamples = container.querySelector('#tc-econfig-preview-samples');
  renderEconfigPreviewSamples();
}

function renderEconfigPreviewSamples(value) {
  const { econconfig } = state.dom;
  if (!econconfig?.previewSamples) return;
  const currentValue = Number.isFinite(value)
    ? value
    : Number(econconfig.previewInput?.value);
  if (!Number.isFinite(currentValue)) {
    econconfig.previewSamples.innerHTML = '<div class="text-muted small">Ingresa un importe para ver ejemplos de redondeo.</div>';
    return;
  }

  const moneda = econconfig.moneda?.value || state.monedaFallback;
  const decimales = Number.isFinite(Number(econconfig.decimales?.value))
    ? Number(econconfig.decimales.value)
    : state.quick.econconfig?.decimales ?? 2;
  const rules = ['dos_decimales', 'a_0_05', 'entero_superior'];

  econconfig.previewSamples.innerHTML = rules
    .map((rule) => {
      const label = escapeHtml(roundingRuleLabel(rule));
      const rounded = applyRoundingRule(currentValue, rule, decimales);
      const digits = determinePreviewDigits(rule, decimales);
      const formatted = escapeHtml(formatCurrency(rounded, moneda, digits));
      return `
        <div class="d-flex justify-content-between align-items-center border rounded px-3 py-2">
          <span class="fw-semibold">${label}</span>
          <span>${formatted}</span>
        </div>
      `;
    })
    .join('');
}

function updateEconfigPreview() {
  const { econconfig } = state.dom;
  if (!econconfig?.previewResult) return;
  const raw = econconfig.previewInput.value;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    econconfig.previewResult.textContent = '—';
    renderEconfigPreviewSamples(Number.NaN);
    return;
  }
  const moneda = econconfig.moneda.value || state.monedaFallback;
  const decimales = Number.isFinite(Number(econconfig.decimales.value))
    ? Number(econconfig.decimales.value)
    : state.quick.econconfig?.decimales ?? 2;
  const regla = econconfig.regla.value || state.quick.econconfig?.regla_redondeo || 'dos_decimales';
  const rounded = applyRoundingRule(value, regla, decimales);
  const displayDigits = determinePreviewDigits(regla, decimales);
  econconfig.previewResult.textContent = formatCurrency(rounded, moneda, displayDigits);
  renderEconfigPreviewSamples(value);
}

async function submitEconfigForm(event) {
  event.preventDefault();
  const { econconfig } = state.dom;
  if (!econconfig?.form) return;

  const moneda = econconfig.moneda.value.trim().toUpperCase();
  if (!moneda || moneda.length !== 3) {
    econconfig.moneda.classList.add('is-invalid');
    return;
  }
  econconfig.moneda.classList.remove('is-invalid');

  const decimales = Number(econconfig.decimales.value);
  if (!Number.isFinite(decimales) || decimales < 0) {
    econconfig.decimales.classList.add('is-invalid');
    return;
  }
  econconfig.decimales.classList.remove('is-invalid');

  const payload = {
    moneda_defecto: moneda,
    decimales,
    regla_redondeo: econconfig.regla.value,
    activo: econconfig.activo.checked,
  };

  try {
    const mode =
      state.econconfigForm.mode === 'create' || !state.quick.econconfig ? 'create' : 'update';
    if (mode === 'update' && state.quick.econconfig?.id) {
      payload.id = state.quick.econconfig.id;
    }

    let response;
    if (mode === 'create') {
      response = await apiPost('/econconfig', payload);
    } else {
      const headers = {};
      if (state.quick.econconfig?.actualizado_el) {
        headers['If-Unmodified-Since'] = state.quick.econconfig.actualizado_el;
      }
      response = await apiPut('/econconfig', payload, headers);
    }
    const body = await response.json();
    const saved =
      body && Object.prototype.hasOwnProperty.call(body, 'config') ? body.config : body;
    if (!saved) {
      throw new Error('Respuesta inesperada del servidor');
    }
    state.quick.econconfig = saved;
    state.monedaFallback = saved.moneda_defecto || state.monedaFallback;
    state.econconfigForm.mode = 'update';
    renderEconconfig();
  } catch (error) {
    console.error('Error guardando configuración económica', error);
    window.alert(error.message || 'No se pudo guardar la configuración económica.');
  }
}


/**
 * ------------------------------
 * Utilidades compartidas
 * ------------------------------
 */

async function loadTarifaCatalogs() {
  try {
    const response = await apiGet('/tarifas/catalogs');
    const data = await response.json();
    mergePlanCatalog(data.planes || [], { replace: true });
    mergeServiceCatalog(data.servicios || [], { replace: true });
    const planServicios = Array.isArray(data.planServicios) ? data.planServicios : [];
    state.catalogs.planServicios = planServicios.map((item) => ({ ...item }));
    state.catalogs.planAssignments = buildPlanAssignmentsMap(planServicios);
    state.catalogs.loading.planAssignments = new Map();
    state.catalogs.ready = true;
  } catch (error) {
    console.error('Error cargando catálogos de tarifas', error);
    state.catalogs.planes = [];
    state.catalogs.servicios = [];
    state.catalogs.planServicios = [];
    state.catalogs.planAssignments = new Map();
    state.catalogs.loading.planAssignments = new Map();
    state.catalogs.ready = false;
  }
}

function sanitizePlan(plan) {
  if (!plan || plan.id == null) return null;
  const id = Number(plan.id);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    nombre: plan.nombre || `ID ${id}`,
    activo: plan.activo !== false,
  };
}

function sanitizeService(service) {
  if (!service || service.id == null) return null;
  const id = Number(service.id);
  if (!Number.isInteger(id)) return null;
  return {
    id,
    nombre: service.nombre || '',
    codigo: service.codigo || '',
    activo: service.activo !== false,
  };
}

function mergePlanCatalog(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const sanitized = list.map(sanitizePlan).filter(Boolean);
  if (options.replace) {
    state.catalogs.planes = sanitized;
    return;
  }
  const existing = new Map((state.catalogs.planes || []).map((plan) => [plan.id, plan]));
  sanitized.forEach((plan) => {
    const current = existing.get(plan.id) || {};
    existing.set(plan.id, { ...current, ...plan });
  });
  state.catalogs.planes = Array.from(existing.values());
}

function mergeServiceCatalog(entries, options = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const sanitized = list.map(sanitizeService).filter(Boolean);
  if (options.replace) {
    state.catalogs.servicios = sanitized;
    return;
  }
  const existing = new Map((state.catalogs.servicios || []).map((svc) => [svc.id, svc]));
  sanitized.forEach((svc) => {
    const current = existing.get(svc.id) || {};
    existing.set(svc.id, { ...current, ...svc });
  });
  state.catalogs.servicios = Array.from(existing.values());
}

function buildPlanAssignmentsMap(assignments = []) {
  const map = new Map();
  assignments.forEach((assignment) => {
    if (!assignment) return;
    const planId = Number(assignment.plan_id ?? assignment.planId);
    const servicioId = Number(assignment.servicio_id ?? assignment.servicioId);
    if (!Number.isInteger(planId) || !Number.isInteger(servicioId)) return;
    const normalized = {
      id: assignment.id,
      plan_id: planId,
      servicio_id: servicioId,
      activo: assignment.activo !== false,
    };
    if (assignment.servicio) {
      const service = sanitizeService(assignment.servicio);
      if (service) {
        normalized.servicio = service;
        mergeServiceCatalog([service]);
      }
    }
    const current = map.get(planId) || [];
    current.push(normalized);
    map.set(planId, current);
  });
  return map;
}

function storePlanAssignments(planId, assignments) {
  const targetId = Number(planId);
  if (!Number.isInteger(targetId)) return;
  if (!(state.catalogs.planAssignments instanceof Map)) {
    state.catalogs.planAssignments = new Map();
  }
  const normalized = (Array.isArray(assignments) ? assignments : [])
    .map((item) => {
      if (!item) return null;
      const servicioId = Number(item.servicio_id ?? item.servicio?.id);
      if (!Number.isInteger(servicioId)) return null;
      const entry = {
        id: item.id,
        plan_id: targetId,
        servicio_id: servicioId,
        activo: item.activo !== false,
      };
      const service = sanitizeService(item.servicio || item.service);
      if (service) {
        entry.servicio = service;
        mergeServiceCatalog([service]);
      }
      return entry;
    })
    .filter(Boolean);

  state.catalogs.planAssignments.set(targetId, normalized);

  const remaining = (state.catalogs.planServicios || []).filter(
    (item) => Number(item?.plan_id) !== targetId
  );
  state.catalogs.planServicios = remaining.concat(
    normalized.map(({ servicio, ...rest }) => ({ ...rest }))
  );
}

async function ensurePlanCatalogs(force = false) {
  if (!force && (state.catalogs.planes || []).length) {
    return state.catalogs.planes;
  }
  if (state.catalogs.loading.planes) {
    return state.catalogs.loading.planes;
  }
  const request = (async () => {
    const response = await apiGet('/plans');
    const body = await response.json();
    const plans = Array.isArray(body)
      ? body
      : Array.isArray(body?.plans)
      ? body.plans
      : Array.isArray(body?.planes)
      ? body.planes
      : [];
    mergePlanCatalog(plans, { replace: true });
    return state.catalogs.planes;
  })()
    .catch((error) => {
      console.error('Error cargando catálogo de planes', error);
      if (force) {
        state.catalogs.planes = [];
      }
      throw error;
    })
    .finally(() => {
      state.catalogs.loading.planes = null;
    });
  state.catalogs.loading.planes = request;
  return request;
}

async function ensureServiceCatalogs(force = false) {
  if (!force && (state.catalogs.servicios || []).length) {
    return state.catalogs.servicios;
  }
  if (state.catalogs.loading.servicios) {
    return state.catalogs.loading.servicios;
  }
  const request = (async () => {
    const response = await apiGet('/services');
    const body = await response.json();
    const servicios = Array.isArray(body)
      ? body
      : Array.isArray(body?.services)
      ? body.services
      : Array.isArray(body?.servicios)
      ? body.servicios
      : [];
    mergeServiceCatalog(servicios, { replace: true });
    return state.catalogs.servicios;
  })()
    .catch((error) => {
      console.error('Error cargando catálogo de servicios', error);
      if (force) {
        state.catalogs.servicios = [];
      }
      throw error;
    })
    .finally(() => {
      state.catalogs.loading.servicios = null;
    });
  state.catalogs.loading.servicios = request;
  return request;
}

async function ensurePlanAssignments(planId, force = false) {
  const targetId = Number(planId);
  if (!Number.isInteger(targetId)) return [];
  if (!(state.catalogs.planAssignments instanceof Map)) {
    state.catalogs.planAssignments = new Map();
  }
  if (!force && state.catalogs.planAssignments.has(targetId)) {
    return state.catalogs.planAssignments.get(targetId) || [];
  }

  if (!force) {
    const cached = (state.catalogs.planServicios || []).filter(
      (item) => Number(item?.plan_id) === targetId
    );
    if (cached.length) {
      storePlanAssignments(targetId, cached);
      return state.catalogs.planAssignments.get(targetId) || cached;
    }
  }

  if (!(state.catalogs.loading.planAssignments instanceof Map)) {
    state.catalogs.loading.planAssignments = new Map();
  }
  const pendingMap = state.catalogs.loading.planAssignments;
  if (pendingMap.has(targetId)) {
    return pendingMap.get(targetId);
  }

  const request = (async () => {
    const response = await apiGet(`/plans/${targetId}`);
    const body = await response.json();
    const plan = body?.plan || body || {};
    const assignmentsRaw = Array.isArray(plan.planservicios)
      ? plan.planservicios
      : Array.isArray(plan.planservicio)
      ? plan.planservicio
      : [];
    const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw : [];
    storePlanAssignments(targetId, assignments);
    mergePlanCatalog([plan]);
    return state.catalogs.planAssignments.get(targetId) || [];
  })()
    .catch((error) => {
      console.error('Error cargando servicios del plan', error);
      throw error;
    })
    .finally(() => {
      pendingMap.delete(targetId);
    });

  pendingMap.set(targetId, request);
  return request;
}

async function loadTarifas() {
  try {
    const response = await apiGet('/tarifas');
    const { items } = await response.json();
    state.tarifas.items = items || [];
    if (state.quick.tarifasCache instanceof Map) {
      state.quick.tarifasCache.clear();
    }
  } catch (error) {
    console.error('Error cargando tarifas', error);
    state.tarifas.items = [];
    if (state.quick.tarifasCache instanceof Map) {
      state.quick.tarifasCache.clear();
    }
  }
}

async function loadComisiones() {
  try {
    const response = await apiGet('/comisiones');
    const { items } = await response.json();
    state.comisiones.items = items || [];
    if (state.quick.comisionesCache instanceof Map) {
      state.quick.comisionesCache.clear();
    }
  } catch (error) {
    console.error('Error cargando comisiones', error);
    state.comisiones.items = [];
    if (state.quick.comisionesCache instanceof Map) {
      state.quick.comisionesCache.clear();
    }
  }
}

function getDefaultTarifa() {
  return {
    descripcion: '',
    valor: 0,
    incluye_impuesto: true,
    tipo_calculo: 'fijo',
    parametros: {},
    vigencia_desde: new Date().toISOString().slice(0, 10),
    vigencia_hasta: '',
    activo: true,
    actualizado_el: '',
    plan_id: null,
    servicio_id: null,
  };
}

function getDefaultComision() {
  return {
    descripcion: '',
    rol_aplica: 'cliente',
    porcentaje: 0,
    vigencia_desde: new Date().toISOString().slice(0, 10),
    vigencia_hasta: '',
    activo: true,
    actualizado_el: '',
    plan_id: null,
    servicio_id: null,
  };
}

function matchesAutocomplete(item, needle, type) {
  if (!needle) return true;
  const search = needle.trim().toLowerCase();
  if (!search) return true;

  if (!type || type === 'servicio') {
    const servicio = item.servicio || {};
    if (servicio.nombre?.toLowerCase().includes(search)) return true;
    if (servicio.codigo?.toLowerCase().includes(search)) return true;
    if (servicio.id && String(servicio.id).toLowerCase().includes(search)) return true;
  }

  if (!type || type === 'plan') {
    const plan = item.plan || {};
    if (plan.nombre?.toLowerCase().includes(search)) return true;
    if (plan.id && String(plan.id).toLowerCase().includes(search)) return true;
  }

  if (item.nombre_ambito?.toLowerCase().includes(search)) return true;
  if (typeof item.descripcion === 'string' && item.descripcion.toLowerCase().includes(search)) return true;
  if (item.id && String(item.id).toLowerCase().includes(search)) return true;
  return false;
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

function applyRoundingRule(value, regla, decimales) {
  const raw = Number(value ?? 0);
  if (!Number.isFinite(raw)) return 0;

  if (regla === 'a_0_05') {
    const rounded = Math.ceil(raw * 20) / 20;
    return Number.isFinite(rounded) ? rounded : 0;
  }

  if (regla === 'entero_superior') {
    const rounded = Math.ceil(raw);
    return Number.isFinite(rounded) ? rounded : 0;
  }

  const digits = Number.isInteger(decimales) && decimales >= 0 ? decimales : 2;
  const factor = 10 ** digits;
  const rounded = Math.round(raw * factor) / factor;
  return Number.isFinite(rounded) ? Number(rounded.toFixed(digits)) : 0;
}

function determinePreviewDigits(regla, decimales) {
  switch (regla) {
    case 'a_0_05':
      return 2;
    case 'entero_superior':
      return 0;
    case 'dos_decimales':
    default:
      return Number.isInteger(decimales) && decimales >= 0 ? decimales : 2;
  }
}

function roundingRuleLabel(rule) {
  switch (rule) {
    case 'a_0_05':
      return 'Múltiplo de 0.05';
    case 'entero_superior':
      return 'Entero superior';
    case 'dos_decimales':
    default:
      return 'Dos decimales (0.00)';
  }
}

function formatCurrency(value, currency = state.monedaFallback, fractionDigits) {
  const digits = Number.isInteger(fractionDigits) && fractionDigits >= 0
    ? fractionDigits
    : state.quick.econconfig?.decimales ?? 2;
  const options = {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  };
  try {
    return new Intl.NumberFormat('es-PE', options).format(Number(value) || 0);
  } catch (error) {
    const fallbackDigits = Number.isInteger(options.minimumFractionDigits)
      ? options.minimumFractionDigits
      : digits;
    return `${currency} ${(Number(value) || 0).toFixed(fallbackDigits)}`;
  }
}

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function parseOptionalId(value) {
  return normalizeId(value);
}

function normalizeId(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function resolveScopeType(item) {
  if (!item) return '';
  const planId = normalizeId(item.plan_id ?? item.plan?.id);
  const servicioId = normalizeId(item.servicio_id ?? item.servicio?.id);
  if (planId && servicioId) return SCOPE_TYPES.PLAN_SERVICIO;
  if (planId) return SCOPE_TYPES.PLAN;
  if (servicioId) return SCOPE_TYPES.SERVICIO;
  const ambito = typeof item.ambito === 'string' ? item.ambito.toLowerCase() : null;
  if (ambito === 'plan_servicio' || ambito === 'plan-servicio') {
    return SCOPE_TYPES.PLAN_SERVICIO;
  }
  if (ambito === 'plan') return SCOPE_TYPES.PLAN;
  if (ambito === 'servicio') return SCOPE_TYPES.SERVICIO;
  return '';
}

function scopeTypeLabel(item) {
  const type = typeof item === 'string' ? item : resolveScopeType(item);
  switch (type) {
    case SCOPE_TYPES.PLAN_SERVICIO:
      return 'Plan + Servicio';
    case SCOPE_TYPES.PLAN:
      return 'Plan';
    case SCOPE_TYPES.SERVICIO:
      return 'Servicio independiente';
    default:
      return '—';
  }
}

function ambitoLabel(item) {
  if (!item) return '—';
  if (item.nombre_ambito) return item.nombre_ambito;
  const planName = item.plan?.nombre;
  const servicio = item.servicio || {};
  const servicioName = servicio.nombre || servicio.codigo;
  if (planName && servicioName) return `${planName} · ${servicioName}`;
  if (planName) return planName;
  if (servicioName) return servicioName;
  return '—';
}

function hasSameScope(a, b) {
  const planA = normalizeId(a?.plan_id ?? a?.plan?.id);
  const planB = normalizeId(b?.plan_id ?? b?.plan?.id);
  const servicioA = normalizeId(a?.servicio_id ?? a?.servicio?.id);
  const servicioB = normalizeId(b?.servicio_id ?? b?.servicio?.id);
  if (planA === planB && servicioA === servicioB) return true;
  const ambitoA = typeof a?.ambito === 'string' ? a.ambito.toLowerCase() : null;
  const ambitoB = typeof b?.ambito === 'string' ? b.ambito.toLowerCase() : null;
  if (!planA && !planB && !servicioA && !servicioB) {
    if (ambitoA && ambitoA === ambitoB) return true;
  }
  if (ambitoA && ambitoB && ambitoA === ambitoB) {
    if (a.referencia_id !== undefined && b.referencia_id !== undefined) {
      return normalizeId(a.referencia_id) === normalizeId(b.referencia_id);
    }
  }
  return false;
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
      const primaryField = filters?.servicio || filters?.plan || filters?.estado;
      primaryField?.focus();
    }
  });
}

function getBootstrapModal(element) {
  if (!element || !window.bootstrap?.Modal) return null;
  return window.bootstrap.Modal.getOrCreateInstance(element);
}

function resolveEntityFromResponse(payload, key) {
  if (!payload) return null;
  if (key && payload[key]) return payload[key];
  if (payload.item) return payload.item;
  if (Array.isArray(payload.items)) {
    return payload.items.find((item) => item && typeof item === 'object' && 'id' in item) || null;
  }
  return payload;
}

function extractErrorMessageFromBody(body, fallback) {
  if (!body) return fallback;
  if (typeof body === 'string') {
    const trimmed = body.trim();
    return trimmed || fallback;
  }
  if (typeof body === 'object') {
    if (body.message) return body.message;
    if (body.error) return body.error;
    if (Array.isArray(body.errors) && body.errors.length) {
      const first = body.errors[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        return first.message || first.detail || fallback;
      }
    }
  }
  return fallback;
}

async function ensureSuccessfulResponse(response) {
  if (response.ok) return response;
  const fallback = response.statusText || `Error ${response.status}`;
  let raw;
  try {
    raw = await response.text();
  } catch (error) {
    throw new Error(fallback);
  }
  let parsed = raw;
  try {
    parsed = raw ? JSON.parse(raw) : raw;
  } catch (error) {
    parsed = raw;
  }
  const message = extractErrorMessageFromBody(parsed, fallback);
  throw new Error(message);
}

function normalizeFetchError(error) {
  if (error instanceof Error) {
    return error;
  }
  return new Error('No se pudo completar la solicitud.');
}

async function apiGet(path, params) {
  const query = params ? `?${new URLSearchParams(params)}` : '';
  try {
    const response = await fetch(`${API_BASE_URL}${path}${query}`, {
      credentials: 'include',
    });
    return await ensureSuccessfulResponse(response);
  } catch (error) {
    throw normalizeFetchError(error);
  }
}

async function apiPost(path, body) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return await ensureSuccessfulResponse(response);
  } catch (error) {
    throw normalizeFetchError(error);
  }
}

async function apiPut(path, body, extraHeaders = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return await ensureSuccessfulResponse(response);
  } catch (error) {
    throw normalizeFetchError(error);
  }
}

async function apiPatch(path, body) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return await ensureSuccessfulResponse(response);
  } catch (error) {
    throw normalizeFetchError(error);
  }
}

const escapeHtml =
  (typeof window !== 'undefined' && window.escapeHtml)
    || function escapeHtml(value) {
      if (value == null) return '';
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

if (typeof window !== 'undefined' && !window.escapeHtml) {
  window.escapeHtml = escapeHtml;
}