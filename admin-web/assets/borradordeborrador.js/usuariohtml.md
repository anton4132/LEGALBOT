<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Gestión de Usuarios</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/styles.css">
</head>
<body>
  <div class="d-flex">
    <!-- Sidebar -->
    <nav id="sidebar" class="bg-light border-end vh-100 p-3" style="width: 220px;">
      <h4 class="mb-4">LegalBot</h4>
      <ul class="nav nav-pills flex-column">
        <li class="nav-item mb-2"><a class="nav-link" href="/dashboard" id="menu-home">Home</a></li>
        <li class="nav-item mb-2"><a class="nav-link active" href="/usuarios" id="menu-usuarios">Gestión de Usuarios</a></li>
        <li class="nav-item mb-2"><a class="nav-link" href="/Tarifas" id="menu-tarifas">Tarifas & Comisiones</a></li>
        <li class="nav-item mb-2"><a class="nav-link" href="#">Almacenamiento</a></li>
        <li class="nav-item mb-2"><a class="nav-link" href="/servicios">Servicios</a></li>
        <li class="nav-item mb-2"><a class="nav-link" href="#">Estadísticas</a></li>
        <li class="nav-item mt-auto"><a class="nav-link text-danger" href="#" onclick="logout()">Cerrar sesión</a></li>
      </ul>
    </nav>
    <!-- Main content -->
    <div class="flex-grow-1" id="main-content">
      <div class="d-flex align-items-center bg-white p-2 border-bottom">
        <button class="btn btn-outline-secondary me-3 d-md-none" id="toggle-btn">☰</button>
        <div class="ms-auto">
          <div class="dropdown">
            <a class="btn btn-light dropdown-toggle fw-bold" href="#" id="profileMenu" data-bs-toggle="dropdown">Admin</a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="profileMenu">
              <li><a class="dropdown-item text-danger" href="#" onclick="logout()">Cerrar sesión</a></li>
            </ul>
          </div>
        </div>
      </div>
        
      <main class="p-4">
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="fw-bold">Gestión de Usuarios</h3>
            <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#userModal" onclick="openUserModal()">
              <i class="bi bi-plus-circle"></i> + Nuevo Usuario
            </button>
        </div>
        <!-- Filtros -->
        <form class="row g-2 mb-3">
          <div class="col-md-4">
            <input type="text" class="form-control" id="searchInput" placeholder="Buscar por nombre, DNI o celular">
          </div>
          <div class="col-md-3">
            <select class="form-select" id="filterType">
              <option value="">Todos los tipos</option>
            </select>
          </div>
          <div class="col-md-2">
            <button class="btn btn-outline-secondary w-100" type="button" onclick="filterUsers()">Filtrar</button>
          </div>
        </form>
        <!-- Tabla de usuarios -->
        <div class="table-responsive">
          <table class="table table-striped align-middle">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>DNI</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Fecha registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="usersTableBody">
              <!-- Los usuarios se cargarán dinámicamente -->
            </tbody>
          </table>
        </div>
      </main>
    </div>
  </div>

   <!-- Modal para crear/editar usuario -->
   <div class="modal fade" id="userModal" tabindex="-1" aria-labelledby="userModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-xl"> <!-- Aumentado a modal-xl para más espacio -->
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="userModalLabel">Nuevo Usuario</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="userForm">
            <input type="hidden" id="userId">
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="dni" class="form-label">DNI *</label>
                <input type="text" class="form-control" id="dni" maxlength="8" pattern="\d{8}" inputmode="numeric" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="telefono" class="form-label">Teléfono *</label>
                <input type="tel" class="form-control" id="telefono" required>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="primerNombre" class="form-label">Primer Nombre *</label>
                <input type="text" class="form-control" id="primerNombre" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="segundoNombre" class="form-label">Segundo Nombre</label>
                <input type="text" class="form-control" id="segundoNombre">
              </div>
            </div>
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="apellidoPaterno" class="form-label">Apellido Paterno *</label>
                <input type="text" class="form-control" id="apellidoPaterno" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="apellidoMaterno" class="form-label">Apellido Materno</label>
                <input type="text" class="form-control" id="apellidoMaterno">
              </div>
            </div>
            
            <div class="row">
              <div class="col-md-6 mb-3">
                <label for="email" class="form-label">Email *</label>
                <input type="email" class="form-control" id="email" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="rol" class="form-label">Tipo de Usuario *</label>
                <select class="form-select" id="rol" required>
                  <option value="">Seleccionar tipo</option>
                </select>
              </div>
            </div>
            <div class="mb-3">
              <label for="direccion" class="form-label">Dirección</label>
              <textarea class="form-control" id="direccion" rows="2"></textarea>
            </div>
            <div class="row" id="password-fields">
              <div class="col-md-6 mb-3">
                <label for="clave" class="form-label">Contraseña *</label>
                <input type="password" class="form-control" id="clave" required>
              </div>
              <div class="col-md-6 mb-3">
                <label for="confirmarClave" class="form-label">Confirmar Contraseña *</label>
                <input type="password" class="form-control" id="confirmarClave" required>
              </div>
            </div>

            <!-- CAMPOS ADICIONALES PARA ABOGADOS (OCULTOS POR DEFECTO) -->
            <div id="abogado-fields" style="display: none;">
                <hr>
                <h5 class="mb-3 text-primary">Información Adicional de Abogado</h5>
                <div class="row">
                    <div class="col-md-4 mb-3">
                        <label for="especialidad" class="form-label">Especialidad</label>
                        <input type="text" class="form-control" id="especialidad">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="tarifabase" class="form-label">Tarifa Base (por consulta)</label>
                        <input type="number" class="form-control" id="tarifabase" min="0" step="0.01">
                    </div>
                    <div class="col-md-4 mb-3">
                        <label for="duracionMinutos" class="form-label">Duración Consulta (minutos)</label>
                        <input type="number" class="form-control" id="duracionMinutos" min="1">
                    </div>
                </div>
                <div class="mb-3">
                    <label for="direccionAtencion" class="form-label">Dirección de Atención</label>
                    <textarea class="form-control" id="direccionAtencion" rows="2"></textarea>
                </div>
                <div class="mb-3">
                    <label for="biografia" class="form-label">Biografía</label>
                    <textarea class="form-control" id="biografia" rows="3"></textarea>
                </div>
                
                <!-- Pestañas para Estudio y Disponibilidad -->
                <ul class="nav nav-tabs" id="abogadoTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="estudio-tab" data-bs-toggle="tab" data-bs-target="#estudio-tab-pane" type="button" role="tab">Estudio / Despacho</button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="disponibilidad-tab" data-bs-toggle="tab" data-bs-target="#disponibilidad-tab-pane" type="button" role="tab">Disponibilidad</button>
                    </li>
                </ul>
                <div class="tab-content border border-top-0 p-3 rounded-bottom" id="abogadoTabsContent">
                    <!-- Pestaña Estudio -->
                    <div class="tab-pane fade" id="estudio-tab-pane" role="tabpanel">
                        <h6>Detalles del Estudio</h6>
                        <div class="row">
                            <div class="col-md-6 mb-3"><label class="form-label">Ruc:</label><input type="text" class="form-control" id="estudioRuc"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">Nombre del Estudio</label><input type="text" class="form-control" id="estudioNombre"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">País</label><input type="text" class="form-control" id="estudioPais"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">Ciudad</label><input type="text" class="form-control" id="estudioCiudad"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">Correo de Contacto</label><input type="email" class="form-control" id="estudioCorreo"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">Teléfono</label><input type="tel" class="form-control" id="estudioTelefono"></div>
                            <div class="col-md-6 mb-3"><label class="form-label">Dirección</label><input type="text" class="form-control" id="estudioDireccion"></div>
                        </div>
                    </div>
                    <!-- Pestaña Disponibilidad -->
                    <div class="tab-pane fade" id="disponibilidad-tab-pane" role="tabpanel">
                        <h6>Horarios Disponibles</h6>
                        <div id="availability-list">
                            <!-- Los horarios se añadirán aquí dinámicamente -->
                        </div>
                        <button type="button" class="btn btn-outline-success btn-sm mt-2" id="add-availability-btn">
                            <i class="bi bi-plus"></i> Añadir Horario
                        </button>
                    </div>
                </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-primary" onclick="saveUser()">Guardar Usuario</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal de confirmación para eliminar -->
  <div class="modal fade" id="deleteModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Confirmar Eliminación</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <p>¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
          <button type="button" class="btn btn-danger" onclick="confirmDelete()">Eliminar</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script src="../assets/js/usuarios.js"></script>
</body>
</html>
