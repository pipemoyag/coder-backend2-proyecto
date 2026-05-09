import { Router } from "express";
import passport from "passport";

import { generateTokens, verifyRefreshToken } from "../utils/jwt.js";
import { comparePassword } from "../utils/auth.js";
import { validateLogin } from "../middlewares/validator.middleware.js";
import userModel from "../models/user.model.js";
import { env } from "../config/env.js";

const router = Router();

// ##### CLASE 4: PASSPORT GITHUB #####

// a authenticate le pasamos la estrategia que definimos en el passport.config
// user:email es porque passport por defecto considera un "user", y le indicamos que use el email
router.get(
  "/github",
  passport.authenticate("github", { scope: ["user:email"] }),
);

// el failureRedirect es para que, si falla, devuelva al login
router.get(
  "/github/callback",
  passport.authenticate("github", { failureRedirect: "/login" }),
  (req, res) => {
    res.redirect("/api/users/profile"); // si el login es exitoso, redirige a profile, que es una ruta protegida
    // AQUI QUEDE (20:35, me deben haber quedado como 25 min)
  },
);

// ##### LOGIN #####
router.post("/login", validateLogin, async (req, res) => {
  const { email, password } = req.body;
  try {
    // ya se validó si recibimos todos los datos con el middleware validateLogin

    const user = await userModel.findOne({ email });
    const isValidPassword = await comparePassword(password, user?.password);

    if (!user || !isValidPassword) {
      return res.status(401).json({ message: "Email o password invalidos" });
    }
    // CLASE 3: TOKENS
    const { accessToken, refreshToken } = generateTokens(user);

    // OJO: express sesion permite tener un objeto session en cada request, donde se guarda la informacion
    req.session.user = {
      id: user._id,
      email: user.email,
    };

    // CLASE 7, FLAG DE ACCESO MOBILE, DONDE SE USAN TOKENS, NO COOKIES
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
      secure: env.mode === "production", // false solo para desarrollo
      sameSite: "lax", // para evitar problemas con CORS. Alternativa 'strict' o 'none' (esta última requiere secure: true)
      maxAge: 15 * 60 * 1000, // 15 minutos, el tiempo que configuramos en jwt.js
    });

    // generamos una cookie para guardar el token de refresco, el cual vivirá por 7 días (el tiempo que configuramos en jwt.js)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: env.mode === "production", // false solo para desarrollo
      sameSite: "lax", // para evitar problemas con CORS. Alternativa 'strict' o 'none' (esta última requiere secure: true)
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ message: "Login exitoso", user: req.session.user });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error interno del servidor", error: error.message });
  }
});

// CLASE 7: REFRESH TOKEN
router.post("/refresh", async (req, res) => {
  // IMPORTANTE, refreshToken en modo mobile llegará en el body, y en modo web llegará en las cookies, por eso hacemos esta validación para obtenerlo de ambos lugares
  const token = req.cookies?.refreshToken || req.body?.refreshToken; // dependiendo de si es mobile o no, el token de refresco vendrá en cookies o en el body

  if (!token) {
    return res.status(401).json({ message: "No hay refreshToken" });
  }

  try {
    const decoded = verifyRefreshToken(token); // esta función la creamos en jwt.js, y lo que hace es verificar el token de refresco, y si es válido, devuelve el payload (que es el user)
    const user = await userModel.findById(decoded.id || decoded._id); // con el id del user que obtuvimos del token de refresco, buscamos al usuario en la base de datos

    if (!user) {
      return res.status(401).json({ message: "El usuario no existe" });
    }

    const { accessToken } = generateTokens(user);

    const isMobile = req.body.client === "mobile";

    // MODO MOBILE
    if (isMobile) {
      return res.status(200).json({ accessToken });
    }

    // MODO WEB
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: env.mode === "production", // false solo para desarrollo
      sameSite: "lax", // para evitar problemas con CORS. Alternativa 'strict' o 'none' (esta última requiere secure: true)
      maxAge: 15 * 60 * 1000, // 15 minutos, el tiempo que configuramos en jwt.js
    });

    res.status(200).json({ message: "Token de acceso renovado" });
  } catch (error) {
    res.status(403).json({ message: "Refresh token inválido o expirado" });
  }
});

router.post("/logout", async (req, res) => {
  req.session.destroy((err) => {
    if (err)
      return res.status(500).json({ message: "Error al cerrar la sesion" });
    res.clearCookie("connect.sid"); // es la que genera express-sessions
    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");
    res.status(200).json({ message: "Sesion cerrada" });
  });
});

router.post("/refresh", async (req, res) => {
  const a = 1;
  // PARA CLASE 4, AQUI VERIFICAMOS EL TOKEN DE REFRESCO, Y SI LO VALIDA (SI NO HA VENCIDO), GENERARÁ UN NUEVO
  // TOKEN PARA EL USUARIO, PARA QUE SE LO PUEDA PASAR A PROFILE Y QUE LO RECONOZCA
  // ASÍ, EL TOKEN DE ACCESO DURA POCO EN EL SERVIDOR, PERO SI DESDE EL FRONT SE CONFIGURA PARA
  // MANTENER ACTIVO AL USUARIO MEDIANTE EL TOKEN DE REFRESH, GENERANDO NUEVOS TOKEN DE ACCESO
});

export default router;
