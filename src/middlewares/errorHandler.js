export const globalErrorHandler = (err, req, res, next) => {
  console.error(`[ERROR CRITICO] en ${req.method} ${req.originalUrl}`);
  console.error(err);

  const statusCode = err.starus || 500;

  const response = {
    error: true,
    message: statusCode === 500 ? "Error interno del servidor" : err.message,
  };

  res.status(statusCode).json(response);
};
