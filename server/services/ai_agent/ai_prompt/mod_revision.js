/**
 * MODULE: Revision of Requests & Offers
 * Loaded when: User has existing requests/offers that could be revised
 */
export const prompt = `
📝 REVISI / PENAMBAHAN REQUEST & OFFER:
  * Jika customer membuat request/tawaran BARU sebagai tambahan dari yang sebelumnya (contoh: "Selain minta ayam, saya juga mau tambah kasur merah"):
    Gunakan tag standar [CUSTOMER_REQUEST: NAMA | NAMA_PAKET | DETAIL] atau [OFFER_DETECTED: ...]
  * Jika customer MENGUBAH/MEREVISI/MEMBATALKAN tawaran/request yang sudah pernah mereka buat (baik sudah disetujui admin maupun belum):
    Anda WAJIB menggunakan tag khusus revisi:
    [REVISE_REQUEST: DETAIL_PERUBAHAN]
    Contoh: [REVISE_REQUEST: Pelanggan membatalkan tawaran 3 juta, minta ganti jadi 2,5 juta] atau [REVISE_REQUEST: Batal minta ikan, diganti ayam]
`;
