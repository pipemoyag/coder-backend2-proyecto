import passport from "passport";
import userModel from "../models/user.model.js";
import { Strategy as GithubStrategy } from "passport-github2";
import { Strategy as LocalStrategy } from "passport-local";
import { ExtractJwt, Strategy as JwtStrategy } from "passport-jwt";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/auth.js";

const { client_id, secret_id, callback_url } = env.github;

const initializePassport = () => {
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

  passport.use(
    "jwt",
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromExtractors([
          cookieExtractor,
          ExtractJwt.fromAuthHeaderAsBearerToken(),
        ]),
        secretOrKey: env.jwt_secret,
      },
      async (jwt_payload, done) => {
        try {
          const userId = jwt_payload.id || jwt_payload._id;
          const user = await userModel.findById(userId).select("-password");
          if (!user) return done(null, false);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
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
};

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

const cookieExtractor = (req) => {
  let token = null;
  if (req && req.cookies) {
    token = req.cookies["accessToken"];
  }
  return token;
};

export default initializePassport;
