# LegalBot Backend

Backend para LegalBot con API REST, autenticación y base de datos PostgreSQL.

## 🚀 Instalación

```bash
npm install
```

## ⚙️ Configuración

1. Crear archivo `.env`:
```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/legalbot"
NODE_ENV="development"
PORT=3000
```

2. Configurar base de datos:

```bash
# Si recibes BD con datos
npx prisma db pull
npx prisma generate

# Si creas BD desde cero
npx prisma generate
npx prisma db push
```

**📌 Resumen rápido:**
- Si partes de cero → `generate` y luego `db push`.
- Si recibes la BD (ej. respaldo.sql) → importa, luego `db pull` y después `generate`.


## 🏃‍♂️ Ejecutar

```bash
npm run dev
```

## 📁 Estructura
```bash
backend/
├── src/
│ ├── config/
│ │ └── database.js # Configuración Prisma
│ ├── controllers/
│ │ ├── authController.js # Autenticación
│ │ ├── dashboardController.js # Dashboard
│ │ └── userController.js # Usuarios
│ ├── middleware/
│ │ └── auth.js # Middleware auth
│ ├── routes/
│ │ ├── authRoutes.js # Rutas auth
│ │ ├── dashboardRoutes.js # Rutas dashboard
│ │ ├── userRoutes.js # Rutas usuarios
│ │ └── index.js # Agrupador rutas
│ ├── app.js # Config Express
│ └── server.js # Punto entrada
├── prisma/
│ └── schema.prisma # Esquema BD
└── package.json
```


## 🔎 Consulta de DNI

Con `APIPERU_TOKEN` configurado puedes obtener datos públicos de un DNI:

```bash
curl http://localhost:3000/api/users/dni/12345678
```

La respuesta incluye nombres y apellidos según el padrón público de SUNAT.

## 🔎 crear credenciales del administrador docker 
type seed_admin.sql | docker exec -i legalbot-postgres psql -U postgres -d legalbot

## 🔎 crear una migracion a partir del squema actual 

npx prisma migrate dev -n "add_pago_metodo_y_tipo_servicio"
