import express from "express";
import cookieParser from "cookie-parser";
import session from "express-session";
import FileStore from "session-file-store";
import MongoStore from "connect-mongo";
import passport from "passport";

import connectDB from "./config/db.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import initializePassport from "./middlewares/passport.config.js";
import { env } from "./config/env.js";
import { globalErrorHandler } from "./middlewares/errorHandler.js";

//settings
const app = express();
app.set("PORT", env.port);
const secret = env.secret;
// const fileStore = FileStore(session);

// Clase 6, movemos initializePassport() y app.use(passport.initialize()) antes de los middlewares, para que passport esté disponible en todos los middlewares, incluyendo el de registro, donde lo necesitamos para manejar los errores de registro y loguear los intentos fallidos de registro
initializePassport();
app.use(passport.initialize());

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// en las store (fileStore, mongoStore, etc) se pasan objetos de configuracion
// app.use(
//   session({
//     store: new fileStore({ path: "./sessions", ttl: 100, retries: 0 }),
//     secret,
//     resave: false,
//     saveUninitialized: false,
//   }),
// );
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: env.db_uri,
      ttl: 60000,
    }),
    secret,
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(passport.session());

//routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.get("/", (req, res) => {
  res.json({ title: "Home Page" });
});

// CLASE 7: MIDDLEWARE PARA MANEJAR RUTAS QUE NO EXISTEN
// Importante que esté al final de todas las rutas
app.use((req, res) => {
  res.status(404).json({
    error: "No encontrado",
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
  });
});

// CLASE 7: GLOBAL ERROR HANDLER
// Manejador de errores
app.use(globalErrorHandler);

//listeners
connectDB();
app.listen(app.get("PORT"), () => {
  console.log(`Server on port http://localhost:${app.get("PORT")}`);
});
