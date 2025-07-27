// scripts.js
window.addEventListener('DOMContentLoaded', function() {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    fetch('sidebar.html')
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
    fetch('adminmenu.html')
      .then(res => res.text())
      .then(html => {
        adminMenuContainer.innerHTML = html;
      });
  }

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