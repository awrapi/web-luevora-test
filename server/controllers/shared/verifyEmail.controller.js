import { verifyOTP } from '../../services/shared/verifyEmail.service.js';

export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    await verifyOTP(email, otp);

    return res.status(200).json({
      status: true,
      message: 'Email berhasil diverifikasi! Anda sekarang dapat masuk ke akun Anda.',
    });
  } catch (error) {
    console.error('Verify OTP Error:', error.message);
    
    return res.status(400).json({
      status: false,
      message: error.message || 'Gagal memverifikasi OTP.',
    });
  }
};
