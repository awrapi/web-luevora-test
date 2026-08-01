import nodemailer from 'nodemailer';
import 'dotenv/config';

// Konfigurasi Transport Nodemailer
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Mengirimkan OTP melalui email
 * @param {string} email - Alamat email tujuan
 * @param {string} otp - 6 digit kode OTP
 */
export const sendOTP = async (email, otp) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[Mailer] SMTP belum dikonfigurasi di .env. OTP untuk ${email} adalah: ${otp}`);
    return; // Cegah error jika SMTP belum diset
  }

  const mailOptions = {
    from: `"Luevora Support" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Kode Verifikasi (OTP) Luevora Anda',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #4F46E5; text-align: center;">Verifikasi Email Anda</h2>
        <p style="color: #333; font-size: 16px;">Halo,</p>
        <p style="color: #333; font-size: 16px;">Terima kasih telah mendaftar di Luevora. Untuk melanjutkan, masukkan kode verifikasi berikut di halaman pendaftaran:</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4F46E5; background-color: #F3F4F6; padding: 10px 20px; border-radius: 8px;">
            ${otp}
          </span>
        </div>
        
        <p style="color: #666; font-size: 14px; text-align: center;">Kode ini akan kadaluarsa dalam 10 menit.</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">Jika Anda tidak merasa mendaftar di Luevora, abaikan email ini.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] OTP terkirim ke ${email}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Mailer] Gagal mengirim OTP ke ${email}:`, error);
    throw new Error('Gagal mengirim email verifikasi. Silakan coba lagi nanti.');
  }
};
