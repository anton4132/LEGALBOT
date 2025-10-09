const API_BASE_URL = '/api';

// Función para mostrar alertas
function showAlert(message, type = 'danger') {
  const alertContainer = document.getElementById('alert-container');
  alertContainer.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

// Función para limpiar alertas
function clearAlert() {
  const alertContainer = document.getElementById('alert-container');
  alertContainer.innerHTML = '';
}

// Función para guardar sesión
function saveSession(userData, token) {
  localStorage.setItem('adminLoggedIn', 'true');
  localStorage.setItem('adminEmail', userData.email);
  localStorage.setItem('adminName', userData.nombre);
  localStorage.setItem('adminId', userData.id);
  localStorage.setItem('loginTime', new Date().toISOString());
  if (token) {
    localStorage.setItem('adminToken', token);
    sessionStorage.setItem('adminToken', token);
  }
}

// Función para verificar si ya está logueado
function checkIfLoggedIn() {
  const isLoggedIn = localStorage.getItem('adminLoggedIn');
  if (isLoggedIn === 'true') {
    // Redirigir al dashboard si ya está logueado
    window.location.href = 'index.html';
  }
}

// Función para manejar el login
async function handleLogin(email, password, rememberMe) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      showAlert('¡Inicio de sesión exitoso! Redirigiendo...', 'success');
      
      // Guardar sesión con token para las peticiones autenticadas
      saveSession(data.user, data.token);
      
      // Si marcó "recordarme", guardar por más tiempo
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      
      // Redirigir después de 1 segundo
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 1000);
    } else {
      showAlert(data.message || 'Error en el inicio de sesión');
    }
  } catch (error) {
    console.error('Error en login:', error);
    showAlert('Error de conexión. Verifica que el servidor esté funcionando.');
  }
}

// Event listener para el formulario
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si ya está logueado
  checkIfLoggedIn();
  
  const loginForm = document.getElementById('loginForm');
  
  loginForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Limpiar alertas anteriores
    clearAlert();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('rememberMe').checked;
    
    // Validaciones básicas
    if (!email.includes('@')) {
      showAlert('Por favor, ingresa un email válido.');
      return;
    }
    
    // Procesar login
    handleLogin(email, password, rememberMe);
  });
  
  // Limpiar alertas al hacer clic en el botón de cerrar
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-close')) {
      clearAlert();
    }
  });
});

// Función para logout (se puede usar desde otras páginas)
function logout() {
  localStorage.removeItem('adminLoggedIn');
  localStorage.removeItem('adminEmail');
  localStorage.removeItem('adminName');
  localStorage.removeItem('adminId');
  localStorage.removeItem('loginTime');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminToken');
  window.location.href = 'login.html';
}