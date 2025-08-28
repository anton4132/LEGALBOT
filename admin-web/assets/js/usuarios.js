// Variables globales
let users = [];
let currentUserId = null;
let isEditing = false;

// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

console.log('✅ usuarios.js cargado correctamente');

// Función simple de logout
function logout() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminId');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('rememberMe');
  window.location.href = '/login';
}

// Inicializar la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando página de usuarios');
    loadUsers();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Búsqueda en tiempo real
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterUsers();
        });
    }

    // Filtro por tipo
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', function() {
            filterUsers();
        });
    }
}

// Cargar usuarios desde la API
async function loadUsers() {
    try {
        console.log('📡 Cargando usuarios desde API...');
        const response = await fetch(`${API_BASE_URL}/users`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`Error al cargar usuarios: ${response.status}`);
        }
        
        users = await response.json();
        console.log('Usuarios cargados:', users);
        renderUsersTable(users);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        showAlert('Error al cargar usuarios: ' + error.message, 'danger');
    }
}

// Renderizar tabla de usuarios
function renderUsersTable(usersToRender) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) {
        console.error('No se encontró el elemento usersTableBody');
        return;
    }

    tbody.innerHTML = '';

    if (usersToRender.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No se encontraron usuarios
                </td>
            </tr>
        `;
        return;
    }

    usersToRender.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.persona.primer_nombre} ${user.persona.apellido_paterno}</td>
            <td>${user.persona.dni}</td>
            <td>${user.persona.telefono || 'N/A'}</td>
            <td>${user.persona.correo}</td>
            <td>
                <span class="badge ${user.role.codigo === 'cliente' ? 'bg-primary' : 'bg-success'}">
                    ${user.role.nombre}
                </span>
            </td>
            <td>${formatDate(user.creado_el)}</td>
            <td>
                <button class="btn btn-sm btn-info me-1" onclick="viewUser(${user.id})">
                    <i class="bi bi-eye"></i> Ver
                </button>
                <button class="btn btn-sm btn-warning me-1" onclick="editUser(${user.id})">
                    <i class="bi bi-pencil"></i> Editar
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                    <i class="bi bi-trash"></i> Eliminar
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Filtrar usuarios
function filterUsers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filterType = document.getElementById('filterType').value;

    let filteredUsers = users.filter(user => {
        const matchesSearch = 
            user.persona.primer_nombre.toLowerCase().includes(searchTerm) ||
            user.persona.apellido_paterno.toLowerCase().includes(searchTerm) ||
            user.persona.dni.includes(searchTerm) ||
            (user.persona.telefono && user.persona.telefono.includes(searchTerm));

        const matchesType = !filterType || user.role.codigo === filterType;

        return matchesSearch && matchesType;
    });

    renderUsersTable(filteredUsers);
}

// Abrir modal para nuevo usuario
function openUserModal() {
    isEditing = false;
    currentUserId = null;
    document.getElementById('userModalLabel').textContent = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    
    // Mostrar campos de contraseña para nuevo usuario
    document.getElementById('clave').parentElement.style.display = 'block';
    document.getElementById('confirmarClave').parentElement.style.display = 'block';
}

// Editar usuario
async function editUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
            throw new Error('Error al cargar usuario');
        }

        const result = await response.json();
        const user = result.user;

        // Llenar el formulario
        document.getElementById('userId').value = user.id;
        document.getElementById('primerNombre').value = user.persona.primer_nombre;
        document.getElementById('segundoNombre').value = user.persona.segundo_nombre || '';
        document.getElementById('apellidoPaterno').value = user.persona.apellido_paterno;
        document.getElementById('apellidoMaterno').value = user.persona.apellido_materno || '';
        document.getElementById('dni').value = user.persona.dni;
        document.getElementById('telefono').value = user.persona.telefono || '';
        document.getElementById('email').value = user.persona.correo;
        document.getElementById('direccion').value = user.persona.direccion || '';
        document.getElementById('rol').value = user.rol_id;

        // Ocultar campos de contraseña para edición
        document.getElementById('clave').parentElement.style.display = 'none';
        document.getElementById('confirmarClave').parentElement.style.display = 'none';

        isEditing = true;
        currentUserId = userId;
        document.getElementById('userModalLabel').textContent = 'Editar Usuario';

        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();

    } catch (error) {
        console.error('Error cargando usuario:', error);
        showAlert('Error al cargar usuario', 'danger');
    }
}

// Ver usuario
async function viewUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
            throw new Error('Error al cargar usuario');
        }

        const result = await response.json();
        const user = result.user;

        // Mostrar información del usuario en un modal o alerta
        const userInfo = `
            <strong>Información del Usuario:</strong><br>
            <strong>Nombre:</strong> ${user.persona.primer_nombre} ${user.persona.segundo_nombre || ''} ${user.persona.apellido_paterno} ${user.persona.apellido_materno || ''}<br>
            <strong>DNI:</strong> ${user.persona.dni}<br>
            <strong>Teléfono:</strong> ${user.persona.telefono || 'N/A'}<br>
            <strong>Email:</strong> ${user.persona.correo}<br>
            <strong>Dirección:</strong> ${user.persona.direccion || 'N/A'}<br>
            <strong>Tipo:</strong> ${user.role.nombre}<br>
            <strong>Fecha de registro:</strong> ${formatDate(user.creado_el)}
        `;

        showAlert(userInfo, 'info', true);

    } catch (error) {
        console.error('Error cargando usuario:', error);
        showAlert('Error al cargar usuario', 'danger');
    }
}

// Guardar usuario (crear o actualizar)
async function saveUser() {
    const form = document.getElementById('userForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Validar contraseñas si es nuevo usuario
    if (!isEditing) {
        const clave = document.getElementById('clave').value;
        const confirmarClave = document.getElementById('confirmarClave').value;
        
        if (clave !== confirmarClave) {
            showAlert('Las contraseñas no coinciden', 'danger');
            return;
        }
    }

    const userData = {
        dni: document.getElementById('dni').value,
        telefono: document.getElementById('telefono').value,
        correo: document.getElementById('email').value,
        primer_nombre: document.getElementById('primerNombre').value,
        segundo_nombre: document.getElementById('segundoNombre').value,
        apellido_paterno: document.getElementById('apellidoPaterno').value,
        apellido_materno: document.getElementById('apellidoMaterno').value,
        direccion: document.getElementById('direccion').value,
        rol_id: parseInt(document.getElementById('rol').value)
    };

    if (!isEditing) {
        userData.clave = document.getElementById('clave').value;
    }

    try {
        const url = isEditing 
            ? `${API_BASE_URL}/users/${currentUserId}`
            : `${API_BASE_URL}/users`;
        
        const method = isEditing ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al guardar usuario');
        }

        const result = await response.json();
        
        showAlert(result.message, 'success');
        
        // Cerrar modal y recargar usuarios
        const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
        modal.hide();
        
        loadUsers();

    } catch (error) {
        console.error('Error guardando usuario:', error);
        showAlert(error.message, 'danger');
    }
}

// Eliminar usuario
function deleteUser(userId) {
    currentUserId = userId;
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();
}

// Confirmar eliminación
async function confirmDelete() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${currentUserId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error al eliminar usuario');
        }

        const result = await response.json();
        
        showAlert(result.message, 'success');
        
        // Cerrar modal y recargar usuarios
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();
        
        loadUsers();

    } catch (error) {
        console.error('Error eliminando usuario:', error);
        showAlert(error.message, 'danger');
    }
}

// Mostrar alerta
function showAlert(message, type = 'info', isHTML = false) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    
    if (isHTML) {
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    } else {
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
    }
    
    document.body.appendChild(alertDiv);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Formatear fecha
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
} 