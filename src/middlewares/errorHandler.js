export const globalErrorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}`);
  console.error(err);

  const statusCode = err.status || 500;

  const response = {
    error: true,
    message: statusCode === 500 ? "Error interno del servidor" : err.message,
  };

  res.status(statusCode).json(response);
};
