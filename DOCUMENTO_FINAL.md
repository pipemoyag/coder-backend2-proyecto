# Sistema de Autenticación Híbrido con Node.js

## Proyecto Final - Desarrollo Backend II

### Elaborado por Felipe Moya Gallo (fmoyagallo@gmail.com)

---

## 1. PRESENTACIÓN GENERAL

Este proyecto implementa una API REST con **Node.js y Express** que integra un sistema de autenticación híbrido combinando tres mecanismos modernos:

- **Autenticación Local**: Email y contraseña con hash seguro (bcrypt)
- **Autorización JWT**: JSON Web Tokens con expiración configurable
- **Login Social**: OAuth 2.0 con GitHub mediante Passport.js
- **Sesiones Persistentes**: Express-session con MongoDB (connect-mongo)
- **Control de Acceso**: Autorización basada en roles (admin, user, premium)

### Objetivos Logrados

✓ Arquitectura modular y escalable por capas  
✓ Seguridad en múltiples niveles (bcrypt, JWT, cookies HttpOnly, CSRF protection)  
✓ Autenticación stateless con JWT  
✓ Integración de OAuth sin complejidad innecesaria  
✓ Sesiones persistentes en base de datos  
✓ Control granular de acceso por roles  
✓ Manejo centralizado de errores

---

## 2. ARQUITECTURA DEL PROYECTO

### Estructura de Carpetas

```
src/
├── config/
│   ├── db.js                    # Conexión a MongoDB
│   └── env.js                   # Variables de entorno
├── controllers/
│   └── user.controller.js       # Lógica de negocio
├── middlewares/
│   ├── auth.middleware.js       # Guardias de autenticación y autorización
│   ├── errorHandler.js          # Manejo centralizado de errores
│   ├── passport.config.js       # Configuración de estrategias Passport
│   └── validator.middleware.js  # Validación de datos
├── models/
│   └── user.model.js            # Schema de User en MongoDB
├── routes/
│   ├── auth.routes.js           # Rutas de autenticación (registro, login, logout)
│   └── user.routes.js           # Rutas de usuarios protegidas
├── utils/
│   ├── auth.js                  # Funciones de hash con bcrypt
│   └── jwt.js                   # Generación y verificación de JWT
└── index.js                     # Punto de entrada de la aplicación
```

### Justificación Técnica

| Carpeta          | Razón                                    |
| ---------------- | ---------------------------------------- |
| **config/**      | Centraliza configuración y conexión a BD |
| **controllers/** | Separa lógica de negocio de rutas        |
| **middlewares/** | Encapsula seguridad reutilizable         |
| **models/**      | Define esquemas de datos                 |
| **routes/**      | Desacopla endpoints de controladores     |
| **utils/**       | Agrupa helpers reutilizables             |

Esta estructura facilita **mantenibilidad, escalabilidad, testing y lectura** del código.

---

## 3. IMPLEMENTACIÓN TÉCNICA

### 3.1 MODELO DE USUARIO

**Archivo:** `src/models/user.model.js`

```javascript
import { Schema, model } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, unique: true },
  password: { type: String },
  role: {
    type: String,
    enum: ["admin", "user", "premium"],
    default: "user",
  },
});

export default model("User", UserSchema);
```

**Características:**

- Email único (índice en BD)
- Contraseña almacenada (hashizada en registro)
- Rol por defecto: "user"
- Asignación de roles: `admin@mail.com` → admin, `premium@mail.com` → premium

---

### 3.2 REGISTRO LOCAL

**Endpoint:** `POST /api/auth/github/callback` (manejado por Passport Local)

**Estrategia en:** `src/middlewares/passport.config.js`

```javascript
passport.use(
  "register",
  new LocalStrategy(
    {
      usernameField: "email",
      passReqToCallback: true,
    },
    async (req, email, password, done) => {
      try {
        let userRole = "user";
        if (email === "admin@mail.com") userRole = "admin";
        if (email === "premium@mail.com") userRole = "premium";

        const user = await userModel.findOne({ email });
        if (user) {
          return done(null, false, { message: "El usuario ya existe" });
        }

        const passHash = await hashPassword(password);
        const newUser = await userModel.create({
          email,
          password: passHash,
          role: userRole,
        });
        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
    },
  ),
);
```

**Hash de Contraseña en:** `src/utils/auth.js`

```javascript
import bcrypt from "bcrypt";

export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};
```

**Guard de Registro en:** `src/middlewares/auth.middleware.js`

```javascript
export const registerGuard = (req, res, next) => {
  passport.authenticate("register", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      console.warn(
        `[LOGGER DE SEGURIDAD] Falló el registro, Razón: ${info?.message}`,
      );
      return res
        .status(400)
        .json({ message: info?.message || "Error al registrar" });
    }
    req.user = user;
    next();
  })(req, res, next);
};
```

**Ejemplo de Request:**

```json
POST /api/users HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Ejemplo de Response (201 Created):**

```json
{
  "message": "Usuario creado",
  "payload": {
    "_id": "6756f8a1c2e4b5d9f1234567",
    "email": "user@example.com",
    "role": "user"
  }
}
```

**Motivos Técnicos:**

- **bcrypt con salt=10**: Hashing adaptativo que resiste ataques de fuerza bruta
- **Validación de duplicados**: Previene múltiples cuentas con mismo email
- **Rol asignado en registro**: Centraliza lógica de roles, facilita auditoría

---

### 3.3 LOGIN LOCAL + JWT

**Endpoint:** `POST /api/auth/login`

**Código en:** `src/routes/auth.routes.js`

```javascript
router.post("/login", validateLogin, async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await userModel.findOne({ email });
    const isValidPassword = await comparePassword(password, user?.password);

    if (!user || !isValidPassword) {
      return res.status(401).json({ message: "Email o password invalidos" });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    req.session.user = {
      id: user._id,
      email: user.email,
    };

    const isMobile = req.body.client === "mobile";
    if (isMobile) {
      return res.status(200).json({
        message: "Login exitoso (Mobile)",
        accessToken,
        refreshToken,
        user: req.session.user,
      });
    }

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: env.mode === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.mode === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login exitoso", user: req.session.user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
});
```

**Generación de JWT en:** `src/utils/jwt.js`

```javascript
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const { jwt_secret, jwt_refresh_token } = env;

export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    jwt_secret,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign({ id: user._id }, jwt_refresh_token, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => jwt.verify(token, jwt_secret);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, jwt_refresh_token);
```

**Ejemplo de Request:**

```json
POST /api/auth/login HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Ejemplo de Response (200 OK):**

```json
{
  "message": "Login exitoso",
  "user": {
    "id": "6756f8a1c2e4b5d9f1234567",
    "email": "user@example.com"
  }
}
```

**Headers de Respuesta (Cookie):**

```
Set-Cookie: accessToken=eyJhbGc...; Path=/; HttpOnly; SameSite=Lax; Max-Age=900
Set-Cookie: refreshToken=eyJhbGc...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800
```

**Estructura del JWT Decodificado (accessToken):**

```json
{
  "id": "6756f8a1c2e4b5d9f1234567",
  "email": "user@example.com",
  "iat": 1733600000,
  "exp": 1733600900
}
```

**Motivos Técnicos:**

- **JWT Stateless**: Escalable horizontalmente sin sesión centralizada
- **Expiración 15 min**: Balance entre seguridad y UX
- **Refresh Token 7d**: Permite renovación sin re-login
- **Cookie HttpOnly**: Previene robo vía XSS
- **SameSite=Lax**: Protege contra CSRF en navegadores modernos
- **Secure en producción**: Fuerza HTTPS

---

### 3.4 REFRESH TOKEN

**Endpoint:** `POST /api/auth/refresh`

```javascript
router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No hay refreshToken" });
  }

  try {
    const decoded = verifyRefreshToken(token);
    const user = await userModel.findById(decoded.id || decoded._id);

    if (!user) {
      return res.status(401).json({ message: "El usuario no existe" });
    }

    const { accessToken } = generateTokens(user);

    const isMobile = req.body.client === "mobile";

    if (isMobile) {
      return res.status(200).json({ accessToken });
    }

    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: env.mode === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.status(200).json({ message: "Token de acceso renovado" });
  } catch (error) {
    res.status(403).json({ message: "Refresh token inválido o expirado" });
  }
});
```

---

### 3.5 LOGIN OAUTH (GITHUB)

**Endpoints:**

- `GET /api/auth/github` - Redirige a GitHub
- `GET /api/auth/github/callback` - Callback tras autenticación

**Configuración en:** `src/middlewares/passport.config.js`

```javascript
import { Strategy as GithubStrategy } from "passport-github2";

const { client_id, secret_id, callback_url } = env.github;

passport.use(
  "github",
  new GithubStrategy(
    {
      clientID: client_id,
      clientSecret: secret_id,
      callbackURL: callback_url,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile._json.email || `${profile.username}@github.com`;
        let user = await userModel.find({ email });
        if (!user) {
          user = await userModel.create({
            email,
            password: "oauth_github_user",
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);
```

**Serialización de Sesión:**

```javascript
passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id).select("-password");
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
```

**Rutas en:** `src/routes/auth.routes.js`

```javascript
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);

router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/api/users/profile");
  },
);
```

**Flujo:**

1. Usuario clickea "Login with GitHub"
2. Redirige a `GET /api/auth/github`
3. GitHub redirige a `GET /api/auth/github/callback`
4. Passport verifica profile y crea/actualiza usuario
5. Se crea sesión en req.user
6. Redirige a `/api/users/profile`

**Beneficio Técnico:**
Passport permite agregar fácilmente Google, Discord, Facebook sin cambiar lógica central.

---

### 3.6 SISTEMA DE SESIONES

**Configuración en:** `src/index.js`

```javascript
import session from "express-session";
import MongoStore from "connect-mongo";

app.use(
  session({
    store: MongoStore.create({
      mongoUrl: env.db_uri,
      ttl: 60000, // 60 segundos
    }),
    secret: env.secret,
    resave: false,
    saveUninitialized: false,
  }),
);
```

**Documento de Sesión en MongoDB (Colección: `sessions`):**

```json
{
  "_id": "abcd1234efgh5678",
  "session": {
    "cookie": {
      "originalMaxAge": 60000,
      "expires": "2026-05-09T15:30:45.123Z",
      "httpOnly": true,
      "path": "/",
      "sameSite": "lax"
    },
    "user": {
      "id": "6756f8a1c2e4b5d9f1234567",
      "email": "user@example.com"
    }
  },
  "expires": ISODate("2026-05-09T15:31:00.000Z")
}
```

**Endpoint de Consulta:** `GET /api/users/session`

**Código en:** `src/routes/user.routes.js`

```javascript
router.get("/session", passportAuthGuard, (req, res) => {
  res.status(200).json({
    message: "Sesión actual",
    session: req.session,
    user: req.user,
  });
});
```

**Ejemplo de Request:**

```json
GET /api/users/session HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGc...
Cookie: connect.sid=abc123def456
```

**Ejemplo de Response (200 OK):**

```json
{
  "message": "Sesión actual",
  "session": {
    "cookie": {
      "originalMaxAge": 60000,
      "expires": "2026-05-09T15:30:45.123Z"
    },
    "user": {
      "id": "6756f8a1c2e4b5d9f1234567",
      "email": "user@example.com"
    }
  },
  "user": {
    "_id": "6756f8a1c2e4b5d9f1234567",
    "email": "user@example.com",
    "role": "user"
  }
}
```

**Motivos Técnicos:**

- **TTL 60s en store**: Limpia sesiones expiradas automáticamente
- **resave: false**: No reescribe si no cambió
- **saveUninitialized: false**: Solo crea sesión si hay autenticación
- **MongoDB Store**: Persiste sesiones entre reinicios

---

### 3.7 RUTAS PROTEGIDAS

#### 3.7.1 Ruta GET /api/users/profile (protegida por JWT + Rol "user")

**Configuración en:** `src/routes/user.routes.js`

```javascript
const requireAll = [passportAuthGuard, authorizeRoles(["user", "premium"])];

router.get("/profile", requireAll, getProfile);
```

**Guard de Autenticación en:** `src/middlewares/auth.middleware.js`

```javascript
export const passportAuthGuard = (req, res, next) => {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      const reason = info ? info.name || info.message : "Falta token";
      console.warn(
        `[LOGGER DE SEGURIDAD] Falló la autenticación, Razón: ${reason}`,
      );

      if (reason === "TokenExpiredError") {
        return res.status(401).json({
          message: "Tu sesión ha expirado, inicia sesión nuevamente",
          detail_error: reason,
        });
      }
      return res.status(401).json({
        message: "No estás autenticado, inicia sesión o proporciona un token",
        detail_error: reason,
      });
    }
    req.user = user;
    next();
  })(req, res, next);
};
```

**Guard de Autorización en:** `src/middlewares/auth.middleware.js`

```javascript
export const authorizeRoles = (roles) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: "Debes iniciar sesion primero" });

    if (req.user.role === "admin" || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ message: "No tienes permisos para acceder" });
  };
};
```

**Controlador en:** `src/controllers/user.controller.js`

```javascript
export const getProfile = async (req, res) => {
  res.status(200).json({ message: "Perfil del usuario", payload: req.user });
};
```

**Ejemplo de Request:**

```json
GET /api/users/profile HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NTZmOGExYzJlNGI1ZDlmMTIzNDU2NyIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsImlhdCI6MTczMzYwMDAwMCwiZXhwIjoxNzMzNjAwOTAwfQ.xX...
Cookie: connect.sid=abc123def456
```

**Ejemplo de Response (200 OK):**

```json
{
  "message": "Perfil del usuario",
  "payload": {
    "_id": "6756f8a1c2e4b5d9f1234567",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### 3.7.2 Ruta GET /api/users (protegida por rol "admin")

```javascript
const requireAdmin = [passportAuthGuard, authorizeRoles([])];

router.get("/", requireAdmin, getAll);
```

**Nota:** `authorizeRoles([])` significa roles vacío, solo admin accede.

#### 3.7.3 Ruta GET /api/users/premium-content (protegida por rol "premium")

```javascript
const requirePremium = [passportAuthGuard, authorizeRoles(["premium"])];

router.get("/premium-content", requirePremium, getPremiumContent);
```

#### 3.7.4 Error sin Token (401 Unauthorized)

**Ejemplo de Request:**

```json
GET /api/users/profile HTTP/1.1
Host: localhost:4000
```

**Ejemplo de Response (401):**

```json
{
  "message": "No estás autenticado, inicia sesión o proporciona un token",
  "detail_error": "Falta token"
}
```

#### 3.7.5 Error sin Permisos (403 Forbidden)

**Ejemplo:** Usuario con rol "user" intenta acceder a `GET /api/users/`

**Ejemplo de Response (403):**

```json
{
  "message": "No tienes permisos para acceder"
}
```

---

### 3.8 LOGOUT

**Endpoint:** `POST /api/auth/logout`

**Código en:** `src/routes/auth.routes.js`

```javascript
router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err)
      return res.status(500).json({ message: "Error al cerrar la sesion" });
    res.clearCookie("connect.sid");
    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    res.status(200).json({ message: "Sesion cerrada" });
  });
});
```

**Flujo:**

1. Destruye la sesión en MongoDB
2. Limpia todas las cookies del cliente
3. Token JWT no se puede revocar (stateless), pero cliente la elimina

**Ejemplo de Request:**

```json
POST /api/auth/logout HTTP/1.1
Host: localhost:4000
Authorization: Bearer eyJhbGc...
Cookie: connect.sid=abc123
```

**Ejemplo de Response (200 OK):**

```json
{
  "message": "Sesion cerrada"
}
```

**Headers de Respuesta:**

```
Set-Cookie: connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: accessToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: refreshToken=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

---

## 4. DIAGRAMA DE FLUJO DE AUTENTICACIÓN

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLUJO DE AUTENTICACIÓN HÍBRIDA                       │
└─────────────────────────────────────────────────────────────────────────┘

                              RAMA LOCAL

    ┌──────────────────────────────────────────┐
    │ 1. Usuario completa formulario            │
    │    Email: user@example.com                │
    │    Password: SecurePass123                │
    └────────────────┬─────────────────────────┘
                     │
                     ▼
    ┌──────────────────────────────────────────┐
    │ 2. POST /api/users (registerGuard)        │
    │    Passport Local Strategy valida         │
    └────────────────┬─────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ ¿Email ya existe?                         │
    └────┬──────────────────────────────────┬──┘
         │ SÍ                              │ NO
         ▼                                  ▼
    ERROR 400              3. Hash password con bcrypt(10)
                           4. Crear usuario en MongoDB
                           5. Response: User creado

    ┌─────────────────────────────────────────────────┐
    │ 6. POST /api/auth/login (validateLogin)          │
    │    Recibe: email, password                       │
    └────────────────┬────────────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 7. comparePassword(password, hash)        │
    │    bcrypt.compare() valida               │
    └────┬──────────────────────────────────┬──┘
         │ Válido                           │ Inválido
         ▼                                   ▼
    8. generateTokens():                 ERROR 401
       - accessToken (15 min)
       - refreshToken (7 días)
    9. Crear req.session.user
    10. Enviar tokens en cookies HttpOnly

    ┌──────────────────────────────────────────┐
    │ 11. Response: Login exitoso              │
    │     + Set-Cookie: accessToken            │
    │     + Set-Cookie: refreshToken           │
    └──────────────────────────────────────────┘

                          RAMA OAUTH GITHUB

    ┌──────────────────────────────────────────┐
    │ 1. Usuario clickea "Login with GitHub"   │
    └────────────────┬─────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 2. GET /api/auth/github                  │
    │    Redirige a github.com/login/oauth     │
    └──────────────────────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 3. Usuario autoriza acceso               │
    │    GitHub genera code                    │
    └──────────────────────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 4. GitHub redirige a callback URL        │
    │    GET /api/auth/github/callback?code=X  │
    └────────────────┬─────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 5. Passport intercambia code por token   │
    │    Obtiene profile de GitHub             │
    └────────────────┬─────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 6. Buscar usuario por email              │
    └────┬──────────────────────────────────┬──┘
         │ Existe                           │ No existe
         ▼                                   ▼
    7. Recuperar              7. Crear usuario nuevo
       usuario existente          password: "oauth_github_user"

    ┌──────────────────────────────────────────┐
    │ 8. Crear sesión: passport.serializeUser  │
    │    Guardar user._id en sessionStore      │
    └──────────────────────────────────────────┘
                     │
    ┌────────────────▼─────────────────────────┐
    │ 9. Redirect /api/users/profile           │
    │    req.user ahora tiene datos del GitHub │
    └──────────────────────────────────────────┘

                      RUTAS PROTEGIDAS

    ┌──────────────────────────────────────────────┐
    │ Usuario intenta acceder GET /api/users/profile
    └────────────────┬─────────────────────────────┘
                     │
    ┌────────────────▼──────────────────────────────┐
    │ Middleware: passportAuthGuard                 │
    │ ¿req.isAuthenticated() = true?               │
    └────┬───────────────────────────────────────┬──┘
         │ SÍ                                    │ NO
         ▼                                        ▼
    next()                                 Extraer token de:
                                           - Header Authorization Bearer
                                           - Cookie accessToken

    ┌────────────────────────────────────┐
    │ jwt.verify(token, JWT_SECRET)      │
    └────┬───────────────────────────┬───┘
         │ Válido                    │ Expirado/Inválido
         ▼                            ▼
    req.user = decoded       Response 401 (Token Expired)

    ┌────────────────────────────────────┐
    │ Middleware: authorizeRoles([roles])│
    └────┬───────────────────────────┬───┘
         │ Rol permitido              │ Rol no permitido
         ▼                            ▼
    next()                     Response 403 (Forbidden)

    ┌────────────────────────────────────┐
    │ Controlador: getProfile()           │
    │ Response 200: Perfil del usuario   │
    └────────────────────────────────────┘

                        REFRESH TOKEN

    ┌──────────────────────────────────────────────┐
    │ accessToken expirado, usuario tiene          │
    │ refreshToken en cookie                       │
    └────────────────┬─────────────────────────────┘
                     │
    ┌────────────────▼──────────────────────────────┐
    │ POST /api/auth/refresh                       │
    │ Envía refreshToken (cookie o body)           │
    └────────────────┬─────────────────────────────┘
                     │
    ┌────────────────▼──────────────────────────────┐
    │ jwt.verify(refreshToken, REFRESH_SECRET)     │
    └────┬───────────────────────────────────────┬──┘
         │ Válido                                │ Inválido
         ▼                                        ▼
    Buscar usuario en BD            Response 403 (Invalid)
    generateTokens() nuevamente

    ┌────────────────────────────────────┐
    │ Response 200 + Set-Cookie (nuevo)  │
    │ accessToken ahora válido 15 min    │
    └────────────────────────────────────┘
```

---

## 5. SEGURIDAD Y DECISIONES ARQUITECTÓNICAS

### 5.1 ¿Dónde vive el rol y por qué?

**Respuesta:** El rol vive en el **documento User en MongoDB**.

```javascript
// En Schema
role: { type: String, enum: ["admin", "user", "premium"], default: "user" }
```

**Justificación:**

1. **Persistencia**: Se mantiene incluso si el token expira
2. **Autoridad de verdad (Single Source of Truth)**: La base de datos es la fuente definitiva
3. **Auditoría**: Se registran cambios de rol en BD
4. **Escalabilidad**: Permite cambios de rol sin afectar tokens emitidos
5. **Flexibilidad**: Roles dinámicos sin cambiar lógica backend

**¿Qué ocurre si el rol cambia con un token ya emitido?**

El token ya emitido sigue siendo válido (es una decisión de diseño). Las opciones eran:

**Opción 1 (Actual - Implementada):**

- Token contiene email, no rol
- En cada request se busca el usuario en BD
- Si cambió rol, se valida con el nuevo rol
- ✓ Roles actualizados en tiempo real
- ✗ Mayor carga en BD (buscar usuario en cada request)

**Opción 2 (Alternativa no implementada):**

- Token contiene role
- No se busca en cada request
- ✓ Mejor performance
- ✗ Cambios de rol requieren re-login
- ✗ Inconsistencia temporal

Se eligió Opción 1 porque la seguridad es crítica en autenticación.

### 5.2 ¿Cómo mitigó CSRF?

**CSRF (Cross-Site Request Forgery):** Ataque donde un sitio malicioso intenta hacer requests a tu API usando credenciales del usuario.

**Mitigaciones implementadas:**

1. **SameSite=Lax en cookies**

   ```javascript
   res.cookie("accessToken", accessToken, {
     sameSite: "lax", // No envía cookie en requests cross-origin POST
   });
   ```

   - `Lax`: Envía cookie solo en navegación top-level, no en requests POST/FETCH desde otro origen
   - Previene ataques de formularios maliciosos

2. **HttpOnly en cookies**

   ```javascript
   res.cookie("accessToken", accessToken, {
     httpOnly: true, // JavaScript no puede acceder
   });
   ```

   - Protege contra XSS que intente usar `document.cookie`
   - Aunque XSS es otro ataque, esta medida lo dificulta

3. **JWT en Authorization Header (alternativa)**

   ```javascript
   // Cliente puede enviar en header en lugar de cookie
   Authorization: Bearer eyJhbGc...
   ```

   - FETCH/AXIOS envían headers custom solo en CORS permitido
   - Formularios HTML no pueden enviar headers custom

4. **Validación en backend**
   ```javascript
   router.post("/logout", (req, res) => {
     req.session.destroy(); // Invalida sesión
   });
   ```

   - Logout requiere acción explícita

### 5.3 ¿Cómo diferencia entorno local y producción?

**Archivo:** `src/config/env.js`

```javascript
const environment = process.env.NODE_ENV || "development";

dotenv.config({
  path: environment === "production" ? ".env.production" : ".env",
});

export const env = {
  mode: environment,
  // ...
};
```

**Diferenciación en código:**

```javascript
// 1. Cookie secure (HTTPS obligatorio)
res.cookie("accessToken", accessToken, {
  secure: env.mode === "production", // true en prod, false en dev
});

// 2. En desarrollo: HTTP funciona
// En producción: solo HTTPS
```

**Archivo `.env` (desarrollo):**

```
NODE_ENV=development
PORT=4000
DB_URI=mongodb://localhost:27017/auth_db
JWT_SECRET=dev_secret_123
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
```

**Archivo `.env.production` (producción):**

```
NODE_ENV=production
PORT=3000
DB_URI=mongodb+srv://user:pass@cluster.mongodb.net/auth_db
JWT_SECRET=[SECRET_FUERTE_ALEATORIO]
GITHUB_CALLBACK_URL=https://api.example.com/api/auth/github/callback
```

### 5.4 ¿Por qué eligió cookie + JWT y no solo uno?

**Análisis de opciones:**

| Característica      | Solo Cookie | Solo JWT | Cookie + JWT (Actual) |
| ------------------- | ----------- | -------- | --------------------- |
| Stateless           | ✗           | ✓        | ✓                     |
| HttpOnly disponible | ✓           | ✗        | ✓                     |
| Resiste XSS         | ✓           | ✗        | ✓                     |
| Mobile-friendly     | ✗           | ✓        | ✓                     |
| CORS simple         | ✗           | ✓        | ✓                     |
| Escalable           | ✗           | ✓        | ✓                     |

**Decisión: Cookie + JWT**

- **Cookies**: Para clientes web (navegador) - seguridad máxima
- **JWT en body**: Para clientes mobile - control manual

**Implementación:**

```javascript
// Línea 44 en auth.routes.js
const isMobile = req.body.client === "mobile";
if (isMobile) {
  return res.status(200).json({
    message: "Login exitoso (Mobile)",
    accessToken, // Cliente lo almacena (localStorage/sessionStorage)
    refreshToken,
  });
}

// Para web: envía en cookies
res.cookie("accessToken", accessToken, { httpOnly: true });
```

### 5.5 Protección en capas (Defense in Depth)

```
Nivel 1: HTTPS (Transporte)
         ↓ (Encriptación en tránsito)

Nivel 2: Cookie HttpOnly + SameSite (Navegador)
         ↓ (Previene XSS y CSRF)

Nivel 3: JWT Firmado (Payload)
         ↓ (Imposible manipular sin clave secreta)

Nivel 4: Expiración de token (Tiempo)
         ↓ (Limita ventana de oportunidad)

Nivel 5: Validación de rol en BD (Autorización)
         ↓ (Valida rol actual, no el del token)

Nivel 6: Middleware centralizado (Reutilizable)
         ↓ (Evita duplicar lógica)

Nivel 7: Logging de seguridad (Auditoría)
         [LOGGER DE SEGURIDAD] eventos registrados
```

---

## 6. EVIDENCIA DE FUNCIONAMIENTO

### ⚠️ INSTRUCCIONES PARA CAPTURAS

Este documento requiere que captures en **Postman** las siguientes operaciones.  
Cada captura debe mostrar claramente:

- **URL** completa
- **Método HTTP**
- **Headers** (incluyendo Cookie y Authorization)
- **Body** (para requests POST/PUT)
- **Status code**
- **Response JSON**

---

### 6.1 CAPTURA 1: Registro Exitoso

**Acción:** Registrar nuevo usuario

```
POST /api/users HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass123"
}
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman mostrando Status 201
- [ ] Response JSON con usuario creado
- [ ] Campo role: "user"

**Resultado esperado:** 201 Created

---

### 6.2 CAPTURA 2: Login Exitoso (Web)

**Acción:** Login con credenciales válidas

```
POST /api/auth/login HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePass123"
}
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman mostrando Status 200
- [ ] Tab "Cookies" mostrando `accessToken` con HttpOnly activado
- [ ] Tab "Cookies" mostrando `refreshToken` con HttpOnly activado
- [ ] Response JSON con user

**Resultado esperado:** 200 OK + Cookies Set-Cookie

---

### 6.3 CAPTURA 3: Token JWT Real y Decodificado

**Acción:** Copiar el accessToken de la captura anterior y decodificarlo

**Ir a:** https://jwt.io/

**Insertar captura aquí:**

- [ ] Screenshot de jwt.io mostrando:
  - Header: `{"alg": "HS256", "typ": "JWT"}`
  - Payload: `{"id": "...", "email": "...", "iat": ..., "exp": ...}`
  - Signature: válida (verde)

---

### 6.4 CAPTURA 4: Ruta Protegida - Acceso Exitoso

**Acción:** GET /api/users/profile con token válido

```
GET /api/users/profile HTTP/1.1
Host: localhost:4000
Authorization: Bearer [COPIAR_ACCESS_TOKEN_AQUI]
Cookie: connect.sid=...
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 200
- [ ] Response JSON con perfil del usuario
- [ ] Mostrar Authorization header con Bearer token

**Resultado esperado:** 200 OK

---

### 6.5 CAPTURA 5: Error 401 - Sin Token

**Acción:** GET /api/users/profile SIN token

```
GET /api/users/profile HTTP/1.1
Host: localhost:4000
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 401
- [ ] Response JSON con mensaje "No estás autenticado..."

**Resultado esperado:** 401 Unauthorized

---

### 6.6 CAPTURA 6: Error 403 - Sin Autorización

**Acción:** Usuario "user" intenta acceder a GET /api/users/ (solo admin)

```
GET /api/users/ HTTP/1.1
Host: localhost:4000
Authorization: Bearer [TOKEN_DE_USER_REGULAR]
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 403
- [ ] Response JSON: "No tienes permisos para acceder"

**Resultado esperado:** 403 Forbidden

---

### 6.7 CAPTURA 7: Consulta de Sesión

**Acción:** GET /api/users/session

```
GET /api/users/session HTTP/1.1
Host: localhost:4000
Authorization: Bearer [TOKEN]
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 200
- [ ] Response JSON mostrando:
  - `session.user` (id y email)
  - `user` (objeto completo con rol)

**Resultado esperado:** 200 OK

---

### 6.8 CAPTURA 8: Logout Exitoso

**Acción:** POST /api/auth/logout

```
POST /api/auth/logout HTTP/1.1
Host: localhost:4000
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 200
- [ ] Response: "Sesión cerrada"
- [ ] Tab "Cookies" mostrando cookies eliminadas (Expires: Thu, 01 Jan 1970)

**Resultado esperado:** 200 OK + Cookies cleared

---

### 6.9 CAPTURA 9: Refresh Token

**Acción:** Renovar accessToken usando refreshToken

```
POST /api/auth/refresh HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{}
```

**Insertar captura aquí:**

- [ ] Screenshot de Postman Status 200
- [ ] Response: "Token de acceso renovado"
- [ ] Cookie accessToken actualizada

**Resultado esperado:** 200 OK + Nuevo accessToken

---

### 6.10 CAPTURA 10: Login GitHub OAuth (Opcional)

**Acción:** Flujo OAuth GitHub

**Insertar captura aquí:**

- [ ] Screenshot del navegador en `GET /api/auth/github`
- [ ] Screenshot de permisos de GitHub
- [ ] Screenshot de redirección exitosa a `/api/users/profile`

**Resultado esperado:** Usuario autenticado sin password

---

## 7. INSTRUCCIONES DE INSTALACIÓN

### 7.1 Requisitos Previos

- **Node.js**: v18+ (https://nodejs.org/)
- **MongoDB**: Local o MongoDB Atlas (https://www.mongodb.com/cloud/atlas)
- **Git**: Para clonar el repo
- **Postman**: Para probar API (https://www.postman.com/)

### 7.2 Pasos de Instalación

#### 1. Clonar el repositorio

```bash
git clone https://github.com/pipemoyag/coder-backend2-proyecto.git
cd codigo
```

#### 2. Instalar dependencias

```bash
npm install
```

#### 3. Configurar variables de entorno

**Crear archivo `.env` en la raíz:**

```bash
cp .env.example .env
```

**Editar `.env` con tus valores:**

```env
# SERVIDOR
PORT=4000
NODE_ENV=development

# BASE DE DATOS - Local
DB_URI=mongodb://localhost:27017/auth_db

# BASE DE DATOS - MongoDB Atlas (alternativa)
# DB_URI=mongodb+srv://username:password@cluster.mongodb.net/auth_db?retryWrites=true&w=majority

# SEGURIDAD
SECRET=tu_session_secret_super_seguro_aleatorio_12345
JWT_SECRET=tu_jwt_secret_super_seguro_aleatorio_67890
JWT_REFRESH_TOKEN=tu_refresh_secret_super_seguro_aleatorio_13579

# OAUTH GITHUB
GITHUB_CLIENT_ID=tu_github_app_client_id
GITHUB_CLIENT_SECRET=tu_github_app_client_secret
GITHUB_CALLBACK_URL=http://localhost:4000/api/auth/github/callback
```

#### 4. Configurar GitHub OAuth (opcional)

**Si quieres probar login GitHub:**

1. Ir a https://github.com/settings/developers
2. Click "New OAuth App"
3. Completar:
   - **Application name**: Mi Proyecto Auth
   - **Homepage URL**: http://localhost:4000
   - **Authorization callback URL**: http://localhost:4000/api/auth/github/callback
4. Copiar `Client ID` y `Client Secret` a `.env`

#### 5. Verificar conexión a MongoDB

**Opción A: Local**

```bash
# En otra terminal
mongod
```

**Opción B: MongoDB Atlas**

- Crear cuenta en https://www.mongodb.com/cloud/atlas
- Crear cluster gratuito
- Obtener connection string
- Pegar en `.env` como `DB_URI`

#### 6. Ejecutar en desarrollo

```bash
npm run dev
```

**Salida esperada:**

```
Server on port http://localhost:4000
Conexion establecida
```

#### 7. Probar API

**Abrir Postman e importar ejemplos:**

```json
POST http://localhost:4000/api/users
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test123!"
}
```

### 7.3 Estructura de Carpetas Generada

```
.
├── .env                    ← Variables de entorno (NO commitear)
├── .env.example            ← Plantilla de .env (commitear)
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── sessions/               ← Sesiones de archivo (dev)
├── src/
│   ├── config/
│   │   ├── db.js
│   │   └── env.js
│   ├── controllers/
│   │   └── user.controller.js
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── errorHandler.js
│   │   ├── passport.config.js
│   │   └── validator.middleware.js
│   ├── models/
│   │   └── user.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   └── user.routes.js
│   ├── utils/
│   │   ├── auth.js
│   │   └── jwt.js
│   └── index.js
└── [Tu código funcional]
```

### 7.4 Variables de Entorno Explicadas

| Variable               | Descripción                      | Ejemplo                                          |
| ---------------------- | -------------------------------- | ------------------------------------------------ |
| `PORT`                 | Puerto donde corre el servidor   | `4000`                                           |
| `NODE_ENV`             | Entorno (development/production) | `development`                                    |
| `DB_URI`               | String de conexión a MongoDB     | `mongodb://localhost:27017/auth_db`              |
| `SECRET`               | Clave para sesiones              | Aleatorio fuerte (32+ caracteres)                |
| `JWT_SECRET`           | Clave para firmar JWT            | Aleatorio fuerte (32+ caracteres)                |
| `JWT_REFRESH_TOKEN`    | Clave para firmar refresh tokens | Aleatorio fuerte (32+ caracteres)                |
| `GITHUB_CLIENT_ID`     | ID de app OAuth de GitHub        | `abc123def456`                                   |
| `GITHUB_CLIENT_SECRET` | Secret de app OAuth de GitHub    | `xyz789uvw012`                                   |
| `GITHUB_CALLBACK_URL`  | URL de callback en GitHub        | `http://localhost:4000/api/auth/github/callback` |

### 7.5 Troubleshooting

**Error: "Conexión rechazada en MongoDB"**

```bash
# Verifica que MongoDB esté corriendo
mongod

# O usa MongoDB Atlas en .env
DB_URI=mongodb+srv://user:pass@cluster.mongodb.net/auth_db
```

**Error: "JWT no válido"**

- Asegúrate de que `JWT_SECRET` sea el mismo en `.env` y no cambies entre requests

**Error: "Usuario ya existe"**

- La validación de email duplicado es correcta
- Usa otro email o elimina la BD y reinicia

**Puerto ya en uso**

```bash
# Cambiar puerto en .env
PORT=5000
```

---

## 8. CONCLUSIÓN

### Logros Técnicos

✓ **Sistema de autenticación modular** con separación clara de capas  
✓ **Seguridad multicapa** (bcrypt, JWT, cookies HttpOnly, CSRF, expiración)  
✓ **Autenticación stateless** escalable horizontalmente  
✓ **Integración OAuth** extensible a otros proveedores  
✓ **Sesiones persistentes** en MongoDB  
✓ **Autorización granular** por roles  
✓ **Código limpio** sin repeticiones  
✓ **Documentación técnica completa**

### Decisiones Arquitectónicas Clave

1. **Roles en BD, no en token**: Cambios en tiempo real sin logout
2. **Cookies HttpOnly + JWT en body**: Seguridad web + flexibilidad mobile
3. **SameSite=Lax**: Protección CSRF nativa en navegadores modernos
4. **Middleware centralizado**: Reutilizable, mantenible, auditable
5. **MongoDB para sesiones**: Persisten entre reinicios del servidor

### Alineación con Estándares

- RFC 7519 (JWT)
- RFC 6265 (Cookies)
- RFC 6749 (OAuth 2.0)
- OWASP Top 10 Security

---

## ANEXO: EJEMPLOS ADICIONALES

### Crear usuario admin de prueba

```bash
# En MongoDB
db.users.insertOne({
  email: "admin@mail.com",
  password: "$2b$10$...", // Hash bcrypt
  role: "admin"
})
```

### Ver documentos de sesión en MongoDB

```bash
# En MongoDB shell
use auth_db
db.sessions.find()
```

### Decodificar JWT sin jwt.io

```bash
# En Node.js
const jwt = require('jsonwebtoken');
const token = 'eyJhbGc...';
console.log(jwt.decode(token));
```

---

**Fecha de entrega:** 28/05/2026 – 20:00 hs  
**Formato:** Google Docs  
**Versión:** 1.0  
**Autor:** [Tu nombre]
