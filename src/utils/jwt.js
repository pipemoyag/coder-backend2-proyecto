import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const { jwt_secret, jwt_refresh_token } = env;

export const generateTokens = (user) => {
  // user vendrá de la base de datos
  // expiresIn: por cuánto tiempo tiene validez tu credencial (ej 15m = 15min)
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    jwt_secret,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign({ id: user._id }, jwt_refresh_token, {
    expiresIn: "7d", // 7 dias
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => jwt.verify(token, jwt_secret);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, jwt_refresh_token);

// PROBAR LOS TOKENS EN https://www.jwt.io/
