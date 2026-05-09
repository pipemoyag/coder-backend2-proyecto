import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const { jwt_secret, jwt_refresh_token } = env;

export const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { id: user._id, email: user.email },
    jwt_secret,
    { expiresIn: "15m" },
  );

  const refreshToken = jwt.sign({ id: user._id }, jwt_refresh_token, {
    expiresIn: "7d",
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => jwt.verify(token, jwt_secret);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, jwt_refresh_token);
