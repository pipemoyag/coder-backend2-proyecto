# Proyecto de Autenticación Híbrida con Node.js

Este repositorio contiene un proyecto backend que implementa un sistema de autenticación híbrido con **Node.js**, **Express**, **MongoDB**, **Passport.js**, **JWT** y **OAuth GitHub**.

## Resumen del proyecto

- Registro y login local con email y contraseña.
- Autenticación JWT con accessToken y refreshToken.
- Login social con GitHub OAuth.
- Sesiones persistentes en MongoDB usando `express-session` y `connect-mongo`.
- Autorización basada en roles: `admin`, `user`, `premium`.
- Rutas protegidas por autenticación y autorización.
- Manejo centralizado de errores y validación de datos.

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/pipemoyag/coder-backend2-proyecto.git
cd codigo
```

2. Instala las dependencias:

```bash
npm install
```

3. Crea el archivo `.env` en la raíz con los valores requeridos.

Ejemplo mínimo:

```env
NODE_ENV=development
PORT=4000
DB_URI=mongodb://localhost:27017/auth_db
SECRET=mi_secret_de_sesiones
JWT_SECRET=mi_jwt_secret
JWT_REFRESH_TOKEN=mi_refresh_secret
GITHUB_CLIENT_ID=tu_github_client_id
GITHUB_CLIENT_SECRET=tu_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
```

## Ejecución

Inicia el servidor en modo desarrollo con nodemon:

```bash
npm run dev
```

El servidor arranca en `http://localhost:4000`.

## Scripts

- `npm run dev`: Inicia el servidor en modo desarrollo con recarga automática.
- `npm start`: Inicia el servidor en modo producción.

## Estructura principal

```plaintext
src/
├── config/               # Configuración de entorno y conexión a MongoDB
├── controllers/          # Lógica de negocio para usuarios
├── middlewares/          # Autenticación, autorización y manejo de errores
├── models/               # Esquemas de Mongoose
├── routes/               # Endpoints de autenticación y usuarios
├── utils/                # Helpers de JWT y bcrypt
└── index.js              # Punto de entrada del servidor
```

## Detalles técnicos y evidencias

El documento técnico completo con la implementación detallada, ejemplos de endpoints, seguridad, y capturas de Postman está disponible en `DOCUMENTO_FINAL.md`.

## Notas adicionales

- Asegúrate de tener MongoDB corriendo antes de iniciar el servidor.
- Para probar GitHub OAuth debes configurar una app en GitHub y añadir las credenciales en `.env`.
- El proyecto usa `cookie-parser`, `express-session`, `passport`, `passport-jwt` y `passport-github2`.

---

## Licencia

Consulta el archivo `LICENSE` para los detalles de la licencia MIT.
