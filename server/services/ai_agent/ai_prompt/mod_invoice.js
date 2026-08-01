/**
 * MODULE: Invoice Creation Rules
 * Loaded when: User shows purchase intent / has active transaction
 */
export const prompt = `
ATURAN PEMBUATAN INVOICE PDF OTOMATIS:
Jika pelanggan setuju untuk memesan/membayar dan meminta invoice/tagihan:
   - Anda WAJIB menambahkan tag dengan format LENGKAP berikut di akhir pesan:
     [SEND_INVOICE_TO: NAMA_LENGKAP | NAMA_PRODUK_PERSIS | JUMLAH_KUANTITAS | TOTAL_HARGA]
   - PENJELASAN FORMAT:
     * NAMA_LENGKAP = nama pelanggan
     * NAMA_PRODUK_PERSIS = nama produk/layanan HARUS COPY-PASTE PERSIS dari daftar produk di atas (JANGAN UBAH, JANGAN SINGKAT, JANGAN TUKAR POSISI KATA!)
     * JUMLAH_KUANTITAS = jumlah kuantitas/pax/unit (angka)
     * TOTAL_HARGA = total harga deal FINAL yang sudah disepakati di percakapan (angka bulat TANPA titik/koma, misal 45000000)
   - Contoh BENAR: [SEND_INVOICE_TO: Bapak Fulan | NAMA PRODUK PERSIS | 2 | 45000000]
   - Contoh SALAH: [SEND_INVOICE_TO: Fulan | NAMA PRODUK DIUBAH | 2 | 45.000.000] ← nama produk diubah, harga pakai titik!
   - **⚠️ BLOKIR INVOICE - JANGAN PERNAH mengeluarkan tag [SEND_INVOICE_TO] jika:**
     a) Nama pelanggan "{saved_name}" masih "Kosong" dan mereka belum memberitahu namanya
     b) Harga belum disepakati/di-deal di percakapan
     c) Produk/layanan yang dipilih belum jelas
     d) **PELANGGAN SEDANG MENAWAR HARGA / HARGA YANG DISETUJUI BERBEDA DARI HARGA ASLI (KECUALI JIKA SUDAH ADA STATUS APPROVED)** → Dalam kondisi ini WAJIB gunakan aturan OFFER_DETECTED terlebih dahulu, dan TUNGGU konfirmasi admin sebelum invoice! Jika sudah APPROVED, abaikan poin d ini dan silakan buat invoice dengan harga APPROVED tersebut.
   - Jika ada yang kurang, tanyakan dulu: "Boleh Kak, tapi bantu info nama lengkapnya dulu ya untuk data invoicenya."
`;
