import dotenv from "dotenv";

// clase 6
// NODE_ENV NO lo agregaremos al .env
const environment = process.env.NODE_ENV || "development";

dotenv.config({
  path: environment === "production" ? ".env.production" : ".env",
});

export const env = {
  // clase 6
  mode: environment,

  port: process.env.PORT || 4000,
  secret: process.env.SECRET,
  db_uri: process.env.DB_URI,
  jwt_secret: process.env.JWT_SECRET,
  jwt_refresh_token: process.env.JWT_REFRESH_TOKEN,
  github: {
    client_id: process.env.GITHUB_CLIENT_ID,
    secret_id: process.env.GITHUB_CLIENT_SECRET,
    callback_url: process.env.GITHUB_CALLBACK_URL,
  },
};
