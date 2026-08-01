/**
 * Dummy data for Knowledge Base page.
 * Replace with API calls when backend is ready.
 */
export const DUMMY_TOPICS = [
  { id: 1, title: 'Jam Operasional', content_text: 'Senin-Jumat 08:00-20:00 WIB, Sabtu 09:00-15:00 WIB, Minggu libur.', ai_context: 'Informasikan jam buka tutup dengan ramah. Jika pelanggan menanyakan di luar jam operasional, sarankan untuk datang besok.', media_path: null, allow_send_media: false },
  { id: 2, title: 'Metode Pembayaran', content_text: 'Transfer BCA/BNI/Mandiri, QRIS, dan tunai di kantor.', ai_context: 'Jelaskan semua opsi pembayaran yang tersedia. Rekening BCA: 1234567890 a/n PT Kampus Inggris.', media_path: null, allow_send_media: false },
  { id: 3, title: 'Kebijakan Reschedule', content_text: 'Reschedule gratis maksimal 1x per bulan. Konfirmasi minimal H-1 sebelum jadwal.', ai_context: 'Kebijakan reschedule: 1x gratis/bulan, H-1 sebelum jadwal. Lebih dari itu dikenakan biaya Rp50.000.', media_path: null, allow_send_media: false },
  { id: 4, title: 'Lokasi & Parkir', content_text: 'Jl. Sudirman No.42, lantai 3. Parkir gratis untuk motor, mobil Rp5.000/jam.', ai_context: 'Alamat lengkap: Jl. Sudirman No.42 Lt.3, Kota Bandung. Dekat halte Trans Metro. Parkir motor gratis, mobil Rp5.000/jam.', media_path: 'https://placehold.co/80x80/eef2ff/6366f1?text=MAP', allow_send_media: true },
  { id: 5, title: 'Syarat Pendaftaran', content_text: 'KTP/KK, pas foto 3x4, dan formulir pendaftaran. Bisa daftar online via WhatsApp.', ai_context: 'Pendaftaran bisa dilakukan langsung di kantor atau via WA. Dokumen dikirim foto saja dulu, asli dibawa saat hari pertama.', media_path: null, allow_send_media: false },
];

export const EMPTY_TOPIC = { title: '', content_text: '', ai_context: '', allow_send_media: false };
