import jwt from 'jsonwebtoken';

const getSecret = () => process.env.JWT_SECRET || 'fallback-secret-key';


/**
 * Authentication Middleware
 * Verifies JWT and attaches user info to the request.
 */
export const authMiddleware = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ 
      status: false, 
      message: 'Akses ditolak. Token tidak ditemukan.' 
    });
  }

  try {
    const decoded = jwt.verify(token, getSecret());

    
    // Attach user context to request
    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role
    };

    // Also set tenant context for other middlewares if needed
    req.tenant = {
      id: decoded.tenantId
    };

    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ 
      status: false, 
      message: 'Token tidak valid atau kedaluwarsa.' 
    });
  }
};
