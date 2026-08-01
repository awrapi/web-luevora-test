/**
 * ================================================================
 * Auth Service (Shared)
 * ================================================================
 * Handles authentication business logic for all tenants.
 * ================================================================
 */

import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const getSecret = () => process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '24h';


/**
 * Authenticate a user and generate a JWT token.
 * 
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{token: string, user: object, tenant: object}>}
 */
export const loginUser = async (usernameOrEmail, password) => {
  if (!usernameOrEmail || !password) {
    throw new Error('Username/Email dan password wajib diisi');
  }

  // 1. Find user by email or username, including their tenant information
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: usernameOrEmail },
        { username: usernameOrEmail }
      ]
    },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    throw new Error('Username/Email atau Password yang Anda masukkan salah.');
  }

  if (user.is_active === 0 || user.tenant.is_active === 0) {
    throw new Error('Akun atau bisnis Anda sedang dinonaktifkan oleh Admin');
  }

  if (!user.email_verified_at) {
    throw new Error('Email Anda belum diverifikasi. Silakan cek inbox atau folder spam Anda untuk link verifikasi.');
  }

  // 2. Verify password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    throw new Error('Username/Email atau Password yang Anda masukkan salah.');
  }

  // 3. Generate JWT Token
  const tokenPayload = {
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(tokenPayload, getSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });


  // 4. Format return object (exclude sensitive data like password)
  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const tenantResponse = {
    id: user.tenant.id,
    client_slug: user.tenant.client_slug,
    business_name: user.tenant.business_name,
    business_type: user.tenant.business_type,
  };

  return {
    token,
    user: userResponse,
    tenant: tenantResponse,
    business_type: tenantResponse.business_type, // for frontend compatibility
  };
};
