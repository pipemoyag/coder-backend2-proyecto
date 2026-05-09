// import { verifyAccessToken } from "../utils/jwt.js";

// // ESTE MIDDLEWARE QUEDÓ OBSOLETO YA QUE PASAMOS A PASSPORT, QUEDA COMO EJEMPLO
// export const isAuth = (req, res, next) => {
//   const authHeaders = req.headers.authorization;
//   if (!authHeaders)
//     return res.status(401).json({ message: "No estas autenticado" });

//   const token = authHeaders.split(" ")[1]; // "Beaer" + " " + "Token", por eso usamos split y tomamos el segundo item, que es el Token

//   try {
//     const decoded = verifyAccessToken(token); // decoded es nombre por convencion, y verify devuelve el usuario
//     req.user = decoded;
//     next();
//   } catch (error) {
//     res.status(403).json({ message: "Token invalido o corrupto" });
//   }
// };

import passport from "passport";

// CLASE 6
//   REGISTER
export const registerGuard = (req, res, next) => {
  passport.authenticate("register", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      // si no encontró usuario, es porque hubo un error en el registro, que puede ser que el usuario ya exista, o que falten datos, o lo que hayamos configurado en la función de registro de passport
      console.warn(
        `[LOGGER DE SEGURIDAD] Falló el registro, Razón: ${info?.message}`,
      );
      return res
        .status(400)
        .json({ message: info?.message || "Error al registrar" });
    }
    req.user = user; // si el registro fue exitoso, passport nos devuelve el usuario registrado, que asignamos a req.user para poder usarlo en el controlador de la ruta
    next();
  })(req, res, next);
};
// el poner (req, res, next) al final es porque passport.authenticate devuelve una función middleware, y para que se ejecute esa función, le pasamos los parámetros req, res y next
// la alternativa habría sido usar passport.authenticate directamente en la ruta, pero al usar esta función guard, podemos centralizar el manejo de errores de registro, y también tener un logger específico para registrar los intentos fallidos de registro, que es información valiosa para la seguridad de la aplicación

//   LOGIN
export const passportAuthGuard = (req, res, next) => {
  // req.isAuthenticated es un método que nos da passport, y nos devuelve true si el usuario está autenticado, o false si no lo está. Esto es útil para evitar volver a autenticarnos si ya lo estamos, por ejemplo, si el usuario ya tiene una sesión iniciada, o ya validó su token con JWT, no hace falta volver a validar el token o la sesión en cada ruta, sino que podemos simplemente verificar si ya estamos autenticados y pasar al siguiente middleware o controlador
  if (req.isAuthenticated && req.isAuthenticated()) return next(); // si el usuario ya está autenticado, no hace falta volver a autenticarse, así que pasamos al siguiente middleware o controlador
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      // capturamos el mensaje de error
      const reason = info ? info.name || info.message : "Falta token";
      console.warn(
        `[LOGGER DE SEGURIDAD] Falló la autenticación, Razón: ${reason}`,
      );

      if (reason === "TokenExpiredError") {
        return res.status(401).json({
          message: "Tu sesión ha expirado, inicia sesión nuevamente",
          detail_error: reason, // opcional, pensando en el frontend
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

// CLASE 5
export const authorizeRoles = (roles) => {
  // roles será un array de roles permitidos, que pasaremos por parámetro al usar el middleware en la ruta

  // retornamos el middleware
  return (req, res, next) => {
    // verificar que exista req.user. Si no, es porque no nos autenticamos
    if (!req.user)
      return res.status(401).json({ message: "Debes iniciar sesion primero" });

    if (req.user.role === "admin" || roles.includes(req.user.role)) {
      // si el rol del usuario es admin, o el rol del usuario está incluido en el array de roles que pasamos por parámetro, entonces autorizamos
      return next();
    }

    return res.status(403).json({ message: "No tienes permisos para acceder" });
  };
};
