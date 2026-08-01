/**
 * ================================================================
 * Register Controller (Shared)
 * ================================================================
 * Handles HTTP requests for business registration.
 * ================================================================
 */

import { registerBusiness } from '../../services/shared/register.service.js';

/**
 * Handle business registration request.
 */
export const register = async (req, res) => {
  try {
    const { businessName, businessType, businessDescription, ownerName, username, email, password, phone } = req.body;

    const result = await registerBusiness({
      businessName,
      businessType,
      businessDescription,
      ownerName,
      username,
      email,
      password,
      phone,
    });

    return res.status(201).json({
      status: true,
      message: 'Registrasi bisnis berhasil! Selamat datang di Luevora CRM.',
      ...result,
    });
  } catch (error) {
    console.error('Register Error:', error.message);

    const statusCode = error.message.includes('sudah terdaftar') ? 409 : 400;

    return res.status(statusCode).json({
      status: false,
      message: error.message || 'Terjadi kesalahan saat registrasi',
    });
  }
};
