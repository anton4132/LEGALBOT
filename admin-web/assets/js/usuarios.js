let users = [];
    let roles = [];
    let currentUserId = null; // ID del usuario que se está editando/gestionando
    let isEditing = false;
    let toastInstance = null;

    const API_BASE_URL = 'http://localhost:3000/api';

    // --- UTILIDADES ---

    /**
     * Realiza una petición a la API de forma centralizada.
     * @param {string} path - La ruta del endpoint (ej. '/users')
     * @param {object} options - Opciones para fetch()
     * @returns {Promise<any>} - La respuesta JSON de la API
     */
    async function apiFetch(path, options = {}) {
        try {
            const resp = await fetch(`${API_BASE_URL}${path}`, {
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                credentials: 'include',
                ...options
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                throw new Error(data.message || `Error HTTP ${resp.status}`);
            }
            return data;
        } catch (error) {
            console.error(`Error en API fetch [${options.method || 'GET'} ${path}]:`, error);
            showAlert(`Error de comunicación: ${error.message}`, 'danger');
            throw error;
        }
    }

    /**
     * Muestra una notificación tipo "toast".
     * @param {string} message - El mensaje a mostrar.
     * @param {string} type - 'success', 'danger', 'warning', 'info'.
     */
    function showAlert(message, type = 'info') {
        const toastTitle = document.getElementById('toastTitle');
        const toastBody = document.getElementById('toastBody');
        const toastHeader = toastInstance._element.querySelector('.toast-header');

        toastTitle.textContent = {
            success: 'Éxito',
            danger: 'Error',
            warning: 'Atención',
            info: 'Información'
        }[type] || 'Notificación';
        
        toastHeader.className = `toast-header text-white bg-${type}`;
        toastBody.textContent = message;
        toastInstance.show();
    }

    const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-ES') : 'N/A';
    const dayNumToName = (n) => ({1:'Lunes',2:'Martes',3:'Miércoles',4:'Jueves',5:'Viernes',6:'Sábado',7:'Domingo'}[n] || '');
    const timeToHHMM = (t) => {
        if (!t) return '';
        const [hh, mm] = String(t).split(':');
        return `${(hh||'').padStart(2,'0')}:${(mm||'').padStart(2,'0')}`;
    };

    // --- INICIALIZACIÓN ---

    document.addEventListener('DOMContentLoaded', function() {
        console.log('🚀 Inicializando página de usuarios mejorada');
        toastInstance = new bootstrap.Toast(document.getElementById('notificationToast'));
        loadInitialData();
        setupEventListeners();
    });

    async function loadInitialData() {
        await loadRoles();
        await loadUsers();
    }

    function setupEventListeners() {
        document.getElementById('searchInput')?.addEventListener('input', filterUsers);
        document.getElementById('filterType')?.addEventListener('change', filterUsers);
        document.getElementById('userForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveUser(); });
        document.getElementById('dni')?.addEventListener('blur', handleDniLookup);
        document.getElementById('toggle-btn')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });
    }

    // --- CARGA DE DATOS (ROLES Y USUARIOS) ---

    async function loadUsers() {
        try {
            // Simulación de datos para demostración sin backend
            const mockUsers = [
                { id: 1, creado_el: '2023-10-26T10:00:00Z', rol_id: 2, role: { codigo: 'abogado', nombre: 'Abogado' }, persona: { primer_nombre: 'Ana', apellido_paterno: 'García', dni: '12345678', telefono: '987654321', correo: 'ana.garcia@example.com' }, perfilabogado: { estudio: { ruc: '20123456789', nombre_comercial: 'García & Asociados', pais: 'Perú', ciudad: 'Lima', correo_contacto: 'contacto@garcia.com', telefono: '014445566', direccion: 'Av. Principal 123' }, disponibilidadabogado: [ { id: 101, dia_semana: 1, hora_inicio: '09:00:00', hora_fin: '11:00:00'}, { id: 102, dia_semana: 3, hora_inicio: '14:00:00', hora_fin: '16:30:00'} ] } },
                { id: 2, creado_el: '2023-11-15T14:30:00Z', rol_id: 1, role: { codigo: 'cliente', nombre: 'Cliente' }, persona: { primer_nombre: 'Carlos', apellido_paterno: 'Perez', dni: '87654321', telefono: '912345678', correo: 'carlos.perez@example.com' } },
                { id: 3, creado_el: '2024-01-20T09:00:00Z', rol_id: 3, role: { codigo: 'admin', nombre: 'Admin' }, persona: { primer_nombre: 'Admin', apellido_paterno: 'Principal', dni: '11223344', telefono: '999888777', correo: 'admin@legalbot.com' } },
            ];
            // users = await apiFetch('/users'); // Descomentar para usar con API real
            users = mockUsers;
            renderUsersTable(users);
        } catch (e) {
            renderUsersTable([]);
        }

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
            // Simulación de datos
             const mockRoles = [
                { id: 1, codigo: 'cliente', nombre: 'Cliente' },
                { id: 2, codigo: 'abogado', nombre: 'Abogado' },
                { id: 3, codigo: 'admin', nombre: 'Admin' },
            ];
            // roles = await apiFetch('/roles'); // Descomentar para usar con API real
            roles = mockRoles;
            populateRoleSelects();
        } catch (e) {
            console.error('Error cargando roles:', e);
        }
    }

    function populateRoleSelects() {
        const roleSelect = document.getElementById('rol');
        const filterSelect = document.getElementById('filterType');
        const commonHtml = roles.map(role => `<option value="${role.id}" data-codigo="${role.codigo}">${role.nombre}</option>`).join('');
        
        if (roleSelect) roleSelect.innerHTML += commonHtml;
        if (filterSelect) filterSelect.innerHTML += roles.map(role => `<option value="${role.codigo}">${role.nombre}</option>`).join('');
    }


    // --- RENDERIZADO Y FILTRADO DE LA TABLA ---

    function renderUsersTable(usersToRender) {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (!usersToRender.length) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted p-4">No se encontraron usuarios</td></tr>`;
            return;
        }

        tbody.innerHTML = usersToRender.map(user => {
            const p = user.persona;
            const roleColors = { cliente: 'bg-primary', abogado: 'bg-success', admin: 'bg-danger' };
            const badgeClass = roleColors[user.role.codigo] || 'bg-secondary';
            
            // Botones adicionales para abogados
            const abogadoActions = user.role.codigo === 'abogado' ? `
                <button class="btn btn-sm btn-outline-secondary me-1" title="Gestionar Estudio" onclick="openEstudioModal(${user.id})"><i class="bi bi-building"></i></button>
                <button class="btn btn-sm btn-outline-info me-1" title="Gestionar Disponibilidad" onclick="openDisponibilidadModal(${user.id})"><i class="bi bi-calendar-week"></i></button>
            ` : '';

            return `
                <tr>
                    <td>${p.primer_nombre} ${p.apellido_paterno}</td>
                    <td>${p.dni}</td>
                    <td>${p.telefono || 'N/A'}</td>
                    <td>${p.correo}</td>
                    <td><span class="badge ${badgeClass}">${user.role.nombre}</span></td>
                    <td>${formatDate(user.creado_el)}</td>
                    <td class="text-center">
                        <div class="btn-group">
                            <button class="btn btn-sm btn-warning me-1" title="Editar" onclick="editUser(${user.id})"><i class="bi bi-pencil"></i></button>
                            ${abogadoActions}
                            <button class="btn btn-sm btn-danger" title="Eliminar" onclick="deleteUser(${user.id})"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function filterUsers() {
        const searchTerm = (document.getElementById('searchInput')?.value || '').toLowerCase();
        const filterType = document.getElementById('filterType')?.value || '';

        const filtered = users.filter(user => {
            const p = user.persona;
            const searchMatch = `${p.primer_nombre} ${p.apellido_paterno} ${p.dni} ${p.telefono || ''}`.toLowerCase().includes(searchTerm);
            const typeMatch = !filterType || user.role.codigo === filterType;
            return searchMatch && typeMatch;
        });
        renderUsersTable(filtered);
    }


    // --- MODAL PRINCIPAL: GESTIÓN DE USUARIOS ---

    function openUserModal() {
        isEditing = false;
        currentUserId = null;
        document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
        document.getElementById('userForm').reset();
        document.getElementById('password-fields').style.display = 'flex';
        document.getElementById('clave').required = true;
        document.getElementById('confirmarClave').required = true;
    }

    async function editUser(userId) {
        // Simulación: encontrar el usuario en el array mock
        const user = users.find(u => u.id === userId);
        if (!user) {
            showAlert('Usuario no encontrado', 'danger');
            return;
        }

        isEditing = true;
        currentUserId = userId;

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
        
        document.getElementById('password-fields').style.display = 'none';
        document.getElementById('clave').required = false;
        document.getElementById('confirmarClave').required = false;
        
        document.getElementById('userModalLabel').textContent = 'Editar Usuario';
        bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).show();
    }

    async function saveUser() {
        console.log("Guardando usuario...");
        bootstrap.Modal.getOrCreateInstance(document.getElementById('userModal')).hide();
        loadUsers();
        showAlert('Usuario guardado con éxito (simulación)', 'success');
    }

    function deleteUser(userId) {
        currentUserId = userId;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).show();
    }

    async function confirmDelete() {
        console.log(`Eliminando usuario ${currentUserId}...`);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('deleteModal')).hide();
        loadUsers();
        showAlert('Usuario eliminado (simulación)', 'success');
    }

    // --- MODAL DE ESTUDIO/DESPACHO ---

    async function openEstudioModal(userId) {
        currentUserId = userId;
        document.getElementById('estudioForm').reset();
        
        const user = users.find(u => u.id === userId);
        const estudio = user?.perfilabogado?.estudio;

        if (estudio) {
            document.getElementById('estudioRuc').value = estudio.ruc || '';
            document.getElementById('estudioNombre').value = estudio.nombre_comercial || '';
            document.getElementById('estudioPais').value = estudio.pais || '';
            document.getElementById('estudioCiudad').value = estudio.ciudad || '';
            document.getElementById('estudioCorreo').value = estudio.correo_contacto || '';
            document.getElementById('estudioTelefono').value = estudio.telefono || '';
            document.getElementById('estudioDireccion').value = estudio.direccion || '';
        }
        bootstrap.Modal.getOrCreateInstance(document.getElementById('estudioModal')).show();
    }

    async function saveEstudio() {
        console.log(`Guardando estudio para el usuario ${currentUserId}...`);
        bootstrap.Modal.getOrCreateInstance(document.getElementById('estudioModal')).hide();
        showAlert('Información del estudio actualizada (simulación).', 'success');
    }

    // --- MODAL DE DISPONIBILIDAD Y HORARIO INTERACTIVO ---

    async function openDisponibilidadModal(userId) {
        currentUserId = userId;
        document.getElementById('disponibilidadForm').reset();
        bootstrap.Modal.getOrCreateInstance(document.getElementById('disponibilidadModal')).show();
        
        const user = users.find(u => u.id === userId);
        const disponibilidad = user?.perfilabogado?.disponibilidadabogado || [];
        renderSchedule(disponibilidad);
    }

    function renderSchedule(availability = []) {
        const container = document.getElementById('schedule-container');
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        const hours = Array.from({length: 13}, (_, i) => 8 + i); // 8 AM to 8 PM

        let html = '<div class="schedule-header"></div>';
        days.forEach(day => html += `<div class="schedule-header">${day}</div>`);

        hours.forEach(hour => {
            html += `<div class="schedule-time">${hour}:00</div>`;
            days.forEach((day, dayIndex) => {
                html += `<div class="schedule-slot" id="slot-${dayIndex + 1}-${hour}"></div>`;
            });
        });
        container.innerHTML = html;

        availability.forEach(slot => {
            const startHour = parseInt(slot.hora_inicio.split(':')[0]);
            const startMinutes = parseInt(slot.hora_inicio.split(':')[1]);
            const endHour = parseInt(slot.hora_fin.split(':')[0]);
            const endMinutes = parseInt(slot.hora_fin.split(':')[1]);
            
            const durationHours = (endHour + endMinutes/60) - (startHour + startMinutes/60);
            
            const slotElement = document.getElementById(`slot-${slot.dia_semana}-${startHour}`);
            if(slotElement) {
                const block = document.createElement('div');
                block.className = 'availability-block';
                block.style.top = `${(startMinutes / 60) * 100}%`;
                block.style.height = `${durationHours * 100}%`;
                block.innerHTML = `
                    ${timeToHHMM(slot.hora_inicio)} - ${timeToHHMM(slot.hora_fin)}
                    <button class="delete-slot-btn" onclick="deleteDisponibilidad(${slot.id})"><i class="bi bi-x-circle-fill"></i></button>
                `;
                slotElement.appendChild(block);
            }
        });
    }

    async function addDisponibilidad() {
        const payload = {
            id: new Date().getTime(), // ID de simulación
            dia_semana: document.getElementById('dispDia').value,
            hora_inicio: document.getElementById('dispInicio').value,
            hora_fin: document.getElementById('dispFin').value,
        };
        console.log('Añadiendo disponibilidad:', payload);
        showAlert('Horario añadido (simulación).', 'success');
        
        const user = users.find(u => u.id === currentUserId);
        if(user && user.perfilabogado) {
            user.perfilabogado.disponibilidadabogado.push(payload);
        }
        
        openDisponibilidadModal(currentUserId);
    }

    async function deleteDisponibilidad(slotId) {
        console.log(`Eliminando slot de disponibilidad ${slotId}...`);
        
        const user = users.find(u => u.id === currentUserId);
        if(user && user.perfilabogado) {
            const index = user.perfilabogado.disponibilidadabogado.findIndex(s => s.id === slotId);
            if(index > -1) {
                user.perfilabogado.disponibilidadabogado.splice(index, 1);
            }
        }
        
        showAlert('Horario eliminado (simulación).', 'success');
        openDisponibilidadModal(currentUserId);
    }


    // --- OTRAS FUNCIONES (Ej. DNI) ---
    async function handleDniLookup() {
        const dni = this.value.trim();
        if (!/^\d{8}$/.test(dni)) return;
        
        showAlert(`Buscando DNI ${dni}... (simulación)`, 'info');
        // Simulación de respuesta de API de DNI
        setTimeout(() => {
            const mockData = {
                primer_nombre: 'Juan',
                segundo_nombre: 'Alberto',
                apellido_paterno: 'Quispe',
                apellido_materno: 'Mendoza'
            };
            document.getElementById('primerNombre').value = mockData.primer_nombre || '';
            document.getElementById('segundoNombre').value = mockData.segundo_nombre || '';
            document.getElementById('apellidoPaterno').value = mockData.apellido_paterno || '';
            document.getElementById('apellidoMaterno').value = mockData.apellido_materno || '';
            showAlert('Datos de DNI cargados (simulación).', 'success');
        }, 1000);
    }