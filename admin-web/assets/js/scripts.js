// Configuración de la API
const API_BASE_URL = 'http://localhost:3000/api';

// Verificación de autenticación
function checkAuth() {
  const isLoggedIn = localStorage.getItem('adminLoggedIn');
  if (isLoggedIn !== 'true') {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Función para logout
function logout() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminId');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('rememberMe');
  window.location.href = 'login.html';
}

// Función para cargar estadísticas del dashboard
async function loadDashboardStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`);
    const data = await response.json();
    
    if (data.success) {
      // Actualizar KPIs
      document.getElementById('kpi-clientes').textContent = data.stats.clientes;
      document.getElementById('kpi-abogados').textContent = data.stats.abogados;
      document.getElementById('kpi-citas').textContent = data.stats.citas;
      document.getElementById('kpi-transacciones').textContent = data.stats.transacciones;
    }
  } catch (error) {
    console.error('Error cargando estadísticas:', error);
  }
}

// Función para cargar datos de gráficos
async function loadChartData() {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/charts`);
    const data = await response.json();
    
    if (data.success) {
      // Procesar datos de clientes
      const clientesLabels = data.charts.clientes.map(item => {
        const date = new Date(item.semana);
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      });
      const clientesData = data.charts.clientes.map(item => item.nuevos_clientes);

      // Procesar datos de abogados
      const abogadosLabels = data.charts.abogados.map(item => {
        const date = new Date(item.semana);
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
      });
      const abogadosData = data.charts.abogados.map(item => item.nuevos_abogados);

      // Crear gráficos con datos reales
      createCharts(clientesLabels, clientesData, abogadosLabels, abogadosData);
    }
  } catch (error) {
    console.error('Error cargando datos de gráficos:', error);
    // Usar datos de ejemplo si hay error
    createChartsWithFallbackData();
  }
}

// Función para crear gráficos con datos reales
function createCharts(clientesLabels, clientesData, abogadosLabels, abogadosData) {
  // Gráfico de Clientes
  new Chart(document.getElementById('clientesChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: clientesLabels,
      datasets: [{
        label: 'Clientes nuevos',
        data: clientesData,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#0d6efd',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          title: { display: true, text: 'Semana' },
        },
        y: {
          title: { display: true, text: 'Nuevos clientes' },
          beginAtZero: true
        }
      }
    }
  });

  // Gráfico de Abogados
  new Chart(document.getElementById('abogadosChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: abogadosLabels,
      datasets: [{
        label: 'Abogados nuevos',
        data: abogadosData,
        borderColor: '#0dcaf0',
        backgroundColor: 'rgba(13,202,240,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#0dcaf0',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          title: { display: true, text: 'Semana' },
        },
        y: {
          title: { display: true, text: 'Nuevos abogados' },
          beginAtZero: true
        }
      }
    }
  });
}

// Función para crear gráficos con datos de fallback
function createChartsWithFallbackData() {
  // Datos de ejemplo si no se puede conectar al backend
  const semanas = [
    '2024-04-01',
    '2024-04-08',
    '2024-04-15',
    '2024-04-22',
    '2024-04-29',
    '2024-05-06'
  ];
  const clientesData = [5, 8, 6, 10, 7, 12];
  const abogadosData = [2, 3, 4, 2, 5, 6];

  // Gráfico de Clientes
  new Chart(document.getElementById('clientesChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: semanas,
      datasets: [{
        label: 'Clientes nuevos',
        data: clientesData,
        borderColor: '#0d6efd',
        backgroundColor: 'rgba(13,110,253,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#0d6efd',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          title: { display: true, text: 'Semana (fecha de inicio)' },
          ticks: {
            callback: function(value, index) {
              const fecha = semanas[index];
              return fecha.slice(5); // MM-DD
            }
          }
        },
        y: {
          title: { display: true, text: 'Nuevos clientes' },
          beginAtZero: true
        }
      }
    }
  });

  // Gráfico de Abogados
  new Chart(document.getElementById('abogadosChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: semanas,
      datasets: [{
        label: 'Abogados nuevos',
        data: abogadosData,
        borderColor: '#0dcaf0',
        backgroundColor: 'rgba(13,202,240,0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#0dcaf0',
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: true },
        tooltip: { enabled: true }
      },
      scales: {
        x: {
          title: { display: true, text: 'Semana (fecha de inicio)' },
          ticks: {
            callback: function(value, index) {
              const fecha = semanas[index];
              return fecha.slice(5); // MM-DD
            }
          }
        },
        y: {
          title: { display: true, text: 'Nuevos abogados' },
          beginAtZero: true
        }
      }
    }
  });
}

// scripts.js
window.addEventListener('DOMContentLoaded', function() {
  // Verificar autenticación primero
  if (!checkAuth()) {
    return;
  }

  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    fetch('components/sidebar.html')
      .then(res => res.text())
      .then(html => {
        sidebarContainer.innerHTML = html;
        // Resalta el menú activo según la página
        const path = window.location.pathname;
        if (path.endsWith('index.html') || path === '/' || path === '/admin-web/' ) {
          document.getElementById('menu-home')?.classList.add('active');
        } else if (path.endsWith('usuarios.html')) {
          document.getElementById('menu-usuarios')?.classList.add('active');
        }
        // Mostrar el contenido principal
        document.getElementById('main-content')?.classList.remove('invisible');
      });
  }

  // Cargar el menú de admin en el header si existe el contenedor
  const adminMenuContainer = document.getElementById('adminmenu-container');
  if (adminMenuContainer) {
    fetch('components/adminmenu.html')
      .then(res => res.text())
      .then(html => {
        adminMenuContainer.innerHTML = html;
      });
  }

  // Cargar datos del dashboard
  loadDashboardStats();
  loadChartData();

  // Toggle sidebar (botón hamburguesa) usando event delegation
  document.addEventListener('click', function(e) {
    if (e.target && e.target.id === 'toggle-btn') {
      const sidebar = document.getElementById('sidebar-container');
      if (sidebar) {
        sidebar.classList.toggle('d-none');
      }
    }
  });
}); 