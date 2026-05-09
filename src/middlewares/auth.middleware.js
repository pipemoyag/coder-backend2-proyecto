import passport from "passport";

// User registration with Passport Local strategy
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
// Execute passport authentication and log failed registration attempts
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

// Authorize access based on user roles
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
