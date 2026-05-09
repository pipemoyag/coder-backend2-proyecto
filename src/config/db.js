import mongoose from "mongoose";
import { env } from "./env.js";

const { db_uri } = env;

export default async function connectDB() {
  try {
    await mongoose.connect(db_uri);
    console.log("Conexion establecida");
  } catch (error) {
    console.error("Error al conectarse a la DB", error);
  }
}
