import { Router } from "express";
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
import userModel from "../models/user.model.js";

const router = Router();

const requireAdmin = [passportAuthGuard, authorizeRoles([])];
const requireUser = [passportAuthGuard, authorizeRoles(["user"])];
const requirePremium = [passportAuthGuard, authorizeRoles(["premium"])];
const requireAll = [passportAuthGuard, authorizeRoles(["user", "premium"])];

router.get("/", requireAdmin, getAll);
router.get("/profile", requireAll, getProfile);

router.get("/session", passportAuthGuard, (req, res) => {
  res.status(200).json({
    message: "Sesión actual",
    session: req.session,
    user: req.user,
  });
});

router.post("/", registerGuard, createProfile);

// USUARIO PREMIUM
router.get("/premium-content", requirePremium, getPremiumContent);

router.delete("/:id", requireAdmin, async (req, res) => {
  const deletedUser = await userModel.findByIdAndDelete(req.params.id);
  if (!deletedUser)
    return res.status(404).json({ message: "Usuario no encontrado" });
  res.status(200).json({ message: "Usuario eliminado", payload: deletedUser });
});

export default router;
