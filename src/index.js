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

const app = express();
app.set("PORT", env.port);
const secret = env.secret;

initializePassport();
app.use(passport.initialize());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
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

app.use((req, res) => {
  res.status(404).json({
    error: "No encontrado",
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
  });
});

app.use(globalErrorHandler);

//listeners
connectDB();
app.listen(app.get("PORT"), () => {
  console.log(`Server on port http://localhost:${app.get("PORT")}`);
});
