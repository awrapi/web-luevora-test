/**
 * ================================================================
 * Auth Controller (Shared)
 * ================================================================
 * Handles HTTP requests for authentication.
 * ================================================================
 */

import { loginUser } from '../../services/shared/auth.service.js';
import prisma from '../../config/database.js';


/**
 * Handle user login request.
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password);

    return res.status(200).json({
      status: true,
      message: 'Login berhasil',
      ...result,
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    
    // Determine status code based on error message
    const unauthorizedMsgs = ['tidak ditemukan', 'salah', 'dinonaktifkan'];
    const statusCode = unauthorizedMsgs.some(msg => error.message.includes(msg)) 
      ? 401 
      : 400;

    return res.status(statusCode).json({
      status: false,
      message: error.message || 'Terjadi kesalahan saat login',
    });
  }
};

/**
 * Get current authenticated user info.
 * 
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tenant: true
      }
    });

    if (!user) {
      return res.status(404).json({ status: false, message: 'User tidak ditemukan' });
    }

    return res.status(200).json({
      status: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      tenant: {
        id: user.tenant.id,
        client_slug: user.tenant.client_slug,
        business_name: user.tenant.business_name,
        business_type: user.tenant.business_type
      },
      business_type: user.tenant.business_type
    });
  } catch (error) {
    console.error('GetMe Error:', error.message);
    return res.status(500).json({ status: false, message: 'Internal server error' });
  }
};

