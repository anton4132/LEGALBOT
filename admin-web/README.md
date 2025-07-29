# LegalBot Admin Panel

Panel de administración para LegalBot con sistema de autenticación y gestión de usuarios, conectado a base de datos PostgreSQL.

## 📁 Estructura del Proyecto

```
admin-web/
├── assets/
│   ├── css/
│   │   └── styles.css          # Estilos principales
│   ├── js/
│   │   ├── scripts.js          # Lógica principal del dashboard
│   │   └── login.js            # Lógica de autenticación
│   └── images/                 # Imágenes del proyecto
├── components/
│   ├── sidebar.html            # Componente del menú lateral
│   └── adminmenu.html          # Componente del menú superior
├── pages/
│   └── usuarios.html           # Página de gestión de usuarios
├── index.html                  # Dashboard principal
├── login.html                  # Página de inicio de sesión
└── README.md                   # Este archivo
```

## 🚀 Características

- **Sistema de Login**: Autenticación con base de datos PostgreSQL
- **Dashboard Dinámico**: Datos reales desde la base de datos
- **Gráficos Interactivos**: Visualización de datos con Chart.js
- **Navegación Intuitiva**: Menú lateral y superior
- **Gestión de Sesiones**: Persistencia de login con localStorage
- **API REST**: Backend con Express y Prisma ORM

## 🔐 Credenciales de Acceso

### Usuario Administrador (desde la base de datos)
- **Email**: `admin@legalbot.pe`
- **Contraseña**: `admin`

**Nota**: Las credenciales se obtienen desde la tabla `usuarios` de la base de datos. Solo usuarios con rol 'admin' pueden acceder al panel.

## 🛠️ Tecnologías Utilizadas

### Frontend
- **HTML5**: Estructura semántica
- **CSS3**: Estilos personalizados con variables CSS
- **JavaScript**: Lógica de frontend
- **Bootstrap 5**: Framework de UI
- **Chart.js**: Librería de gráficos

### Backend
- **Node.js**: Runtime de JavaScript
- **Express**: Framework web
- **Prisma**: ORM para PostgreSQL
- **PostgreSQL**: Base de datos

## 📋 Funcionalidades

### Dashboard Principal (`index.html`)
- **KPIs Dinámicos**: Clientes, abogados, citas y transacciones desde la BD
- **Gráficos en Tiempo Real**: Datos de crecimiento semanal
- **Diseño Responsivo**: Adaptable a diferentes dispositivos

### Sistema de Autenticación
- **Validación con BD**: Verificación de credenciales en PostgreSQL
- **Control de Roles**: Solo administradores pueden acceder
- **Persistencia de Sesión**: Opción "Recordarme"
- **Redirección Automática**: Navegación fluida

### API REST
- **POST /api/login**: Autenticación de usuarios
- **GET /api/dashboard/stats**: Estadísticas del dashboard
- **GET /api/dashboard/charts**: Datos para gráficos
- **GET /api/usuarios**: Lista de usuarios

## 🎨 Estilo y Diseño

- **Paleta de Colores**: Azul noche (#101a2b) y variaciones
- **Tipografía**: Fuentes del sistema con pesos variables
- **Componentes**: Cards con sombras suaves y bordes redondeados
- **Interacciones**: Hover effects y transiciones suaves

## 🔧 Instalación y Configuración

### 1. Configurar la Base de Datos
```bash
# En el directorio backend/
npm install
npx prisma generate
npx prisma db push
```

### 2. Configurar Variables de Entorno
Crear archivo `.env` en el directorio `backend/`:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/legalbot"
```

### 3. Iniciar el Backend
```bash
# En el directorio backend/
npm run dev
```

### 4. Acceder al Frontend
1. **Abrir** `login.html` en un navegador web
2. **Iniciar sesión** con las credenciales de la base de datos
3. **Navegar** por el dashboard y las diferentes secciones

## 📱 Responsividad

El panel está optimizado para:
- **Desktop**: Pantallas grandes y medianas
- **Tablet**: Dispositivos táctiles medianos
- **Mobile**: Smartphones y dispositivos pequeños

## 🔄 Próximas Mejoras

- [ ] Implementar hash de contraseñas con bcrypt
- [ ] Sistema de notificaciones en tiempo real
- [ ] Exportación de datos a Excel/PDF
- [ ] Gestión avanzada de usuarios
- [ ] Auditoría de acciones del administrador
- [ ] Temas personalizables
- [ ] Dashboard con más métricas

## 📊 Estructura de la Base de Datos

El sistema utiliza las siguientes tablas principales:
- **usuarios**: Información de usuarios del sistema
- **persona**: Datos personales de los usuarios
- **role**: Roles del sistema (admin, cliente, abogado)
- **cita**: Citas programadas
- **pago**: Transacciones de pago
- **consulta**: Consultas legales

## 🚨 Notas Importantes

1. **Seguridad**: En producción, implementar hash de contraseñas
2. **CORS**: Configurar CORS apropiadamente para producción
3. **Variables de Entorno**: Nunca commitear credenciales de BD
4. **Backup**: Realizar backups regulares de la base de datos

## 📞 Soporte

Para soporte técnico o consultas sobre el proyecto, contactar al equipo de desarrollo de LegalBot.