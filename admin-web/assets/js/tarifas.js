/*
 * UI definitiva: Tarifas & Comisión (Admin)
 * ------------------------------------------------------------
 * Este módulo implementa el flujo maestro/detalle, el asistente de creación/edición
 * y el simulador indicados en los lineamientos funcionales.
 *
 * La implementación está pensada para ser auto contenida y desacoplada del backend;
 * se proveen capas mock que deberán reemplazarse por integraciones reales.
 */
(function () {
    const API_BASE_URL =
    (typeof window !== 'undefined' && window.LEGALBOT_ADMIN_API_BASE_URL) || null;
const FORCE_MOCKS =
    (typeof window !== 'undefined' && window.LEGALBOT_FORCE_MOCKS === true) || false;
        const DATE_OPTIONS = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const DEFAULT_CURRENCY = 'PEN';
    const DEFAULT_PRIORITY = 0;
    const IGV_RATE = 0.18; // 18 %
    const PSP_FEES = {
        VISA: 0.036,
        MASTERCARD: 0.034,
        PAYPAL: 0.04,
        YAPE: 0.02,
        '*': 0.03,
        default: 0.03,
    };

    const PARAM_TEMPLATES = {
        fijo: { monto: 0 },
        minimo_mas_variable: { minimo: 0, porcentaje_variable: 0 },
        paquete: { tamano_bloque: 0, precio_bloque: 0 },
        consumo_ia: { rate: 0, minimo: 0 },
        estacional: { multiplicadores: [{ desde: '', hasta: '', factor: 1 }] },
    };

    const MOCK_DATA = {
        servicios: [
            { id: 1, codigo: 'CONSULTA', nombre: 'Consulta Legal' },
            { id: 2, codigo: 'CONTRATO', nombre: 'Redacción de Contrato' },
            { id: 3, codigo: 'IA', nombre: 'Consumos IA' },
        ],
        planes: [
            { id: 1, nombre: 'Free' },
            { id: 2, nombre: 'Pro' },
            { id: 3, nombre: 'Studio' },
        ],
        metodos: ['*', 'VISA', 'MASTERCARD', 'PAYPAL', 'YAPE'],
        regiones: ['*', 'PER-LIM', 'PER-ARE', 'MEX-CMX', 'USA-CA'],
        monedas: ['PEN', 'USD', 'EUR'],
        reglas: [
            {
                id: 1,
                codigo: 'CONSULTA-FREE-BASE',
                descripcion: 'Tarifa base consulta plan Free',
                servicio_id: 1,
                plan_id: 1,
                rol_aplica: 'cliente',
                moneda: 'PEN',
                metodo_pago: '*',
                ambito_region: '*',
                tipo_calculo: 'fijo',
                valor: 50,
                parametros: { monto: 50 },
                incluye_impuesto: true,
                vigencia_desde: '2024-01-01',
                vigencia_hasta: null,
                prioridad: 100,
                activo: true,
                created_at: '2024-01-01T10:00:00Z',
                updated_at: '2024-01-01T10:00:00Z',
            },
            {
                id: 2,
                codigo: 'CONSULTA-GLOBAL',
                descripcion: 'Tarifa global consultas',
                servicio_id: 1,
                plan_id: null,
                rol_aplica: 'cliente',
                moneda: 'PEN',
                metodo_pago: '*',
                ambito_region: '*',
                tipo_calculo: 'minimo_mas_variable',
                valor: null,
                parametros: { minimo: 30, porcentaje_variable: 0.25 },
                incluye_impuesto: true,
                vigencia_desde: '2024-01-01',
                vigencia_hasta: null,
                prioridad: 50,
                activo: true,
                created_at: '2024-01-01T10:00:00Z',
                updated_at: '2024-01-01T10:00:00Z',
            },
            {
                id: 3,
                codigo: 'IA-CONSUMO-STUDIO',
                descripcion: 'IA tokens studio',
                servicio_id: 3,
                plan_id: 3,
                rol_aplica: 'abogado',
                moneda: 'USD',
                metodo_pago: 'PAYPAL',
                ambito_region: 'USA-CA',
                tipo_calculo: 'consumo_ia',
                valor: null,
                parametros: { rate: 0.0005, minimo: 1 },
                incluye_impuesto: false,
                vigencia_desde: '2024-03-01',
                vigencia_hasta: null,
                prioridad: 90,
                activo: true,
                created_at: '2024-03-01T09:00:00Z',
                updated_at: '2024-03-01T09:00:00Z',
            },
        ],
    };

    const state = {
        reglas: [],
        filtros: {
            servicio_id: '',
            plan_id: '',
            rol_aplica: '',
            activo: '',
            metodo_pago: '',
            moneda: '',
            ambito_region: '',
            fecha: '',
        },
        paginacion: {
            pagina: 1,
            porPagina: 10,
        },
        asistente: {
            paso: 1,
            regla: crearReglaVacia(),
            modo: 'create',
        },
        simulador: {
            abierto: false,
            inputs: {
                servicio_id: '',
                plan_id: '',
                rol_aplica: '',
                moneda: DEFAULT_CURRENCY,
                metodo_pago: '',
                ambito_region: '',
                fecha: new Date().toISOString().substring(0, 10),
                consumo: 0,
            },
            resultado: null,
        },
    };

    const dom = {};

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheDOM();
        bindEvents();
        cargarDatosIniciales();
        render();
    }

    function cacheDOM() {
        dom.filters = {
            servicio: document.getElementById('tc-filter-servicio'),
            plan: document.getElementById('tc-filter-plan'),
            rol: document.getElementById('tc-filter-rol'),
            estado: document.getElementById('tc-filter-estado'),
            metodo: document.getElementById('tc-filter-metodo'),
            moneda: document.getElementById('tc-filter-moneda'),
            region: document.getElementById('tc-filter-region'),
            fecha: document.getElementById('tc-filter-fecha'),
            form: document.getElementById('tc-filters-form'),
            limpiar: document.getElementById('tc-filters-reset'),
        };

        dom.table = {
            body: document.getElementById('tc-table-body'),
            empty: document.getElementById('tc-empty-state'),
            porPagina: document.getElementById('tc-rows-per-page'),
            paginacion: document.getElementById('tc-pagination'),
        };

        dom.actions = {
            nuevo: document.getElementById('tc-new-rule-btn'),
            exportar: document.getElementById('tc-export-btn'),
        };

        dom.asistente = {
            contenedor: document.getElementById('tc-wizard'),
            pasos: document.querySelectorAll('[data-tc-step]'),
            indicadores: document.querySelectorAll('[data-tc-step-indicator]'),
            siguiente: document.getElementById('tc-wizard-next'),
            anterior: document.getElementById('tc-wizard-prev'),
            cancelar: document.getElementById('tc-wizard-cancel'),
            guardar: document.getElementById('tc-wizard-save'),
            encabezado: document.getElementById('tc-wizard-title'),
            alertas: document.getElementById('tc-conflict-alert'),
        };

        dom.form = {
            codigo: document.getElementById('tc-codigo'),
            servicio: document.getElementById('tc-servicio'),
            plan: document.getElementById('tc-plan'),
            rol: document.getElementById('tc-rol'),
            moneda: document.getElementById('tc-moneda'),
            metodoPago: document.getElementById('tc-metodo'),
            region: document.getElementById('tc-region'),
            prioridad: document.getElementById('tc-prioridad'),
            vigenciaDesde: document.getElementById('tc-vigencia-desde'),
            vigenciaHasta: document.getElementById('tc-vigencia-hasta'),
            activo: document.getElementById('tc-activo'),
            descripcion: document.getElementById('tc-descripcion'),
            tipoCalculo: document.getElementById('tc-tipo-calculo'),
            valor: document.getElementById('tc-valor'),
            incluyeImpuesto: document.getElementById('tc-incluye-impuesto'),
            parametros: document.getElementById('tc-parametros'),
        };

        dom.simulador = {
            toggle: document.getElementById('tc-simulator-toggle'),
            panel: document.getElementById('tc-simulator-panel'),
            form: document.getElementById('tc-simulator-form'),
            resultado: document.getElementById('tc-simulator-result'),
            resumen: document.getElementById('tc-simulator-summary'),
        };

        dom.auditModal = document.getElementById('tc-audit-modal');
    }

    function bindEvents() {
        if (dom.filters.form) {
            dom.filters.form.addEventListener('submit', (ev) => {
                ev.preventDefault();
                actualizarFiltrosDesdeForm();
            });
        }

        if (dom.filters.limpiar) {
            dom.filters.limpiar.addEventListener('click', () => {
                dom.filters.form.reset();
                Object.keys(state.filtros).forEach((k) => {
                    state.filtros[k] = '';
                });
                state.paginacion.pagina = 1;
                renderTabla();
            });
        }

        if (dom.table.porPagina) {
            dom.table.porPagina.addEventListener('change', () => {
                state.paginacion.porPagina = Number(dom.table.porPagina.value) || 10;
                state.paginacion.pagina = 1;
                renderTabla();
            });
        }

        if (dom.actions.nuevo) {
            dom.actions.nuevo.addEventListener('click', () => {
                abrirAsistente('create', crearReglaVacia());
            });
        }

        if (dom.actions.exportar) {
            dom.actions.exportar.addEventListener('click', exportarCSV);
        }

        if (dom.asistente.siguiente) {
            dom.asistente.siguiente.addEventListener('click', avanzarPaso);
        }

        if (dom.asistente.anterior) {
            dom.asistente.anterior.addEventListener('click', retrocederPaso);
        }

        if (dom.asistente.cancelar) {
            dom.asistente.cancelar.addEventListener('click', cerrarAsistente);
        }

        if (dom.asistente.guardar) {
            dom.asistente.guardar.addEventListener('click', guardarRegla);
        }

        if (dom.form.tipoCalculo) {
            dom.form.tipoCalculo.addEventListener('change', () => {
                sincronizarCamposPaso2();
            });
        }

        if (dom.simulador.toggle) {
            dom.simulador.toggle.addEventListener('click', () => {
                state.simulador.abierto = !state.simulador.abierto;
                renderSimulador();
            });
        }

        if (dom.simulador.form) {
            dom.simulador.form.addEventListener('submit', (ev) => {
                ev.preventDefault();
                ejecutarSimulacion();
            });
        }
    }

    function usandoMocks() {
        return FORCE_MOCKS || !API_BASE_URL;
    }

    const fallbackWarnings = {
        reglas: false,
        servicios: false,
        planes: false,
    };

    function clonarListaMock(lista) {
        return lista.map((item) => ({ ...item }));
    }

    function registrarFallback(tipo, error) {
        if (!fallbackWarnings[tipo]) {
            console.warn(`Usando ${tipo} mock (fetch deshabilitado)`, error || '');
            fallbackWarnings[tipo] = true;
        }
    }


    async function cargarDatosIniciales() {
        await Promise.all([cargarReglas(), cargarServicios(), cargarPlanes()]);
        poblarSelectsBase();
        renderTabla();
        renderSimulador();
    }

    async function cargarReglas() {
        if (usandoMocks()) {
            registrarFallback('reglas');
            state.reglas = clonarListaMock(MOCK_DATA.reglas);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/tarifas-comision`);
            if (!res.ok) throw new Error(`Respuesta ${res.status}`);
            const data = await res.json();
            state.reglas = data.reglas || [];
        } catch (error) {
            registrarFallback('reglas', error);
            state.reglas = clonarListaMock(MOCK_DATA.reglas);
        }
    }

    async function cargarServicios() {
        if (usandoMocks()) {
            registrarFallback('servicios');
            state.servicios = clonarListaMock(MOCK_DATA.servicios);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/servicios`);
            if (!res.ok) throw new Error(`Respuesta ${res.status}`);
            const data = await res.json();
            state.servicios = data.servicios || [];
        } catch (error) {
            registrarFallback('servicios', error);
            state.servicios = clonarListaMock(MOCK_DATA.servicios);
        }
    }

    async function cargarPlanes() {
        if (usandoMocks()) {
            registrarFallback('planes');
            state.planes = clonarListaMock(MOCK_DATA.planes);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/planes`);
            if (!res.ok) throw new Error(`Respuesta ${res.status}`);
            const data = await res.json();
            state.planes = data.planes || [];
        } catch (error) {
            registrarFallback('planes', error);
            state.planes = clonarListaMock(MOCK_DATA.planes);
        }
    }

    function poblarSelectsBase() {
        if (dom.filters.servicio) rellenarSelect(dom.filters.servicio, state.servicios, true);
        if (dom.filters.plan) rellenarSelect(dom.filters.plan, state.planes, true);
        if (dom.filters.metodo) rellenarSelectOpciones(dom.filters.metodo, MOCK_DATA.metodos, true);
        if (dom.filters.moneda) rellenarSelectOpciones(dom.filters.moneda, MOCK_DATA.monedas, true);
        if (dom.filters.region) rellenarSelectOpciones(dom.filters.region, MOCK_DATA.regiones, true);
        if (dom.form.servicio) rellenarSelect(dom.form.servicio, state.servicios, true);
        if (dom.form.plan) rellenarSelect(dom.form.plan, state.planes, true);
        if (dom.form.moneda) rellenarSelectOpciones(dom.form.moneda, MOCK_DATA.monedas, true, DEFAULT_CURRENCY);
        if (dom.form.metodoPago) rellenarSelectOpciones(dom.form.metodoPago, MOCK_DATA.metodos, true);
        if (dom.form.region) rellenarSelectOpciones(dom.form.region, MOCK_DATA.regiones, true);
        if (dom.simulador && dom.simulador.form) {
            const selectors = dom.simulador.form.querySelectorAll('[data-tc-sim-input]');
            selectors.forEach((input) => {
                const key = input.getAttribute('name');
                if (key === 'servicio_id') rellenarSelect(input, state.servicios, true);
                if (key === 'plan_id') rellenarSelect(input, state.planes, true);
                if (key === 'metodo_pago') rellenarSelectOpciones(input, MOCK_DATA.metodos, true);
                if (key === 'ambito_region') rellenarSelectOpciones(input, MOCK_DATA.regiones, true);
                if (key === 'moneda') rellenarSelectOpciones(input, MOCK_DATA.monedas, false, DEFAULT_CURRENCY);
                if (key === 'rol_aplica') rellenarSelectOpciones(input, ['cliente', 'abogado', 'ambos'], true);
            });
        }
    }

    function rellenarSelect(select, data, incluirOpcionTodos, defaultValue) {
        if (!select) return;
        select.innerHTML = '';
        if (incluirOpcionTodos) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Todos';
            select.appendChild(option);
        }
        data.forEach((item) => {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.nombre || item.codigo || item.id;
            select.appendChild(option);
        });
        if (defaultValue !== undefined) {
            select.value = defaultValue;
        }
    }

    function rellenarSelectOpciones(select, data, incluirTodos, defaultValue) {
        if (!select) return;
        select.innerHTML = '';
        if (incluirTodos) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'Todos';
            select.appendChild(option);
        }
        data.forEach((value) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        if (defaultValue !== undefined) select.value = defaultValue;
    }

    function actualizarFiltrosDesdeForm() {
        if (!dom.filters.form) return;
        const formData = new FormData(dom.filters.form);
        Object.entries(state.filtros).forEach(([key]) => {
            const value = formData.get(key);
            state.filtros[key] = value != null ? value : '';
        });
        state.paginacion.pagina = 1;
        renderTabla();
    }

    function crearReglaVacia() {
        return {
            id: null,
            codigo: '',
            descripcion: '',
            servicio_id: '',
            plan_id: '',
            rol_aplica: 'cliente',
            moneda: DEFAULT_CURRENCY,
            metodo_pago: '',
            ambito_region: '',
            tipo_calculo: 'fijo',
            valor: '',
            parametros: { ...PARAM_TEMPLATES.fijo },
            incluye_impuesto: true,
            vigencia_desde: '',
            vigencia_hasta: '',
            prioridad: DEFAULT_PRIORITY,
            activo: true,
        };
    }

    function render() {
        renderTabla();
        renderAsistente();
        renderSimulador();
    }

    function renderTabla() {
        if (!dom.table.body) return;
        const filtradas = obtenerReglasFiltradas();
        const paginadas = paginar(filtradas, state.paginacion);
        dom.table.body.innerHTML = '';
        if (paginadas.length === 0) {
            if (dom.table.empty) dom.table.empty.style.display = 'block';
        } else {
            if (dom.table.empty) dom.table.empty.style.display = 'none';
        }

        paginadas.forEach((regla) => {
            const tr = document.createElement('tr');
            tr.innerHTML = crearFilaHTML(regla);
            tr.querySelectorAll('[data-tc-action]').forEach((btn) => {
                btn.addEventListener('click', () => manejarAccionTabla(btn.dataset.tcAction, regla));
            });
            dom.table.body.appendChild(tr);
        });
        renderControlesPaginacion(filtradas.length);
    }

    function obtenerReglasFiltradas() {
        return state.reglas.filter((regla) => {
            if (state.filtros.servicio_id && String(regla.servicio_id || '') !== String(state.filtros.servicio_id)) return false;
            if (state.filtros.plan_id && String(regla.plan_id || '') !== String(state.filtros.plan_id)) return false;
            if (state.filtros.rol_aplica && regla.rol_aplica !== state.filtros.rol_aplica) return false;
            if (state.filtros.activo !== '' && String(regla.activo) !== state.filtros.activo) return false;
            if (state.filtros.metodo_pago && (regla.metodo_pago || '') !== state.filtros.metodo_pago) return false;
            if (state.filtros.moneda && (regla.moneda || DEFAULT_CURRENCY) !== state.filtros.moneda) return false;
            if (state.filtros.ambito_region && (regla.ambito_region || '') !== state.filtros.ambito_region) return false;
            if (state.filtros.fecha) {
                if (!rangoIncluyeFecha(regla.vigencia_desde, regla.vigencia_hasta, state.filtros.fecha)) {
                    return false;
                }
            }
            return true;
        });
    }

    function paginar(reglas, { pagina, porPagina }) {
        const start = (pagina - 1) * porPagina;
        return reglas.slice(start, start + porPagina);
    }

    function crearFilaHTML(regla) {
        const servicio = buscarPorId(state.servicios, regla.servicio_id);
        const plan = buscarPorId(state.planes, regla.plan_id);
        return `
            <td>
                <div class="tc-codigo">${regla.codigo}</div>
                <div class="tc-descripcion">${regla.descripcion || ''}</div>
            </td>
            <td>
                <div>${servicio ? servicio.nombre : '—'}</div>
                <div class="tc-sub">${plan ? plan.nombre : 'Todos'}</div>
            </td>
            <td>${regla.rol_aplica}</td>
            <td>${regla.moneda || DEFAULT_CURRENCY}</td>
            <td>${formatearTipoCalculo(regla.tipo_calculo)}</td>
            <td>${formatearVigencia(regla.vigencia_desde, regla.vigencia_hasta)}</td>
            <td>${regla.prioridad ?? ''}</td>
            <td>${regla.activo ? 'Activo' : 'Inactivo'}</td>
            <td>
                <div class="tc-actions">
                    <button class="btn btn-link" data-tc-action="edit">Editar</button>
                    <button class="btn btn-link" data-tc-action="clone">Clonar</button>
                    <button class="btn btn-link" data-tc-action="toggle">${regla.activo ? 'Desactivar' : 'Activar'}</button>
                    <button class="btn btn-link" data-tc-action="audit">Auditoría</button>
                </div>
            </td>
        `;
    }

    function manejarAccionTabla(accion, regla) {
        switch (accion) {
            case 'edit':
                abrirAsistente('edit', { ...regla });
                break;
            case 'clone':
                const clon = { ...regla, id: null, codigo: `${regla.codigo}-COPY`, activo: true };
                abrirAsistente('create', clon);
                break;
            case 'toggle':
                regla.activo = !regla.activo;
                renderTabla();
                break;
            case 'audit':
                mostrarAuditoria(regla);
                break;
        }
    }

    function renderControlesPaginacion(totalRegistros) {
        if (!dom.table.paginacion) return;
        const totalPaginas = Math.max(1, Math.ceil(totalRegistros / state.paginacion.porPagina));
        state.paginacion.pagina = Math.min(state.paginacion.pagina, totalPaginas);
        const contenedor = dom.table.paginacion;
        contenedor.innerHTML = '';
        for (let pagina = 1; pagina <= totalPaginas; pagina++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `btn btn-sm ${pagina === state.paginacion.pagina ? 'btn-primary' : 'btn-outline-primary'}`;
            btn.textContent = pagina;
            btn.addEventListener('click', () => {
                state.paginacion.pagina = pagina;
                renderTabla();
            });
            contenedor.appendChild(btn);
        }
    }

    function abrirAsistente(modo, regla) {
        state.asistente.paso = 1;
        state.asistente.modo = modo;
        state.asistente.regla = normalizarReglaParaFormulario(regla);
        if (dom.asistente.contenedor) {
            dom.asistente.contenedor.classList.add('is-open');
        }
        sincronizarPaso1();
        sincronizarCamposPaso2();
        renderAsistente();
    }

    function cerrarAsistente() {
        if (dom.asistente.contenedor) {
            dom.asistente.contenedor.classList.remove('is-open');
        }
        state.asistente.paso = 1;
        state.asistente.regla = crearReglaVacia();
        ocultarConflictos();
    }

    function avanzarPaso() {
        if (!validarPaso(state.asistente.paso)) return;
        if (state.asistente.paso < 3) {
            state.asistente.paso += 1;
            if (state.asistente.paso === 3) {
                ejecutarSimulacion(true);
            }
        }
        renderAsistente();
    }

    function retrocederPaso() {
        if (state.asistente.paso > 1) {
            state.asistente.paso -= 1;
            renderAsistente();
        }
    }

    function validarPaso(paso) {
        switch (paso) {
            case 1:
                return validarPaso1();
            case 2:
                return validarPaso2();
            default:
                return true;
        }
    }

    function renderAsistente() {
        if (!dom.asistente.contenedor) return;
        dom.asistente.pasos.forEach((stepEl) => {
            const step = Number(stepEl.dataset.tcStep);
            stepEl.style.display = state.asistente.paso === step ? 'block' : 'none';
        });
        dom.asistente.indicadores.forEach((indicator) => {
            const step = Number(indicator.dataset.tcStepIndicator);
            indicator.classList.toggle('active', step === state.asistente.paso);
        });
        if (dom.asistente.anterior) {
            dom.asistente.anterior.disabled = state.asistente.paso === 1;
        }
        if (dom.asistente.siguiente) {
            dom.asistente.siguiente.style.display = state.asistente.paso < 3 ? 'inline-flex' : 'none';
        }
        if (dom.asistente.guardar) {
            dom.asistente.guardar.style.display = state.asistente.paso === 3 ? 'inline-flex' : 'none';
        }
        if (dom.asistente.encabezado) {
            dom.asistente.encabezado.textContent = state.asistente.modo === 'edit'
                ? `Editar regla ${state.asistente.regla.codigo || ''}`
                : 'Nueva regla';
        }
        sincronizarPasoActual();
    }

    function sincronizarPasoActual() {
        if (state.asistente.paso === 1) sincronizarPaso1();
        if (state.asistente.paso === 2) sincronizarCamposPaso2();
        if (state.asistente.paso === 3) ejecutarSimulacion(true);
    }

    function sincronizarPaso1() {
        const regla = state.asistente.regla;
        if (!dom.form.codigo) return;
        dom.form.codigo.value = regla.codigo || '';
        dom.form.descripcion.value = regla.descripcion || '';
        dom.form.servicio.value = regla.servicio_id || '';
        dom.form.plan.value = regla.plan_id || '';
        dom.form.rol.value = regla.rol_aplica || 'cliente';
        dom.form.moneda.value = regla.moneda || DEFAULT_CURRENCY;
        dom.form.metodoPago.value = regla.metodo_pago || '';
        dom.form.region.value = regla.ambito_region || '';
        dom.form.prioridad.value = regla.prioridad ?? DEFAULT_PRIORITY;
        dom.form.vigenciaDesde.value = toLocalValue(regla.vigencia_desde);
        dom.form.vigenciaHasta.value = toLocalValue(regla.vigencia_hasta);
        dom.form.activo.checked = !!regla.activo;
    }

    function sincronizarCamposPaso2() {
        const regla = state.asistente.regla;
        if (!dom.form.tipoCalculo) return;
        if (regla.tipo_calculo !== dom.form.tipoCalculo.value) {
            regla.tipo_calculo = dom.form.tipoCalculo.value;
            regla.parametros = JSON.parse(JSON.stringify(PARAM_TEMPLATES[regla.tipo_calculo] || {}));
        }
        dom.form.tipoCalculo.value = regla.tipo_calculo;
        dom.form.valor.value = regla.valor ?? '';
        dom.form.incluyeImpuesto.checked = !!regla.incluye_impuesto;
        dom.form.parametros.value = JSON.stringify(regla.parametros || {}, null, 2);
    }

    function validarPaso1() {
        const regla = state.asistente.regla;
        sincronizarReglaDesdePaso1();
        const errores = [];
        if (!regla.codigo) errores.push('El código es obligatorio.');
        if (!regla.rol_aplica) errores.push('Debes seleccionar un rol aplicable.');
        if (regla.vigencia_desde && regla.vigencia_hasta) {
            if (new Date(regla.vigencia_desde) > new Date(regla.vigencia_hasta)) {
                errores.push('La vigencia desde no puede ser mayor que la vigencia hasta.');
            }
        }
        if (errores.length) {
            mostrarErroresPaso1(errores);
            return false;
        }
        limpiarErroresPaso1();
        return true;
    }

    function sincronizarReglaDesdePaso1() {
        const regla = state.asistente.regla;
        regla.codigo = dom.form.codigo.value.trim();
        regla.descripcion = dom.form.descripcion.value.trim();
        regla.servicio_id = dom.form.servicio.value ? Number(dom.form.servicio.value) : '';
        regla.plan_id = dom.form.plan.value ? Number(dom.form.plan.value) : '';
        regla.rol_aplica = dom.form.rol.value;
        regla.moneda = dom.form.moneda.value || DEFAULT_CURRENCY;
        regla.metodo_pago = dom.form.metodoPago.value || '';
        regla.ambito_region = dom.form.region.value || '';
        regla.prioridad = dom.form.prioridad.value ? Number(dom.form.prioridad.value) : DEFAULT_PRIORITY;
        regla.vigencia_desde = dom.form.vigenciaDesde.value ? dom.form.vigenciaDesde.value : '';
        regla.vigencia_hasta = dom.form.vigenciaHasta.value ? dom.form.vigenciaHasta.value : '';
        regla.activo = dom.form.activo.checked;
    }

    function mostrarErroresPaso1(errores) {
        const contenedor = document.getElementById('tc-step1-errors');
        if (contenedor) {
            contenedor.innerHTML = errores.map((error) => `<div class="alert alert-danger">${error}</div>`).join('');
        }
    }

    function limpiarErroresPaso1() {
        const contenedor = document.getElementById('tc-step1-errors');
        if (contenedor) {
            contenedor.innerHTML = '';
        }
    }

    function validarPaso2() {
        sincronizarReglaDesdePaso2();
        const regla = state.asistente.regla;
        const errores = [];
        if (!regla.tipo_calculo) errores.push('Selecciona un tipo de cálculo.');
        if (regla.valor && Number(regla.valor) < 0) errores.push('El valor no puede ser negativo.');
        if (!validarParametrosPorTipo(regla)) errores.push('Los parámetros no cumplen con los mínimos requeridos.');
        if (errores.length) {
            mostrarErroresPaso2(errores);
            return false;
        }
        limpiarErroresPaso2();
        return true;
    }

    function sincronizarReglaDesdePaso2() {
        const regla = state.asistente.regla;
        regla.tipo_calculo = dom.form.tipoCalculo.value;
        regla.valor = dom.form.valor.value === '' ? '' : Number(dom.form.valor.value);
        regla.incluye_impuesto = dom.form.incluyeImpuesto.checked;
        try {
            regla.parametros = JSON.parse(dom.form.parametros.value || '{}');
        } catch (error) {
            regla.parametros = {};
        }
    }

    function mostrarErroresPaso2(errores) {
        const contenedor = document.getElementById('tc-step2-errors');
        if (contenedor) contenedor.innerHTML = errores.map((e) => `<div class="alert alert-danger">${e}</div>`).join('');
    }

    function limpiarErroresPaso2() {
        const contenedor = document.getElementById('tc-step2-errors');
        if (contenedor) contenedor.innerHTML = '';
    }

    function validarParametrosPorTipo(regla) {
        const params = regla.parametros || {};
        switch (regla.tipo_calculo) {
            case 'fijo':
                return params.monto != null && params.monto >= 0;
            case 'minimo_mas_variable':
                return params.minimo != null && params.minimo >= 0 && params.porcentaje_variable != null && params.porcentaje_variable >= 0;
            case 'paquete':
                return params.tamano_bloque && params.tamano_bloque > 0 && params.precio_bloque != null && params.precio_bloque >= 0;
            case 'consumo_ia':
                return params.rate != null && params.rate >= 0 && params.minimo != null && params.minimo >= 0;
            case 'estacional':
                return Array.isArray(params.multiplicadores) && params.multiplicadores.length > 0;
            default:
                return false;
        }
    }

    function ejecutarSimulacion(desdeAsistente = false) {
        if (desdeAsistente) {
            sincronizarReglaDesdePaso1();
            sincronizarReglaDesdePaso2();
        }
        const inputs = desdeAsistente ? obtenerInputsSimulacionAsistente() : obtenerInputsSimuladorPanel();
        const reglasCandidatas = desdeAsistente
            ? [...state.reglas.filter((r) => r.id !== state.asistente.regla.id), state.asistente.regla]
            : state.reglas;
        const seleccion = seleccionarReglaCandidata(inputs, reglasCandidatas);
        if (!seleccion) {
            mostrarResultadoSimulador(null, desdeAsistente);
            return;
        }
        const desglose = calcularDesglose(seleccion, inputs);
        mostrarResultadoSimulador({ regla: seleccion, desglose }, desdeAsistente);
    }

    function obtenerInputsSimulacionAsistente() {
        const regla = state.asistente.regla;
        return {
            servicio_id: regla.servicio_id || '',
            plan_id: regla.plan_id || '',
            rol_aplica: regla.rol_aplica,
            moneda: regla.moneda || DEFAULT_CURRENCY,
            metodo_pago: regla.metodo_pago || '*',
            ambito_region: regla.ambito_region || '*',
            fecha: regla.vigencia_desde || new Date().toISOString().substring(0, 10),
            consumo: Number(document.getElementById('tc-sim-consumo')?.value || 0),
        };
    }

    function obtenerInputsSimuladorPanel() {
        if (!dom.simulador.form) return { ...state.simulador.inputs };
        const formData = new FormData(dom.simulador.form);
        const resultado = {};
        formData.forEach((value, key) => {
            resultado[key] = value;
        });
        resultado.consumo = Number(resultado.consumo || 0);
        return resultado;
    }

    function seleccionarReglaCandidata(inputs, reglas) {
        const fecha = inputs.fecha;
        const candidatos = reglas.filter((regla) => {
            if (!regla.activo) return false;
            if (!rangoIncluyeFecha(regla.vigencia_desde, regla.vigencia_hasta, fecha)) return false;
            if (inputs.servicio_id && regla.servicio_id && Number(regla.servicio_id) !== Number(inputs.servicio_id)) return false;
            if (inputs.plan_id && regla.plan_id && Number(regla.plan_id) !== Number(inputs.plan_id)) return false;
            if (inputs.rol_aplica && regla.rol_aplica !== 'ambos' && regla.rol_aplica !== inputs.rol_aplica) return false;
            if (inputs.moneda && regla.moneda && regla.moneda !== inputs.moneda) return false;
            if (inputs.metodo_pago && regla.metodo_pago && regla.metodo_pago !== '*' && regla.metodo_pago !== inputs.metodo_pago) return false;
            if (inputs.ambito_region && regla.ambito_region && regla.ambito_region !== '*' && regla.ambito_region !== inputs.ambito_region) return false;
            return true;
        });
        if (candidatos.length === 0) return null;
        candidatos.sort((a, b) => calcularPesoSeleccion(b, inputs) - calcularPesoSeleccion(a, inputs) || (b.prioridad ?? 0) - (a.prioridad ?? 0));
        return candidatos[0];
    }

    function calcularPesoSeleccion(regla, inputs) {
        let peso = 0;
        if (regla.servicio_id && Number(regla.servicio_id) === Number(inputs.servicio_id)) peso += 10;
        if (!regla.servicio_id && !inputs.servicio_id) peso += 1;
        if (regla.plan_id && Number(regla.plan_id) === Number(inputs.plan_id)) peso += 5;
        if (!regla.plan_id && !inputs.plan_id) peso += 1;
        if (regla.metodo_pago && regla.metodo_pago !== '*') peso += 2;
        if (regla.ambito_region && regla.ambito_region !== '*') peso += 2;
        return peso;
    }

    function calcularDesglose(regla, inputs) {
        const subtotal = calcularSubtotal(regla, inputs);
        const impuestos = regla.incluye_impuesto ? subtotal * IGV_RATE : 0;
        const feePsp = subtotal * (PSP_FEES[inputs.metodo_pago] ?? PSP_FEES.default);
        const totalCliente = subtotal + impuestos + feePsp;
        const netoAbogado = subtotal - feePsp;
        return {
            subtotal,
            impuestos,
            feePsp,
            totalCliente,
            netoAbogado,
        };
    }

    function calcularSubtotal(regla, inputs) {
        const params = regla.parametros || {};
        switch (regla.tipo_calculo) {
            case 'fijo':
                return Number(params.monto || 0);
            case 'minimo_mas_variable':
                const base = Number(params.minimo || 0);
                const variable = Number(inputs.consumo || 0) * Number(params.porcentaje_variable || 0);
                return Math.max(base, base + variable);
            case 'paquete':
                const consumo = Number(inputs.consumo || 0);
                const tamano = Number(params.tamano_bloque || 1);
                const precio = Number(params.precio_bloque || 0);
                const bloques = Math.ceil(consumo / tamano);
                return bloques * precio;
            case 'consumo_ia':
                const rate = Number(params.rate || 0);
                const minimo = Number(params.minimo || 0);
                const monto = Number(inputs.consumo || 0) * rate;
                return Math.max(minimo, monto);
            case 'estacional':
                const fecha = inputs.fecha || new Date().toISOString().substring(0, 10);
                let factor = 1;
                if (Array.isArray(params.multiplicadores)) {
                    params.multiplicadores.forEach((periodo) => {
                        if (rangoIncluyeFecha(periodo.desde, periodo.hasta, fecha)) {
                            factor *= Number(periodo.factor || 1);
                        }
                    });
                }
                return Number(regla.valor || 0) * factor;
            default:
                return Number(regla.valor || 0);
        }
    }

    function mostrarResultadoSimulador(result, desdeAsistente) {
        const panelDestino = desdeAsistente ? document.getElementById('tc-step3-result') : dom.simulador.resultado;
        if (!panelDestino) return;
        if (!result) {
            panelDestino.innerHTML = '<div class="alert alert-warning">No se encontró una regla aplicable para los parámetros ingresados.</div>';
            return;
        }
        const { regla, desglose } = result;
        panelDestino.innerHTML = `
            <div class="tc-sim-regla">
                <h5>Regla aplicada: ${regla.codigo}</h5>
                <p>${regla.descripcion || 'Sin descripción'}</p>
            </div>
            <dl class="tc-sim-detalle">
                <div><dt>Subtotal</dt><dd>${formatearMoneda(desglose.subtotal, regla.moneda)}</dd></div>
                <div><dt>Impuestos</dt><dd>${formatearMoneda(desglose.impuestos, regla.moneda)}</dd></div>
                <div><dt>Fee PSP</dt><dd>${formatearMoneda(desglose.feePsp, regla.moneda)}</dd></div>
                <div><dt>Total Cliente</dt><dd>${formatearMoneda(desglose.totalCliente, regla.moneda)}</dd></div>
                <div><dt>Neto Abogado</dt><dd>${formatearMoneda(desglose.netoAbogado, regla.moneda)}</dd></div>
            </dl>
            <p class="tc-sim-nota">Nota: montos redondeados según configuración económica.</p>
        `;
        if (!desdeAsistente && dom.simulador.resumen) {
            dom.simulador.resumen.textContent = `Regla ${regla.codigo} seleccionada por prioridad ${regla.prioridad ?? 0}`;
        }
    }

    function guardarRegla() {
        if (!validarPaso(1) || !validarPaso(2)) return;
        const conflictos = detectarConflictos(state.asistente.regla, state.reglas);
        if (conflictos.length) {
            mostrarConflictos(conflictos);
            return;
        }
        ocultarConflictos();
        if (state.asistente.modo === 'edit') {
            const index = state.reglas.findIndex((r) => r.id === state.asistente.regla.id);
            if (index >= 0) state.reglas[index] = { ...state.asistente.regla };
        } else {
            const nuevoId = Math.max(0, ...state.reglas.map((r) => r.id || 0)) + 1;
            state.reglas.push({ ...state.asistente.regla, id: nuevoId });
        }
        cerrarAsistente();
        renderTabla();
    }

    function detectarConflictos(regla, reglas) {
        const conflictos = [];
        const comboKey = crearComboKey(regla);
        reglas.forEach((existente) => {
            if (regla.id && existente.id === regla.id) return;
            const mismoCombo = crearComboKey(existente) === comboKey;
            if (!mismoCombo) return;
            if (!existente.activo && !regla.activo) return;
            if (rangosSeSolapan(regla.vigencia_desde, regla.vigencia_hasta, existente.vigencia_desde, existente.vigencia_hasta)) {
                conflictos.push(existente);
            }
        });
        return conflictos;
    }

    function mostrarConflictos(conflictos) {
        if (!dom.asistente.alertas) return;
        dom.asistente.alertas.innerHTML = `
            <div class="alert alert-warning">
                <strong>Conflicto de vigencias/combos detectado.</strong>
                <p>Las siguientes reglas chocan con la nueva configuración:</p>
                <ul>
                    ${conflictos
                        .map(
                            (regla) => `
                                <li>
                                    <button type="button" class="btn btn-link p-0" data-tc-conflict="${regla.id}">${regla.codigo}</button>
                                    – vigencia ${formatearVigencia(regla.vigencia_desde, regla.vigencia_hasta)} (prioridad ${regla.prioridad ?? 0})
                                </li>
                            `
                        )
                        .join('')}
                </ul>
                <p>Ajusta la prioridad o las vigencias para resolver el conflicto.</p>
            </div>`;
        dom.asistente.alertas.querySelectorAll('[data-tc-conflict]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const id = Number(btn.dataset.tcConflict);
                const regla = state.reglas.find((r) => r.id === id);
                if (regla) abrirAsistente('edit', { ...regla });
            });
        });
    }

    function ocultarConflictos() {
        if (dom.asistente.alertas) dom.asistente.alertas.innerHTML = '';
    }

    function mostrarAuditoria(regla) {
        if (!dom.auditModal) {
            alert(`Creación: ${regla.created_at}\nActualización: ${regla.updated_at}`);
            return;
        }
        dom.auditModal.querySelector('[data-tc-audit-body]').innerHTML = `
            <p><strong>Creado:</strong> ${formatearFecha(regla.created_at)}</p>
            <p><strong>Actualizado:</strong> ${formatearFecha(regla.updated_at)}</p>
        `;
        dom.auditModal.classList.add('is-open');
        dom.auditModal.querySelector('[data-tc-audit-close]').addEventListener('click', () => {
            dom.auditModal.classList.remove('is-open');
        }, { once: true });
    }

    function actualizarReglaDesdePaso3() {
        // reservado para futuros campos editables en paso 3
    }

    function renderSimulador() {
        if (!dom.simulador.panel) return;
        dom.simulador.panel.classList.toggle('is-open', state.simulador.abierto);
    }

    function renderTablaSimulador(result) {
        // placeholder
    }

    function exportarCSV() {
        const filas = state.reglas.map((regla) => ({
            Codigo: regla.codigo,
            Servicio: buscarPorId(state.servicios, regla.servicio_id)?.nombre || '—',
            Plan: buscarPorId(state.planes, regla.plan_id)?.nombre || 'Todos',
            Rol: regla.rol_aplica,
            Moneda: regla.moneda || DEFAULT_CURRENCY,
            MetodoPago: regla.metodo_pago || '*',
            Region: regla.ambito_region || '*',
            TipoCalculo: regla.tipo_calculo,
            Vigencia: formatearVigencia(regla.vigencia_desde, regla.vigencia_hasta),
            Prioridad: regla.prioridad ?? '',
            Activo: regla.activo ? 'Sí' : 'No',
        }));
        const cabeceras = Object.keys(filas[0] || {});
        const contenido = [cabeceras.join(','), ...filas.map((fila) => cabeceras.map((key) => `"${String(fila[key]).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tarifas_comision_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function crearComboKey(regla) {
        return [
            normalizarValor(regla.servicio_id),
            normalizarValor(regla.plan_id),
            regla.rol_aplica || '',
            normalizarValor(regla.moneda || DEFAULT_CURRENCY),
            normalizarValor(regla.metodo_pago || '*'),
            normalizarValor(regla.ambito_region || '*'),
        ].join('|');
    }

    function normalizarValor(valor) {
        if (valor === null || valor === undefined || valor === '') return '*';
        return String(valor);
    }

    function rangoIncluyeFecha(desde, hasta, fecha) {
        const fechaMs = new Date(fecha).getTime();
        const desdeMs = desde ? new Date(desde).getTime() : -Infinity;
        const hastaMs = hasta ? new Date(hasta).getTime() : Infinity;
        return fechaMs >= desdeMs && fechaMs <= hastaMs;
    }

    function rangosSeSolapan(aDesde, aHasta, bDesde, bHasta) {
        const aStart = aDesde ? new Date(aDesde).getTime() : -Infinity;
        const aEnd = aHasta ? new Date(aHasta).getTime() : Infinity;
        const bStart = bDesde ? new Date(bDesde).getTime() : -Infinity;
        const bEnd = bHasta ? new Date(bHasta).getTime() : Infinity;
        return aStart <= bEnd && bStart <= aEnd;
    }

    function buscarPorId(lista, id) {
        if (!id) return null;
        return lista.find((item) => Number(item.id) === Number(id)) || null;
    }

    function formatearFecha(fechaIso) {
        if (!fechaIso) return '—';
        const fecha = new Date(fechaIso);
        return fecha.toLocaleDateString('es-PE', DATE_OPTIONS) + ' ' + fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    }

    function formatearMoneda(valor, moneda) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: moneda || DEFAULT_CURRENCY }).format(Number(valor || 0));
    }

    function formatearTipoCalculo(tipo) {
        return {
            fijo: 'Fijo',
            minimo_mas_variable: 'Mínimo + Variable',
            paquete: 'Paquete',
            consumo_ia: 'Consumo IA',
            estacional: 'Estacional',
        }[tipo] || tipo;
    }

    function formatearVigencia(desde, hasta) {
        const desdeFmt = desde ? new Date(desde).toLocaleDateString('es-PE', DATE_OPTIONS) : 'Indefinido';
        const hastaFmt = hasta ? new Date(hasta).toLocaleDateString('es-PE', DATE_OPTIONS) : 'Indefinido';
        return `${desdeFmt} - ${hastaFmt}`;
    }

    function paginarLista(lista, pagina, porPagina) {
        const inicio = (pagina - 1) * porPagina;
        return lista.slice(inicio, inicio + porPagina);
    }

    function toLocalValue(value) {
        if (!value) return '';
        if (value.length === 10) return value;
        const date = new Date(value);
        const tzOffset = date.getTimezoneOffset();
        const local = new Date(date.getTime() - tzOffset * 60 * 1000);
        return local.toISOString().slice(0, 16);
    }

    function normalizarReglaParaFormulario(regla) {
        const copia = { ...crearReglaVacia(), ...regla };
        if (copia.servicio_id == null) copia.servicio_id = '';
        if (copia.plan_id == null) copia.plan_id = '';
        if (!copia.parametros) copia.parametros = { ...PARAM_TEMPLATES[copia.tipo_calculo] };
        return copia;
    }
})();