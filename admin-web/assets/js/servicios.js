let services = [];
let currentServiceId = null;
let isEditing = false;

const API_BASE_URL = 'http://localhost:3000/api';

console.log('✅ servicios.js cargado correctamente');

function logout() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminId');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('rememberMe');
  window.location.href = '/login';
}

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  ['searchService', 'filterEstado', 'orderBy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', applyFilters);
  });
  document.getElementById('filterEstado')?.addEventListener('change', applyFilters);
  document.getElementById('orderBy')?.addEventListener('change', applyFilters);
});

async function loadServices() {
  try {
    const res = await fetch(`${API_BASE_URL}/services`);
    if (!res.ok) throw new Error('Error cargando servicios');
    services = await res.json();
    applyFilters();
  } catch (err) {
    console.error('Error cargando servicios:', err);
    showAlert(err.message, 'danger');
  }
}

function applyFilters() {
  const term = document.getElementById('searchService')?.value.toLowerCase() || '';
  const estado = document.getElementById('filterEstado')?.value;
  const order = document.getElementById('orderBy')?.value || 'nombre';
  let list = services.filter(s =>
    s.codigo.toLowerCase().includes(term) ||
    s.nombre.toLowerCase().includes(term)
  );
  if (estado === 'true' || estado === 'false') {
    list = list.filter(s => String(s.activo) === estado);
  }
  if (order === 'fecha_creada') {
    list.sort((a, b) => new Date(b.fecha_creada) - new Date(a.fecha_creada));
  } else {
    list.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  renderServicesTable(list);
}

function renderServicesTable(list) {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No se encontraron servicios</td></tr>`;
  }
  list.forEach(s => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${s.codigo}</td>
      <td>${s.nombre}</td>
      <td>${s.tieneTarifaVigente ? '<span class="badge bg-info">Sí</span>' : 'No'}</td>
      <td>${s.tienePlanVigente ? '<span class="badge bg-info">Sí</span>' : 'No'}</td>
      <td>${s.activo ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-secondary">Inactivo</span>'}</td>
      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="openServiceModal(${s.id})"><i class="bi bi-pencil"></i> Editar</button>
        <button class="btn btn-sm ${s.activo ? 'btn-danger' : 'btn-success'}" onclick="toggleService(${s.id}, ${s.activo})">
          ${s.activo ? 'Desactivar' : 'Activar'}
        </button>
      </td>`;
    tbody.appendChild(row);
  });
}


function openServiceModal(id = null) {
  const modalEl = document.getElementById('serviceModal');
  const modal = new bootstrap.Modal(modalEl);
  document.getElementById('serviceForm').reset();
  currentServiceId = id;
  isEditing = !!id;
  document.getElementById('serviceModalLabel').textContent = id ? 'Editar Servicio' : 'Nuevo Servicio';
  if (id) {
    const svc = services.find(s => s.id === id);
    if (svc) {
      document.getElementById('svcCodigo').value = svc.codigo;
      document.getElementById('svcNombre').value = svc.nombre;
      document.getElementById('svcDescripcion').value = svc.descripcion || '';
      document.getElementById('svcActivo').checked = svc.activo;
    }
  } else {
    document.getElementById('svcActivo').checked = true;
  }
  modal.show();
}

async function saveService() {
  const codigo = document.getElementById('svcCodigo').value.trim();
  const nombre = document.getElementById('svcNombre').value.trim();
  const descripcion = document.getElementById('svcDescripcion').value.trim();
  const activo = document.getElementById('svcActivo').checked;
  if (!codigo || !nombre) {
    showAlert('Código y nombre son obligatorios', 'danger');
    return;
  }
  const payload = { codigo, nombre, descripcion, activo };
  const url = isEditing ? `${API_BASE_URL}/services/${currentServiceId}` : `${API_BASE_URL}/services`;
  const method = isEditing ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.message || 'Error guardando servicio');
    }
    await loadServices();
    bootstrap.Modal.getInstance(document.getElementById('serviceModal')).hide();
    showAlert('Servicio guardado', 'success');
  } catch (err) {
    console.error('Error guardando servicio:', err);
    showAlert(err.message, 'danger');
  }
}

async function toggleService(id, activo) {
  try {
    const res = await fetch(`${API_BASE_URL}/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: !activo })
    });
    if (!res.ok) {
      const errData = await res.json();
      if (errData.tarifas || errData.planes) {
        if (confirm(`${errData.message}. ¿Desactivar de todos modos?`)) {
          const forceRes = await fetch(`${API_BASE_URL}/services/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: false, force: true })
          });
          if (!forceRes.ok) {
            const data = await forceRes.json();
            throw new Error(data.message || 'Error actualizando servicio');
          }
        } else {
          return;
        }
      } else {
        throw new Error(errData.message || 'Error actualizando servicio');
      }
    }
    await loadServices();
    showAlert('Servicio actualizado', 'success');
  } catch (err) {
    console.error('Error actualizando servicio:', err);
    showAlert(err.message, 'danger');
  }
}

function showAlert(message, type = 'info') {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
  alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999;';
  alertDiv.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  document.body.appendChild(alertDiv);
  setTimeout(() => { alertDiv.remove(); }, 4000);
}