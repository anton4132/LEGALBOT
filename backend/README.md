
## 📝 Contenido

- [Requisitos](#requisitos)  
- [Instalación](#instalación)  
- [Configuración](#configuración)  
- [Prisma: introspección & generación](#prisma-introspección--generación)  
- [Arrancar el servidor](#arrancar-el-servidor)  
- [Endpoints de ejemplo](#endpoints-de-ejemplo)  

---

## ⚙️ Requisitos

- **Node.js** v16 o superior + **npm** (se instala con Node)  
- **PostgreSQL** (tu base de datos ya debe existir)  

---

## 🚀 Instalación

1. Clona el repositorio y entra a la carpeta `backend`:
    ```bash
    git clone <url-del-repo>
    cd backend
    ```

2. Instala las dependencias:
    ```bash
    npm install
    ```

---

## 🔧 Configuración

1. Duplica el archivo de ejemplo de variables de entorno:
    ```bash
    cp .env.example .env
    ```
2. Abre `.env` y reemplaza la URL de conexión con tus datos:
    ```env
    DATABASE_URL="postgresql://usuario:clave@localhost:5432/mi_basededatos"
    ```

---

## 🛠️ Prisma: introspección & generación

> Si tu BD ya existe

1. **Introspección** (lee tablas y relaciones de tu BD):
    ```bash
    npx prisma db pull
    ```
2. **Genera** el cliente de Prisma:
    ```bash
    npx prisma generate
    ```

---

## ▶️ Arrancar el servidor

- **Modo desarrollo** (con recarga automática):
  ```bash
  npm run dev