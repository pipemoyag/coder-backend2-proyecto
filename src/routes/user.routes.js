import { Router } from "express";
// import { hashPassword } from "../utils/auth.js";
// import { isAuth } from "../middlewares/auth.middleware.js";
import {
  authorizeRoles,
  registerGuard,
  passportAuthGuard,
} from "../middlewares/auth.middleware.js";
import {
  getAll,
  getProfile,
  createProfile,
  getPremiumContent,
} from "../controllers/user.controller.js";
// import userModel from "../models/user.model.js";
// import passport from "passport";

const router = Router();

// const authenticate = passport.authenticate(["jwt", "session"], {
//   session: false,
// }); // middleware para autenticar con JWT o con sesión, dependiendo de lo que se use en cada ruta

const requireAdmin = [passportAuthGuard, authorizeRoles([])];
const requireUser = [passportAuthGuard, authorizeRoles(["user"])];
const requirePremium = [passportAuthGuard, authorizeRoles(["premium"])];
const requireAll = [passportAuthGuard, authorizeRoles(["user", "premium"])];

router.get("/", requireAdmin, getAll);

// router.get("/profile", isAuth, async (req, res) => {
router.get("/profile", requireAll, getProfile);

// // ESTE POST QUEDA OBSOLETO EN CLASE 5, PORQUE AHORA USAMOS PASSPORT LOCAL PARA REGISTRAR USUARIOS
// router.post("/", async (req, res) => {
//   const { email, password } = req.body; // desestructuramos el objeto
//   try {
//     const passHash = await hashPassword(password);
//     const newUser = await userModel.create({ email, password: passHash });
//     res.status(201).json({ message: "Usuario creado", payload: newUser });
//   } catch (error) {
//     res
//       .status(500)
//       .json({ message: "Error interno del servidor", error: error.message });
//   }
// });

// NUEVO POST, CON PASSPORT LOCAL
router.post("/", registerGuard, createProfile);

// USUARIO PREMIUM
router.get("/premium-content", requirePremium, getPremiumContent);

router.delete("/:id", requireAdmin, async (req, res) => {
  // try {
  const deletedUser = await userModel.findByIdAndDelete(req.params.id);
  if (!deletedUser)
    return res.status(404).json({ message: "Usuario no encontrado" });
  res.status(200).json({ message: "Usuario eliminado", payload: deletedUser });
  // } catch (error) {
  //   res
  //     .status(500)
  //     .json({ message: "Error interno del servidor", error: error.message });
  // }
});

export default router;
