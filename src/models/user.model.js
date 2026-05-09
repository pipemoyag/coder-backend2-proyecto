import { Schema, model } from "mongoose";

const UserSchema = new Schema({
  email: { type: String, unique: true },
  password: { type: String },
  role: { type: String, enum: ["admin", "user", "premium"], default: "user" },
});

export default model("User", UserSchema);
