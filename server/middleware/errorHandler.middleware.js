/**
 * Global Error Handler
 */
export const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]', err.stack);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    status: 'error',
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
