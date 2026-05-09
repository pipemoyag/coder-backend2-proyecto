import passport from "passport";
import userModel from "../models/user.model.js";
import { Strategy as GithubStrategy } from "passport-github2";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/auth.js";

// CLASE 4

const { client_id, secret_id, callback_url } = env.github; // desestructuramos el objeto del objeto

const initializePassport = () => {
  // CLASE 5: ESTRATEGIA PASSPORT LOCAL
  passport.use(
    "register",
    new LocalStrategy(
      {
        // OBJETO DE CONFIGURACION
        usernameField: "email", // passport por defecto tiene un username
        passReqToCallback: true, // aquí le indicamos que podemos acceder al request de la función de registro
      },
      async (req, email, password, done) => {
        try {
          let userRole = "user";
          // DESAFIO, que en lugar de verificar un mail hardcodeado, verifique que el mail esté en una lista
          if (email === "admin@mail.com") {
            userRole = "admin";
          }

          if (email === "premium@mail.com") {
            userRole = "premium";
          }

          const user = await userModel.findOne({ email });
          if (user) {
            // si usuario existe, no es necesario registrarlo
            return done(null, false, { message: "El usuario ya existe" });
          }
          // creamos el nuevo usuario
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

  // CLASE 5 - ESTRATEGIA DE JWT
  passport.use(
    "jwt",
    new JwtStrategy(
      {
        // jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // indicamos que el token vendrá en el header de autorización, con el formato "Bearer token"
        // clase 6: indicamos que el token puede venir en el header de autorización, o en una cookie, dependiendo de cómo lo configuremos en el cliente
        jwtFromRequest: ExtractJwt.fromExtractors([
          cookieExtractor,
          ExtractJwt.fromAuthHeaderAsBearerToken(),
        ]),
        secretOrKey: env.jwt_secret, // la clave secreta para validar el token, que configuramos en env.js
      },
      async (jwt_payload, done) => {
        try {
          const userId = jwt_payload.id || jwt_payload._id; // podriamos poner 1, pero para que sea más dinámico, lo que hacemos es validar si el payload tiene un id o un _id, dependiendo de cómo lo hayamos configurado al generar el token
          const user = await userModel.findById(userId).select("-password"); // al buscar el usuario, le indicamos que no nos traiga el campo de password, por seguridad
          if (!user) return done(null, false);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );

  // CLASE 4 - ESTRATEGIA DE GITHuB
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
          // el profile de github tiene una propiedad que se llama _json
          // en general el usuario pone su mail, así que debería mandar el ._json.email
          const email = profile._json.email || `${profile.username}@github.com`;
          let user = await userModel.find({ email }); // no findOne porque en el modelo, email es un atributo unique
          if (!user) {
            user = await userModel.create({
              email,
              // NO se usará esta password, pero lo pusimos como requerido en el modelo, lo cual está bien
              password: "oauth_github_user",
            });
          }
          return done(null, user); // poner null primero es parte de como funciona el método "done"
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
};

// este primer metodo se encarga de guardar el usuario en la sesión
passport.serializeUser((user, done) => {
  // el _id es porque estamos trabajando con MongoDB, si fuera otro tipo de base de datos podría ser otro campo
  done(null, user._id);
});

// este segundo método se encarga de recuperar el usuario de la sesión, a partir del id que guardamos en el serializeUser
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userModel.findById(id).select("-password");
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

const cookieExtractor = (req) => {
  // req la entrega el modulo de passport, y es el request que llega a la ruta, que puede tener una cookie con el token
  let token = null;
  if (req && req.cookies) {
    token = req.cookies["accessToken"];
  }
  return token;
};

export default initializePassport;
