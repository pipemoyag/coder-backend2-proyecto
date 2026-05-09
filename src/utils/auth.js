import bcrypt from "bcrypt";

// hash de la contraseña
export const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10); // indicador de cuántas veces se va a "retorcer" la contraseña, para hacerla más segura. Estándar es 10
  return await bcrypt.hash(password, salt);
};

// compara passwords
export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};
