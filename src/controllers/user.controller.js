import userModel from "../models/user.model.js";

// CLASE 8, AQUI VOY, MINUTO 19:00. AL FINAL BAJARON LA CLASE Y NO LA PUDE TERMINAR

export const getAll = async (req, res) => {
  // console.log(variableInexistente); // esto va a generar un error, para probar el global error handler

  // Gracias al globalErrorHandler, ya no necesitamos try/catch
  const users = await userModel.find();
  res.status(200).json({ message: "Lista de usuarios", payload: users });
};

export const getProfile = async (req, res) => {
  // try {
  //   // EN POSTMAN, INGRESAR EL TOKEN EN Authorization > Auth Type > Bearer Token
  //   // Si entra aquí, es porque se validó token con el middleware "isAuth"
  //   try {
  //     const user = req.session?.user;
  //     if (!user)
  //       return res.status(401).json({ message: "Debes iniciar sesion primero" });
  //     res.status(200).json({ message: "Perfil del usuario", payload: user });
  // CLASE 4
  res.status(200).json({ message: "Perfil del usuario", payload: req.user });
  // } catch (error) {
  //   res
  //     .status(500)
  //     .json({ message: "Error interno del servidor", error: error.message });
  // }
};

export const createProfile = async (req, res) => {
  // try {
  const newUser = req.user; // el usuario creado se guarda en req.user gracias a passport
  res.status(201).json({ message: "Usuario creado", payload: newUser });
  // } catch (error) {
  //   res
  //     .status(500)
  //     .json({ message: "Error interno del servidor", error: error.message });
  // }
};

export const getPremiumContent = async (req, res) => {
  res.status(200).json({
    message: "¡Bienvenido a la zona VIP!",
    benefit: "Aquí tienes acceso a descargas ilimitadas y soporte prioritario",
    user: req.user.email,
  });
};
