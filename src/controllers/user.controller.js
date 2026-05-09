import userModel from "../models/user.model.js";

export const getAll = async (req, res) => {
  const users = await userModel.find();
  res.status(200).json({ message: "Lista de usuarios", payload: users });
};

export const getProfile = async (req, res) => {
  res.status(200).json({ message: "Perfil del usuario", payload: req.user });
};

export const createProfile = async (req, res) => {
  const newUser = req.user;
  res.status(201).json({ message: "Usuario creado", payload: newUser });
};

export const getPremiumContent = async (req, res) => {
  res.status(200).json({
    message: "¡Bienvenido a la zona VIP!",
    benefit: "Aquí tienes acceso a descargas ilimitadas y soporte prioritario",
    user: req.user.email,
  });
};
