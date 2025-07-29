# LegalBot Backend

Backend modular para LegalBot que sirve tanto al Admin Web como a la aplicación Flutter.

## 🏗️ Estructura del Proyecto

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # Configuración de Prisma
│   ├── controllers/
│   │   ├── authController.js     # Controlador de autenticación
│   │   ├── dashboardController.js # Controlador del dashboard
│   │   └── userController.js     # Controlador de usuarios
│   ├── middleware/
│   │   └── auth.js              # Middleware de autenticación
│   ├── routes/
│   │   ├── authRoutes.js        # Rutas de autenticación
│   │   ├── dashboardRoutes.js   # Rutas del dashboard
│   │   ├── userRoutes.js        # Rutas de usuarios
│   │   └── index.js             # Agrupador de rutas
│   ├── app.js                   # Configuración de Express
│   └── server.js                # Punto de entrada del servidor
├── prisma/
│   └── schema.prisma            # Esquema de la base de datos
├── package.json
└── README.md
```

## 🚀 Características

- **Arquitectura Modular**: Separación clara de responsabilidades
- **API REST**: Endpoints organizados por funcionalidad
- **Autenticación**: Sistema de login/logout
- **Dashboard**: Estadísticas y gráficos en tiempo real
- **Gestión de Usuarios**: CRUD completo de usuarios
- **Base de Datos**: PostgreSQL con Prisma ORM
- **CORS**: Configurado para múltiples clientes
- **Manejo de Errores**: Middleware centralizado
- **Logging**: Console logs detallados

## 📋 Endpoints de la API

### Autenticación
- `POST /api/auth/login` - Login de usuario
- `POST /api/auth/logout` - Logout de usuario
- `GET /api/auth/verify` - Verificar token

### Dashboard
- `GET /api/dashboard/stats` - Estadísticas del dashboard
- `GET /api/dashboard/charts` - Datos para gráficos

### Usuarios
- `GET /api/users` - Obtener todos los usuarios
- `GET /api/users/:id` - Obtener usuario por ID
- `POST /api/users` - Crear nuevo usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

## 🔧 Instalación y Configuración

### 1. Instalar Dependencias
```bash
npm install
```

### 2. Configurar Variables de Entorno
Crear archivo `.env`:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/legalbot"
NODE_ENV="development"
PORT=3000
```

### 3. Configurar Base de Datos
```bash
# Generar cliente de Prisma
npx prisma generate

# Sincronizar esquema
npx prisma db push
```

### 4. Iniciar Servidor
```bash
# Desarrollo
npm run dev

# Producción
npm start
```

## 🌐 URLs Disponibles

- **API**: `http://localhost:3000/api`
- **Admin Web**: `http://localhost:3000/dashboard`
- **Login**: `http://localhost:3000/login`
- **Health Check**: `http://localhost:3000/`

## 📊 Estructura de Datos

### Autenticación
```javascript
// POST /api/auth/login
{
  "email": "admin@legalbot.pe",
  "password": "admin"
}

// Response
{
  "success": true,
  "message": "Login exitoso",
  "user": {
    "id": 1,
    "email": "admin@legalbot.pe",
    "nombre": "Super Admin",
    "rol": "admin"
  }
}
```

### Dashboard Stats
```javascript
// GET /api/dashboard/stats
{
  "success": true,
  "stats": {
    "clientes": 150,
    "abogados": 25,
    "citas": 45,
    "transacciones": 89
  }
}
```

### Dashboard Charts
```javascript
// GET /api/dashboard/charts
{
  "success": true,
  "charts": {
    "clientes": [
      {
        "semana": "2024-01-01",
        "nuevos_clientes": 12
      }
    ],
    "abogados": [
      {
        "semana": "2024-01-01",
        "nuevos_abogados": 3
      }
    ]
  }
}
```

## 🔐 Seguridad

### Middleware de Autenticación
- `authenticateUser`: Verifica tokens de autenticación
- `requireAdmin`: Verifica permisos de administrador

### Validaciones
- Validación de entrada en todos los endpoints
- Sanitización de datos
- Manejo de errores centralizado

## 🛠️ Desarrollo

### Agregar Nuevo Controlador
1. Crear archivo en `src/controllers/`
2. Exportar funciones del controlador
3. Crear rutas en `src/routes/`
4. Agregar rutas al `src/routes/index.js`

### Agregar Nuevo Middleware
1. Crear archivo en `src/middleware/`
2. Exportar funciones del middleware
3. Aplicar en rutas específicas

### Agregar Nuevas Rutas
1. Crear archivo en `src/routes/`
2. Importar controlador correspondiente
3. Definir rutas con Express Router
4. Agregar al `src/routes/index.js`

## 📱 Compatibilidad

### Admin Web
- Endpoints específicos para dashboard
- Autenticación con email/password
- CORS configurado para localhost

### Flutter App
- API REST estándar
- JSON responses
- Autenticación por token (preparado)

## 🔄 Próximas Mejoras

- [ ] Implementar JWT para autenticación
- [ ] Agregar validación con Joi o Yup
- [ ] Implementar rate limiting
- [ ] Agregar documentación con Swagger
- [ ] Implementar tests unitarios
- [ ] Agregar logging con Winston
- [ ] Implementar cache con Redis
- [ ] Agregar compresión gzip

## 🚨 Notas Importantes

1. **Seguridad**: En producción, implementar hash de contraseñas
2. **CORS**: Configurar dominios específicos para producción
3. **Variables de Entorno**: Nunca commitear credenciales
4. **Backup**: Realizar backups regulares de la BD
5. **Logs**: Monitorear logs en producción

## 📞 Soporte

Para soporte técnico o consultas sobre el backend, contactar al equipo de desarrollo de LegalBot.