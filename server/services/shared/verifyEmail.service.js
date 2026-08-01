import prisma from '../../config/database.js';

/**
 * Verifikasi email menggunakan OTP 6-digit
 * @param {string} email 
 * @param {string} otp 
 * @returns {Promise<boolean>}
 */
export const verifyOTP = async (email, otp) => {
  if (!email || !otp) {
    throw new Error('Email dan OTP wajib diisi.');
  }

  const user = await prisma.user.findFirst({
    where: { 
      email: email,
      verification_token: otp 
    }
  });

  if (!user) {
    throw new Error('Kode OTP tidak valid.');
  }

  if (user.email_verified_at) {
    // Sudah diverifikasi sebelumnya
    return true;
  }

  if (user.verification_expires_at && user.verification_expires_at < new Date()) {
    throw new Error('Kode OTP sudah kadaluarsa. Silakan minta kode baru.');
  }

  // Update user as verified and clear OTP
  await prisma.user.update({
    where: { id: user.id },
    data: {
      email_verified_at: new Date(),
      verification_token: null,
      verification_expires_at: null,
    }
  });

  return true;
};
