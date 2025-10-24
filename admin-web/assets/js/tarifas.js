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

const state = {
  ready: false,
  monedaFallback: 'PEN',
  tabs: 'tarifas',
  tarifas: {
    items: [],
    filters: {
      estado: 'activas',
      servicio: '',
      plan: '',
    },
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  comisiones: {
    items: [],
    filters: {
      estado: 'activas',
      servicio: '',
      plan: '',
    },
    sort: { field: 'vigencia', direction: 'asc' },
    paginator: { page: 1, perPage: 10, total: 0 },
    form: { mode: 'create', data: null },
  },
  simulator: {
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
    <div class="d-flex flex-column gap-4" id="tarifas-layout">
      <section class="card shadow-sm border-0">
        <div class="card-body d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <h1 class="fw-bold mb-1">Tarifas &amp; Comisiones</h1>
            <p class="text-muted mb-0">Administra las reglas económicas, comisiones e impuestos de LegalBot.</p>
          </div>
          <div class="d-flex flex-wrap gap-2" id="tarifas-header-actions">
            <button type="button" class="btn btn-outline-primary" id="tarifas-simulator-btn">Simulador de reglas</button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              id="tarifas-export-btn"
              data-scope="tarifas"
            >
              Exportar tarifas
            </button>
            <button
              type="button"
              class="btn btn-primary"
              id="tarifas-new-btn"
              data-scope="tarifas"
            >
              Nueva tarifa
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary d-none"
              id="comisiones-export-btn"
              data-scope="comisiones"
            >
              Exportar comisión
            </button>
            <button
              type="button"
              class="btn btn-primary d-none"
              id="comisiones-new-btn"
              data-scope="comisiones"
            >
              Nueva comisión
            </button>
          </div>
        </div>
      </section>

      <section class="card shadow-sm border-0">
        <div class="card-body d-flex flex-wrap gap-2">
          <button type="button" class="btn btn-primary" data-lb-tab="tarifas">Tarifas</button>
          <button type="button" class="btn btn-outline-primary" data-lb-tab="comisiones">Comisiones</button>
          <button type="button" class="btn btn-outline-primary" data-lb-tab="impuestos">Impuestos</button>
          <button type="button" class="btn btn-outline-primary" data-lb-tab="econconfig">Config. económica</button>
        </div>
      </section>

      <div id="tarifas-help-banner"></div>

      <div data-lb-view="tarifas" class="d-flex flex-column gap-4">
        <section class="card shadow-sm border-0">
          <div class="card-body">
            <h5 class="card-title mb-3">Filtros de tarifas</h5>
            <div class="row g-3 align-items-end">
              <div class="col-12 col-md-4 col-xl-3">
                <label for="tarifas-filter-estado" class="form-label">Estado</label>
                <select id="tarifas-filter-estado" class="form-select">
                  <option value="activas">Activas</option>
                  <option value="inactivas">Inactivas</option>
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-xl-3">
                <label for="tarifas-filter-servicio" class="form-label">Servicio</label>
                <input
                  type="text"
                  class="form-control"
                  id="tarifas-filter-servicio"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 col-md-4 col-xl-3">
                <label for="tarifas-filter-plan" class="form-label">Plan</label>
                <input
                  type="text"
                  class="form-control"
                  id="tarifas-filter-plan"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-outline-secondary" id="tarifas-filter-reset">Limpiar</button>
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
                    <th>Código</th>
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

      <div data-lb-view="comisiones" class="d-none d-flex flex-column gap-4">
        <section class="card shadow-sm border-0">
          <div class="card-body">
            <h5 class="card-title mb-3">Gestión de comisiones</h5>
            <p class="text-muted small">Define porcentajes por servicio o plan y consulta su estado.</p>
            <div class="row g-3 align-items-end">
              <div class="col-12 col-md-4 col-xl-3">
                <label for="comisiones-filter-estado" class="form-label">Estado</label>
                <select id="comisiones-filter-estado" class="form-select">
                  <option value="activas">Activas</option>
                  <option value="inactivas">Inactivas</option>
                  <option value="">Todas</option>
                </select>
              </div>
              <div class="col-12 col-md-4 col-xl-3">
                <label for="comisiones-filter-servicio" class="form-label">Servicio</label>
                <input
                  type="text"
                  id="comisiones-filter-servicio"
                  class="form-control"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 col-md-4 col-xl-3">
                <label for="comisiones-filter-plan" class="form-label">Plan</label>
                <input
                  type="text"
                  id="comisiones-filter-plan"
                  class="form-control"
                  placeholder="Nombre o ID"
                />
              </div>
              <div class="col-12 d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-outline-secondary" id="comisiones-filter-reset">Limpiar</button>
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
                    <th>Código</th>
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
                <div class="col-12 col-md-4">
                  <label for="simulator-ambito" class="form-label">Ámbito</label>
                  <select id="simulator-ambito" name="ambito" class="form-select">
                    <option value="servicio">Servicio</option>
                    <option value="plan">Plan</option>
                  </select>
                </div>
                <div class="col-12 col-md-4">
                  <label for="simulator-referencia" class="form-label">Referencia (ID)</label>
                  <input type="text" id="simulator-referencia" name="referencia" class="form-control" placeholder="ID del servicio/plan" />
                </div>
                <div class="col-12 col-md-4">
                  <label for="simulator-usuario" class="form-label">Usuario ID</label>
                  <input type="text" id="simulator-usuario" name="usuario_id" class="form-control" placeholder="Opcional" />
                </div>
                <div class="col-12 col-md-4">
                  <label for="simulator-fecha" class="form-label">Fecha</label>
                  <input type="date" id="simulator-fecha" name="fecha" class="form-control" />
                </div>
                <div class="col-12 col-md-4">
                  <label for="simulator-consumo" class="form-label">Consumo</label>
                  <input type="number" id="simulator-consumo" name="consumo" class="form-control" min="0" step="0.01" />
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
  };

  if (dom.simulator.modal && window.bootstrap?.Modal) {
    dom.simulator.modalInstance = window.bootstrap.Modal.getOrCreateInstance(
      dom.simulator.modal
    );
  }

  if (dom.simulator.form?.fecha) {
    dom.simulator.form.fecha.value =
      state.simulator.inputs.fecha || new Date().toISOString().slice(0, 10);
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
        renderTarifas();
      });
    } else {
      const handler = key === 'servicio' || key === 'plan' ? 'input' : 'change';
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
  return `
    <td><div class="fw-semibold">${tarifa.codigo}</div><div class="small text-muted">${chip}</div></td>
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
  state.tarifas.filters = {
    estado: 'activas',
    servicio: '',
    plan: '',
  };
  const { filters } = state.dom.tarifas;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset') return;
    input.value = state.tarifas.filters[key] || '';
  });
}

function updateTarifaFilter(key, value) {
  state.tarifas.filters[key] = typeof value === 'string' ? value.trim() : value;
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
  const payload = {
    descripcion: form.descripcion.value.trim() || null,
    valor: Number(form.valor.value),
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
    ...base,
    ...payload,
  };
  requestBody.actualizado_el = base.actualizado_el || null;

  if (!Number.isFinite(payload.valor) || payload.valor < 0) {
    form.valor.classList.add('is-invalid');
    return;
  }
  form.valor.classList.remove('is-invalid');

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
    const payload = await response.json();
    const saved = resolveEntityFromResponse(payload, 'tarifa');
    if (!saved?.id) {
      throw new Error('La respuesta del servidor no contiene la tarifa guardada.');
    }
    upsertTarifa(saved);
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
        renderComisiones();
      });
    } else {
      const handler = key === 'servicio' || key === 'plan' ? 'input' : 'change';
      input.addEventListener(handler, () => updateComisionFilter(key, input.value));
    }
  });

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
  return `
    <td><div class="fw-semibold">${comision.codigo}</div><div class="small text-muted">${chip}</div></td>
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
  state.comisiones.filters = {
    estado: 'activas',
    servicio: '',
    plan: '',
  };
  const { filters } = state.dom.comisiones;
  Object.entries(filters || {}).forEach(([key, input]) => {
    if (!input || key === 'reset') return;
    input.value = state.comisiones.filters[key] || '';
  });
}

function updateComisionFilter(key, value) {
  state.comisiones.filters[key] = typeof value === 'string' ? value.trim() : value;
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
    ...base,
    ...payload,
  };
  requestBody.actualizado_el = base.actualizado_el || null;

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
    const payload = await response.json();
    const saved = resolveEntityFromResponse(payload, 'comision');
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

  simulator.modal?.addEventListener('shown.bs.modal', () => {
    if (simulator.form) {
      const inputs = state.simulator.inputs || {};
      simulator.form.ambito.value = inputs.ambito || 'servicio';
      simulator.form.referencia.value = inputs.referencia || '';
      simulator.form.usuario_id.value = inputs.usuarioId || '';
      simulator.form.fecha.value =
        inputs.fecha || new Date().toISOString().slice(0, 10);
      simulator.form.consumo.value =
        typeof inputs.consumo === 'number' ? inputs.consumo : '';
    }
    renderSimulator();
    simulator.form?.referencia?.focus();
  });

  simulator.modal?.addEventListener('hidden.bs.modal', () => {
    state.simulator.loading = false;
    state.simulator.result = null;
    renderSimulator();
  });

  simulator.form?.addEventListener('submit', submitSimulator);
}

function renderSimulator() {
  const { simulator } = state.dom;
  if (!simulator?.result) return;

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

  state.simulator.inputs = {
    ambito: payload.ambito,
    referencia: payload.referencia,
    usuarioId: payload.usuario_id,
    fecha: payload.fecha,
    consumo: payload.consumo,
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
  impuestos.tableBody?.addEventListener('change', handleImpuestoTableChange);
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
    const assignments = Array.isArray(plan.planservicios) ? plan.planservicios : [];
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
  if (item.codigo && String(item.codigo).toLowerCase().includes(search)) return true;
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