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
            <div id="tarifas-empty-state" class="alert alert-info text-center m-3 d-none">
              No se encontraron tarifas con los filtros aplicados.
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
            <div id="comisiones-empty-state" class="alert alert-info text-center m-3 d-none">
              No se encontraron comisiones con los filtros aplicados.
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
                        <th>Incluido</th>
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
                    <div class="form-check form-switch mt-4">
                      <input class="form-check-input" type="checkbox" role="switch" id="tc-impuestos-incluido" />
                      <label class="form-check-label" for="tc-impuestos-incluido">Incluido en precio</label>
                    </div>
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
        <section class="card shadow-sm border-0">
          <div class="card-body">
            <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
              <div>
                <h5 class="card-title mb-0">Configuración económica</h5>
                <p class="text-muted small mb-0">Define moneda por defecto, decimales y reglas de redondeo.</p>
              </div>
              <div class="text-muted small" id="tc-econfig-actualizado">&nbsp;</div>
            </div>
            <div class="alert alert-info" role="alert">
              Esta configuración es de solo lectura. Los valores actuales se muestran para referencia.
            </div>
            <form id="tc-econfig-form" class="row g-3" autocomplete="off">
              <div class="col-12 col-md-4">
                <label for="tc-econfig-moneda" class="form-label">Moneda por defecto <span class="text-danger">*</span></label>
                <input type="text" class="form-control" id="tc-econfig-moneda" maxlength="3" required />
              </div>
              <div class="col-12 col-md-4">
                <label for="tc-econfig-decimales" class="form-label">Decimales <span class="text-danger">*</span></label>
                <input type="number" class="form-control" id="tc-econfig-decimales" min="0" max="6" required />
              </div>
              <div class="col-12 col-md-4">
                <label for="tc-econfig-regla" class="form-label">Regla de redondeo</label>
                <select id="tc-econfig-regla" class="form-select">
                  <option value="dos_decimales">Dos decimales</option>
                  <option value="a_0_05">Múltiplo 0.05</option>
                  <option value="entero_superior">Entero superior</option>
                </select>
              </div>
              <div class="col-12">
                <div class="form-check form-switch">
                  <input class="form-check-input" type="checkbox" role="switch" id="tc-econfig-activo" checked />
                  <label class="form-check-label" for="tc-econfig-activo">Configuración activa</label>
                </div>
              </div>
              <div class="col-12 col-lg-6">
                <label for="tc-econfig-preview" class="form-label">Previsualización de redondeo</label>
                <div class="input-group">
                  <input type="number" class="form-control" id="tc-econfig-preview" step="0.01" placeholder="Importe base" />
                  <span class="input-group-text" id="tc-econfig-preview-result">—</span>
                </div>
                <small class="text-muted">Introduce un importe para ver cómo se aplica la regla actual.</small>
              </div>
              <div class="col-12 d-flex justify-content-end gap-2">
                <button type="submit" class="btn btn-primary">Guardar cambios</button>
              </div>
            </form>
          </div>
        </section>
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
              <div class="modal-body">
                <div class="row g-3">
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
              <div class="modal-body">
                <div class="row g-3">
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
    empty: document.getElementById('tarifas-empty-state'),
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

  dom.comisiones = {
    tableBody: document.getElementById('comisiones-table-body'),
    empty: document.getElementById('comisiones-empty-state'),
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

  renderHeaderActions();
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
  const hasServicio = !!filters.servicio;
  const hasPlan = !!filters.plan;
  return items.filter((item) => {
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    if (item.ambito === 'servicio') {
      if (hasServicio && !matchesAutocomplete(item, filters.servicio)) return false;
      if (!hasServicio && hasPlan) return false;
    } else if (item.ambito === 'plan') {
      if (hasPlan && !matchesAutocomplete(item, filters.plan)) return false;
      if (!hasPlan && hasServicio) return false;
    }
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
  const hasServicio = !!filters.servicio;
  const hasPlan = !!filters.plan;
  return items.filter((item) => {
    if (filters.estado === 'activas' && !item.activo) return false;
    if (filters.estado === 'inactivas' && item.activo) return false;
    if (item.ambito === 'servicio') {
      if (hasServicio && !matchesAutocomplete(item, filters.servicio)) return false;
      if (!hasServicio && hasPlan) return false;
    } else if (item.ambito === 'plan') {
      if (hasPlan && !matchesAutocomplete(item, filters.plan)) return false;
      if (!hasPlan && hasServicio) return false;
    }
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

  const base = state.comisiones.form.data || {};
  const payload = {
    descripcion: form.descripcion.value.trim() || null,
    rol_aplica: form.rol_aplica.value,
    porcentaje,
    vigencia_desde: form.vigencia_desde.value || null,
    vigencia_hasta: form.vigencia_hasta.value || null,
    activo: form.activo.checked,
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
      <td colspan="6" class="text-center py-4 text-muted">
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
      <td>${impuesto.incluido_en_precio ? 'Incluido' : 'No incluido'}</td>
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
  toggleImpuesto(id, event.target.checked);
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
  dom.incluido.checked = !!impuesto.incluido_en_precio;
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
    incluido_en_precio: dom.incluido.checked,
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
    const saved = await response.json();
    upsertImpuesto(saved);
    dom.id.value = saved.id || '';
    dom.form.dataset.updatedAt = saved.actualizado_el || '';
    fillImpuestoForm(saved.id);
    renderImpuestosTable();
  } catch (error) {
    console.error('Error guardando impuesto', error);
    window.alert(error.message || 'No se pudo guardar el impuesto.');
  }
}

function upsertImpuesto(impuesto) {
  if (!impuesto) return;
  const index = state.quick.impuestos.findIndex((item) => item.id === impuesto.id);
  if (index >= 0) {
    state.quick.impuestos.splice(index, 1, impuesto);
  } else {
    state.quick.impuestos.push(impuesto);
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
  econconfig.moneda.classList.remove('is-invalid');
  econconfig.decimales.classList.remove('is-invalid');
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
    const headers = {};
    if (state.quick.econconfig?.actualizado_el) {
      headers['If-Unmodified-Since'] = state.quick.econconfig.actualizado_el;
    }
    let response;
    if (state.quick.econconfig) {
      response = await apiPut('/econconfig', payload, headers);
    } else {
      response = await apiPost('/econconfig', payload);
    }
    const saved = await response.json();
    state.quick.econconfig = saved;
    state.monedaFallback = saved.moneda_defecto || state.monedaFallback;
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
      const primaryField = filters?.servicio || filters?.plan || filters?.estado;
      primaryField?.focus();
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