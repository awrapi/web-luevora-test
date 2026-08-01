/**
 * ================================================================
 * Register Service (Shared)
 * ================================================================
 * Handles business registration logic.
 * Creates a new Tenant + Owner User in a single transaction.
 * ================================================================
 */

import prisma from '../../config/database.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendOTP } from '../../utils/mailer.js';

const getSecret = () => process.env.JWT_SECRET || 'fallback-secret-key';
const JWT_EXPIRES_IN = '24h';

const VALID_BUSINESS_TYPES = ['clinic', 'rental', 'travel', 'course', 'retail'];

/**
 * Generate a URL-friendly slug from a business name.
 * @param {string} name 
 * @returns {string}
 */
function generateSlug(name) {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  // Add random suffix to ensure uniqueness
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

/**
 * Register a new business (Tenant + Owner User).
 */
export const registerBusiness = async (data) => {
  const { businessName, businessType, businessDescription, ownerName, username, email, password, phone } = data;

  if (!businessName || !businessType || !ownerName || !username || !email || !password) {
    throw new Error('Semua field wajib diisi (Nama Bisnis, Tipe Bisnis, Nama Pemilik, Username, Email, Password)');
  }

  if (!VALID_BUSINESS_TYPES.includes(businessType)) {
    throw new Error(`Tipe bisnis tidak valid. Pilihan: ${VALID_BUSINESS_TYPES.join(', ')}`);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Format email tidak valid');
  }

  if (password.length < 8) {
    throw new Error('Password minimal 8 karakter');
  }

  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new Error('Username hanya boleh berisi huruf, angka, dan garis bawah (_), dengan panjang 3-20 karakter');
  }

  const existingUsername = await prisma.user.findUnique({ where: { username } });
  if (existingUsername) {
    throw new Error('Username sudah digunakan. Silakan gunakan username lain');
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error('Email sudah terdaftar. Silakan gunakan email lain atau login');
  }

  const existingTenant = await prisma.tenant.findFirst({ where: { owner_email: email } });
  if (existingTenant) {
    throw new Error('Email sudah terdaftar sebagai pemilik bisnis lain');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const clientSlug = generateSlug(businessName);

  // Generate 6-digit OTP
  const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        client_slug: clientSlug,
        business_name: businessName,
        business_type: businessType,
        business_description: businessDescription || null,
        owner_phone: phone || null,
        owner_email: email,
        is_active: 1,
      },
    });

    const user = await tx.user.create({
      data: {
        tenant_id: tenant.id,
        name: ownerName,
        username: username,
        email: email,
        password: hashedPassword,
        verification_token: verificationToken,
        verification_expires_at: verificationExpiresAt,
        role: 'owner',
        is_active: 1,
      },
    });

    return { tenant, user };
  });

  // Send OTP Email
  try {
    await sendOTP(email, verificationToken);
  } catch (error) {
    console.error('[Register] Gagal mengirim OTP email:', error);
    // Kita tetap melanjutkan proses registrasi meskipun email gagal terkirim (bisa fallback resend)
  }

  return {
    requires_verification: true,
    message: 'Registrasi berhasil. Silakan cek email Anda untuk verifikasi.',
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    },
    tenant: {
      id: result.tenant.id,
      client_slug: result.tenant.client_slug,
      business_name: result.tenant.business_name,
      business_type: result.tenant.business_type,
    },
    business_type: result.tenant.business_type,
  };
};
