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
npx prisma generate
npx prisma db push
```

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
