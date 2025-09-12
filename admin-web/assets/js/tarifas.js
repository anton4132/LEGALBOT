const API_BASE_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    // --- MOCK DATA ---
    const mockServices = [
        { id: 1, codigo: 'CONSULTA', nombre: 'Consulta Legal' },
        { id: 2, codigo: 'CONTRATO', nombre: 'Redacción de Contrato' },
        { id: 3, codigo: 'REPRESENTACION', nombre: 'Representación en Juicio' },
        { id: 4, codigo: 'TRAMITE', nombre: 'Trámite Notarial' },
    ];

    const mockPlans = [
        { id: 1, nombre: 'Free' },
        { id: 2, nombre: 'Pro' },
        { id: 3, nombre: 'Studio' },
    ];

    const mockTariffs = [
        { id: 1, codigo: 'CONSULTA-FREE-BASE', descripcion: 'Tarifa básica para consultas en plan Free', valor: 50.00, tipo: 'tarifa', activo: true, servicio_id: 1, plan_id: 1, rol_aplica: 'cliente', moneda: 'PEN', tipo_calculo: 'fijo', parametros: { monto: 50.00 }, incluye_impuesto: true, vigencia_desde: '2024-01-01T00:00:00', vigencia_hasta: null, prioridad: 10, ambito_region: '*', metodo_pago: '*' },
        { id: 2, codigo: 'CONTRATO-PRO-GENERAL', descripcion: 'Contratos comerciales para plan Pro', valor: null, tipo: 'tarifa', activo: true, servicio_id: 2, plan_id: 2, rol_aplica: 'ambos', moneda: 'PEN', tipo_calculo: 'paquete', parametros: { tramos: [{ desde: 1, hasta: 5, precio: 200 }, { desde: 6, hasta: null, precio: 180 }] }, incluye_impuesto: false, vigencia_desde: '2024-06-01T00:00:00', vigencia_hasta: '2025-05-31T23:59:59', prioridad: 5, ambito_region: 'PER-LIM', metodo_pago: '*' },
        { id: 3, codigo: 'IA-CONSUMO-STUDIO', descripcion: 'Tarifa de consumo de IA para plan Studio', valor: null, tipo: 'tarifa', activo: true, servicio_id: null, plan_id: 3, rol_aplica: 'abogado', moneda: 'PEN', tipo_calculo: 'consumo_ia', parametros: { base: 5.00, unidad: 'tokens', precio_por_unidad: 0.02 }, incluye_impuesto: true, vigencia_desde: '2024-01-01T00:00:00', vigencia_hasta: null, prioridad: 100, ambito_region: '*', metodo_pago: '*' }
    ];

    let state = {
        tariffs: [],
        services: mockServices,
        plans: mockPlans,
        filters: {},
        pagination: {
            currentPage: 1,
            rowsPerPage: 10,
        },
        editingTariffId: null
    };

    const dom = {
        tableBody: document.getElementById('tariffs-table-body'),
        noResults: document.getElementById('no-results'),
        filtersForm: document.getElementById('filters-form'),
        rowsPerPageSelect: document.getElementById('rows-per-page-select'),
        paginationControls: document.getElementById('pagination-controls'),
        modal: document.getElementById('tariff-modal'),
        modalTitle: document.getElementById('modal-title'),
        tariffForm: document.getElementById('tariff-form'),
        exportCsvBtn: document.getElementById('export-csv-btn'),
        newTariffBtn: document.getElementById('new-tariff-btn'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
    };

    const formatMoneyPEN = (n) => n != null ? `S/ ${parseFloat(n).toFixed(2)}` : '—';
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const formatDateRange = (from, to) => from ? `${formatDate(from)} - ${to ? formatDate(to) : 'Indefinido'}` : 'Indefinido';
    const toLocalISOString = (date) => {
        if (!date) return "";
        const dt = new Date(date);
        const ten = (i) => (i < 10 ? '0' : '') + i;
        return `${dt.getFullYear()}-${ten(dt.getMonth() + 1)}-${ten(dt.getDate())}T${ten(dt.getHours())}:${ten(dt.getMinutes())}`;
    };
    const rangesOverlap = (aFrom, aTo, bFrom, bTo) => {
        const aStart = aFrom ? new Date(aFrom).getTime() : -Infinity;
        const aEnd = aTo ? new Date(aTo).getTime() : Infinity;
        const bStart = bFrom ? new Date(bFrom).getTime() : -Infinity;
        const bEnd = bTo ? new Date(bTo).getTime() : Infinity;
        return aStart < bEnd && aEnd > bStart;
    };

    async function loadTariffs() {
        try {
            const res = await fetch(`${API_BASE_URL}/tariffs`);
            const data = await res.json();
            state.tariffs = data.tariffs || [];
        } catch (e) {
            console.error('Error cargando tarifas, usando datos locales', e);
            state.tariffs = [...mockTariffs];
        }
        renderTable();
    }

    function renderTable() {
        let filteredTariffs = [...state.tariffs];
        Object.entries(state.filters).forEach(([key, value]) => {
            if (value === null || value === '') return;
            filteredTariffs = filteredTariffs.filter(t => {
                switch (key) {
                    case 'searchText':
                        return t.codigo.toLowerCase().includes(value.toLowerCase()) || (t.descripcion && t.descripcion.toLowerCase().includes(value.toLowerCase()));
                    case 'servicio_id':
                    case 'plan_id':
                    case 'rol_aplica':
                        return String(t[key]) === value;
                    case 'activo':
                        return String(t.activo) === value;
                    case 'dateRange':
                        return rangesOverlap(t.vigencia_desde, t.vigencia_hasta, value.from, value.to);
                    default:
                        return true;
                }
            });
        });
        const { currentPage, rowsPerPage } = state.pagination;
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedTariffs = filteredTariffs.slice(start, end);
        dom.tableBody.innerHTML = '';
        if (paginatedTariffs.length === 0) {
            dom.noResults.style.display = 'block';
            dom.tableBody.style.display = 'none';
        } else {
            dom.noResults.style.display = 'none';
            dom.tableBody.style.display = '';
            paginatedTariffs.forEach(t => {
                const service = state.services.find(s => s.id === t.servicio_id);
                const plan = state.plans.find(p => p.id === t.plan_id);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>
                        <div class="codigo-cell">${t.codigo}</div>
                        <div class="descripcion-cell">${t.descripcion || ''}</div>
                    </td>
                    <td>
                        <div>${service ? service.nombre : '—'}</div>
                        <div class="descripcion-cell">${plan ? plan.nombre : '—'}</div>
                    </td>
                    <td><span class="badge badge-rol">${t.rol_aplica}</span></td>
                    <td>${t.moneda}</td>
                    <td><span class="badge badge-calculo">${t.tipo_calculo.replace('_', ' ')}</span></td>
                    <td>${formatDateRange(t.vigencia_desde, t.vigencia_hasta)}</td>
                    <td>${t.prioridad}</td>
                    <td>${t.incluye_impuesto ? 'Sí' : 'No'}</td>
                    <td><span class="badge ${t.activo ? 'badge-activo' : 'badge-inactivo'}">${t.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <div class="actions-cell" style="display: flex; gap: 4px;">
                            <button class="btn-icon" data-action="edit" data-id="${t.id}" title="Editar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                            </button>
                            <button class="btn-icon" data-action="duplicate" data-id="${t.id}" title="Duplicar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                            <button class="btn-icon" data-action="version" data-id="${t.id}" title="Versionar">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            </button>
                            <button class="btn-icon" data-action="toggle-active" data-id="${t.id}" title="${t.activo ? 'Desactivar' : 'Activar'}">
                                ${t.activo ? 
                                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>` : 
                                `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`}
                            </button>
                        </div>
                    </td>
                `;
                dom.tableBody.appendChild(row);
            });
        }
        renderPaginationControls(filteredTariffs.length);
    }

    function renderPaginationControls(totalRows) {
        const { currentPage, rowsPerPage } = state.pagination;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        dom.paginationControls.innerHTML = '';
        if (totalPages <= 1) return;
        for (let i = 1; i <= totalPages; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.dataset.page = i;
            if (i === currentPage) button.classList.add('active');
            dom.paginationControls.appendChild(button);
        }
    }

    function populateSelects() {
        ['filter-service', 'tariff-servicio'].forEach(id => {
            const select = document.getElementById(id);
            state.services.forEach(s => {
                select.innerHTML += `<option value="${s.id}">${s.nombre}</option>`;
            });
        });
        ['filter-plan', 'tariff-plan'].forEach(id => {
            const select = document.getElementById(id);
            state.plans.forEach(p => {
                select.innerHTML += `<option value="${p.id}">${p.nombre}</option>`;
            });
        });
    }

    function renderParamsUI(tipoCalculo, params = {}) {
        const container = document.getElementById('params-container');
        container.innerHTML = '<h4>Parámetros de Cálculo</h4>';
        switch (tipoCalculo) {
            case 'fijo':
                container.innerHTML += `
                    <div class="param-group param-group-fijo">
                        <div class="form-group">
                            <label for="param-monto">Monto (S/)</label>
                            <input type="number" id="param-monto" name="monto" value="${params.monto || ''}" step="0.01" min="0" required>
                            <span class="error-message"></span>
                        </div>
                    </div>`;
                break;
            case 'paquete':
                container.innerHTML += `
                    <div id="paquete-list">
                        ${(params.tramos || [{desde: 1, hasta: '', precio: ''}]).map((tramo, i) => `
                        <div class="param-list-item param-list-paquete" data-index="${i}">
                            <input type="number" name="desde" placeholder="Desde" value="${tramo.desde || ''}" min="1" required>
                            <input type="number" name="hasta" placeholder="Hasta (vacío=∞)" value="${tramo.hasta || ''}" min="1">
                            <input type="number" name="precio" placeholder="Precio (S/)" value="${tramo.precio || ''}" step="0.01" min="0" required>
                            <button type="button" class="btn-icon btn-remove-param" ${i === 0 ? 'disabled' : ''}>&times;</button>
                        </div>`).join('')}
                    </div>
                    <button type="button" id="btn-add-tramo" class="btn btn-secondary" style="margin-top: 8px;">Añadir Tramo</button>`;
                break;
            case 'consumo_ia':
                container.innerHTML += `
                    <div class="param-group param-group-consumo">
                        <div class="form-group"><label for="param-base">Base (S/)</label><input type="number" id="param-base" name="base" value="${params.base || '0'}" step="0.01" min="0"></div>
                        <div class="form-group"><label for="param-unidad">Unidad</label><select id="param-unidad" name="unidad"><option value="tokens" ${params.unidad === 'tokens' ? 'selected':''}>Tokens</option><option value="unidades" ${params.unidad === 'unidades' ? 'selected':''}>Unidades</option></select></div>
                        <div class="form-group"><label for="param-precio-unidad">Precio/Unidad (S/)</label><input type="number" id="param-precio-unidad" name="precio_por_unidad" value="${params.precio_por_unidad || ''}" step="0.001" min="0" required></div>
                    </div>`;
                break;
            case 'minimo_mas_variable':
                container.innerHTML += `
                    <div class="param-group param-group-minimo">
                        <div class="form-group"><label for="param-minimo">Mínimo (S/)</label><input type="number" id="param-minimo" name="minimo" value="${params.minimo || ''}" step="0.01" min="0" required></div>
                        <div class="form-group"><label for="param-variable">Variable (%)</label><input type="number" id="param-variable" name="variable_pct" value="${params.variable_pct || ''}" step="0.1" min="0" max="100" required></div>
                    </div>`;
                break;
            case 'estacional':
                container.innerHTML += `
                    <div id="estacional-list">
                        ${(params.periodos || [{desde: '', hasta: '', monto: ''}]).map((p, i) => `
                        <div class="param-list-item param-list-estacional" data-index="${i}">
                            <input type="date" name="desde" value="${p.desde || ''}" required>
                            <input type="date" name="hasta" value="${p.hasta || ''}" required>
                            <input type="number" name="monto" placeholder="Monto (S/)" value="${p.monto || ''}" step="0.01" min="0" required>
                            <button type="button" class="btn-icon btn-remove-param" ${i === 0 ? 'disabled' : ''}>&times;</button>
                        </div>`).join('')}
                    </div>
                    <button type="button" id="btn-add-periodo" class="btn btn-secondary" style="margin-top: 8px;">Añadir Periodo</button>`;
                break;
        }
    }

    function handleFilterChange() {
        const formData = new FormData(dom.filtersForm);
        state.filters.searchText = formData.get('search-text');
        state.filters.servicio_id = document.getElementById('filter-service').value;
        state.filters.plan_id = document.getElementById('filter-plan').value;
        state.filters.rol_aplica = document.getElementById('filter-role').value;
        state.filters.activo = document.getElementById('filter-status').value;
        const from = document.getElementById('filter-date-from').value;
        const to = document.getElementById('filter-date-to').value;
        if (from || to) {
            state.filters.dateRange = { from, to };
        } else {
            delete state.filters.dateRange;
        }
        state.pagination.currentPage = 1;
        renderTable();
    }

    function openModal(tariff = null, mode = 'edit') {
        dom.tariffForm.reset();
        clearAllErrors();
        document.getElementById('overlap-error').style.display = 'none';
        state.editingTariffId = tariff ? tariff.id : null;
        let title = 'Nueva Tarifa';
        if (mode === 'edit') title = `Editar Tarifa: ${tariff.codigo}`;
        if (mode === 'duplicate') title = `Duplicar Tarifa: ${tariff.codigo}`;
        if (mode === 'version') title = `Versionar Tarifa: ${tariff.codigo}`;
        dom.modalTitle.textContent = title;
        if (tariff) {
            document.getElementById('tariff-codigo').value = mode === 'duplicate' ? `${tariff.codigo}_COPIA` : (mode === 'version' ? `${tariff.codigo}-V2` : tariff.codigo);
            document.getElementById('tariff-descripcion').value = tariff.descripcion || '';
            document.getElementById('tariff-activo').checked = (mode === 'duplicate' || mode === 'version') ? false : tariff.activo;
            document.getElementById('tariff-servicio').value = tariff.servicio_id || '';
            document.getElementById('tariff-plan').value = tariff.plan_id || '';
            document.getElementById('tariff-rol').value = tariff.rol_aplica;
            document.getElementById('tariff-tipo-calculo').value = tariff.tipo_calculo;
            document.getElementById('tariff-incluye-impuesto').checked = tariff.incluye_impuesto;
            document.getElementById('tariff-vigencia-desde').value = (mode === 'duplicate' || mode === 'version') ? '' : toLocalISOString(tariff.vigencia_desde);
            document.getElementById('tariff-vigencia-hasta').value = (mode === 'duplicate' || mode === 'version') ? '' : toLocalISOString(tariff.vigencia_hasta);
            document.getElementById('tariff-prioridad').value = tariff.prioridad;
            document.getElementById('tariff-region').value = tariff.ambito_region || '';
            document.getElementById('tariff-metodo-pago').value = tariff.metodo_pago || '';
            renderParamsUI(tariff.tipo_calculo, tariff.parametros);
        } else {
            renderParamsUI('fijo');
        }
        dom.modal.style.display = 'flex';
    }

    function closeModal() {
        dom.modal.style.display = 'none';
    }

    function handleSave(e) {
        e.preventDefault();
        if (!validateForm()) return;
        const form = dom.tariffForm;
        const id = state.editingTariffId ? parseInt(state.editingTariffId) : null;
        const newTariffData = {
            id: id || Date.now(),
            codigo: form.querySelector('#tariff-codigo').value.trim(),
            descripcion: form.querySelector('#tariff-descripcion').value.trim(),
            activo: form.querySelector('#tariff-activo').checked,
            servicio_id: form.querySelector('#tariff-servicio').value ? parseInt(form.querySelector('#tariff-servicio').value) : null,
            plan_id: form.querySelector('#tariff-plan').value ? parseInt(form.querySelector('#tariff-plan').value) : null,
            rol_aplica: form.querySelector('#tariff-rol').value,
            moneda: 'PEN',
            tipo: 'tarifa',
            tipo_calculo: form.querySelector('#tariff-tipo-calculo').value,
            parametros: collectParamsData(),
            incluye_impuesto: form.querySelector('#tariff-incluye-impuesto').checked,
            vigencia_desde: form.querySelector('#tariff-vigencia-desde').value || null,
            vigencia_hasta: form.querySelector('#tariff-vigencia-hasta').value || null,
            prioridad: parseInt(form.querySelector('#tariff-prioridad').value) || 0,
            ambito_region: form.querySelector('#tariff-region').value.trim() || '*',
            metodo_pago: form.querySelector('#tariff-metodo-pago').value.trim() || '*'
        };
        if (id) {
            const index = state.tariffs.findIndex(t => t.id === id);
            state.tariffs[index] = newTariffData;
        } else {
            state.tariffs.push(newTariffData);
        }
        closeModal();
        renderTable();
    }

    function init() {
        populateSelects();
        loadTariffs();
        dom.filtersForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleFilterChange();
        });
        dom.filtersForm.addEventListener('reset', () => {
            setTimeout(() => {
                state.filters = {};
                state.pagination.currentPage = 1;
                renderTable();
            }, 0);
        });
        dom.rowsPerPageSelect.addEventListener('change', (e) => {
            state.pagination.rowsPerPage = parseInt(e.target.value);
            state.pagination.currentPage = 1;
            renderTable();
        });
        dom.paginationControls.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.dataset.page) {
                state.pagination.currentPage = parseInt(e.target.dataset.page);
                renderTable();
            }
        });
        dom.newTariffBtn.addEventListener('click', () => openModal(null, 'new'));
        dom.tableBody.addEventListener('click', (e) => {
            const button = e.target.closest('button[data-action]');
            if (!button) return;
            const action = button.dataset.action;
            const id = parseInt(button.dataset.id);
            const tariff = state.tariffs.find(t => t.id === id);
            if (action === 'edit') openModal(tariff, 'edit');
            if (action === 'duplicate') openModal(tariff, 'duplicate');
            if (action === 'version') openModal(tariff, 'version');
            if (action === 'toggle-active') {
                tariff.activo = !tariff.activo;
                renderTable();
            }
        });
        dom.modalCloseBtn.addEventListener('click', closeModal);
        dom.modalCancelBtn.addEventListener('click', closeModal);
        dom.tariffForm.addEventListener('submit', handleSave);
        document.getElementById('tariff-tipo-calculo').addEventListener('change', (e) => {
            renderParamsUI(e.target.value);
        });
        document.getElementById('params-container').addEventListener('click', e => {
            if (e.target.matches('#btn-add-tramo')) {
                const list = document.getElementById('paquete-list');
                const newItem = document.createElement('div');
                newItem.className = 'param-list-item param-list-paquete';
                newItem.innerHTML = `
                    <input type="number" name="desde" placeholder="Desde" min="1" required>
                    <input type="number" name="hasta" placeholder="Hasta (vacío=∞)" min="1">
                    <input type="number" name="precio" placeholder="Precio (S/)" step="0.01" min="0" required>
                    <button type="button" class="btn-icon btn-remove-param">&times;</button>`;
                list.appendChild(newItem);
            }
            if (e.target.matches('#btn-add-periodo')) {
                const list = document.getElementById('estacional-list');
                const newItem = document.createElement('div');
                newItem.className = 'param-list-item param-list-estacional';
                newItem.innerHTML = `
                    <input type="date" name="desde" required>
                    <input type="date" name="hasta" required>
                    <input type="number" name="monto" placeholder="Monto (S/)" step="0.01" min="0" required>
                    <button type="button" class="btn-icon btn-remove-param">&times;</button>`;
                list.appendChild(newItem);
            }
            if (e.target.matches('.btn-remove-param')) {
                e.target.closest('.param-list-item').remove();
            }
        });
        dom.exportCsvBtn.addEventListener('click', () => {
            const headers = ["codigo", "descripcion", "servicio", "plan", "rol_aplica", "tipo_calculo", "vigencia_desde", "vigencia_hasta", "activo"];
            const rows = state.tariffs.map(t => {
                const service = state.services.find(s => s.id === t.servicio_id);
                const plan = state.plans.find(p => p.id === t.plan_id);
                return [t.codigo, t.descripcion, service?.nombre, plan?.nombre, t.rol_aplica, t.tipo_calculo, t.vigencia_desde, t.vigencia_hasta, t.activo].join(',');
            });
            const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "tarifas.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && dom.modal.style.display !== 'none') {
                closeModal();
            }
        });
    }

    function validateForm() {
        let isValid = true;
        clearAllErrors();
        const codigo = document.getElementById('tariff-codigo');
        if (!codigo.value.trim()) {
            isValid = false;
            showError(codigo, 'El código es obligatorio.');
        } else {
            const isDuplicate = state.tariffs.some(t => t.codigo === codigo.value.trim() && t.id !== state.editingTariffId);
            if (isDuplicate) {
                isValid = false;
                showError(codigo, 'Este código ya existe.');
            }
        }
        const desde = document.getElementById('tariff-vigencia-desde').value;
        const hasta = document.getElementById('tariff-vigencia-hasta').value;
        if (desde && hasta && new Date(hasta) < new Date(desde)) {
            isValid = false;
            showError(document.getElementById('tariff-vigencia-hasta'), 'La fecha "hasta" no puede ser anterior a la fecha "desde".');
        }
        const currentTariff = {
            id: state.editingTariffId ? parseInt(state.editingTariffId) : null,
            activo: document.getElementById('tariff-activo').checked,
            servicio_id: document.getElementById('tariff-servicio').value ? parseInt(document.getElementById('tariff-servicio').value) : null,
            plan_id: document.getElementById('tariff-plan').value ? parseInt(document.getElementById('tariff-plan').value) : null,
            rol_aplica: document.getElementById('tariff-rol').value,
            ambito_region: document.getElementById('tariff-region').value.trim() || '*',
            metodo_pago: document.getElementById('tariff-metodo-pago').value.trim() || '*',
            vigencia_desde: desde,
            vigencia_hasta: hasta,
        };
        if (currentTariff.activo) {
            const conflictingTariffs = state.tariffs.filter(t =>
                t.id !== currentTariff.id &&
                t.activo &&
                t.servicio_id === currentTariff.servicio_id &&
                t.plan_id === currentTariff.plan_id &&
                t.rol_aplica === currentTariff.rol_aplica &&
                t.ambito_region === currentTariff.ambito_region &&
                t.metodo_pago === currentTariff.metodo_pago &&
                rangesOverlap(t.vigencia_desde, t.vigencia_hasta, currentTariff.vigencia_desde, currentTariff.vigencia_hasta)
            );
            if (conflictingTariffs.length > 0) {
                isValid = false;
                const errorDiv = document.getElementById('overlap-error');
                errorDiv.innerHTML = `<strong>Conflicto de vigencia!</strong> Esta tarifa se solapa con la(s) siguiente(s) tarifa(s) activa(s):<br>${conflictingTariffs.map(t => `<code>${t.codigo}</code> (${formatDateRange(t.vigencia_desde, t.vigencia_hasta)})`).join('<br>')}`;
                errorDiv.style.display = 'block';
            } else {
                document.getElementById('overlap-error').style.display = 'none';
            }
        }
        return isValid;
    }

    function showError(input, message) {
        const formGroup = input.closest('.form-group');
        if (formGroup) {
            const error = formGroup.querySelector('.error-message');
            if(error) error.textContent = message;
        }
        input.classList.add('is-invalid');
    }
    function clearAllErrors() {
        dom.tariffForm.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        dom.tariffForm.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        document.getElementById('overlap-error').style.display = 'none';
    }
    function collectParamsData() {
        const tipo = document.getElementById('tariff-tipo-calculo').value;
        const params = {};
        switch (tipo) {
            case 'fijo':
                params.monto = parseFloat(document.getElementById('param-monto').value);
                break;
            case 'paquete':
                params.tramos = Array.from(document.querySelectorAll('#paquete-list .param-list-item')).map(item => ({
                    desde: parseInt(item.querySelector('[name="desde"]').value),
                    hasta: item.querySelector('[name="hasta"]').value ? parseInt(item.querySelector('[name="hasta"]').value) : null,
                    precio: parseFloat(item.querySelector('[name="precio"]').value)
                }));
                break;
            case 'consumo_ia':
                params.base = parseFloat(document.querySelector('#params-container [name="base"]').value);
                params.unidad = document.querySelector('#params-container [name="unidad"]').value;
                params.precio_por_unidad = parseFloat(document.querySelector('#params-container [name="precio_por_unidad"]').value);
                break;
            case 'minimo_mas_variable':
                params.minimo = parseFloat(document.querySelector('#params-container [name="minimo"]').value);
                params.variable_pct = parseFloat(document.querySelector('#params-container [name="variable_pct"]').value);
                break;
            case 'estacional':
                params.periodos = Array.from(document.querySelectorAll('#estacional-list .param-list-item')).map(item => ({
                    desde: item.querySelector('[name="desde"]').value,
                    hasta: item.querySelector('[name="hasta"]').value,
                    monto: parseFloat(item.querySelector('[name="monto"]').value)
                }));
                break;
        }
        return params;
    }

    init();
});