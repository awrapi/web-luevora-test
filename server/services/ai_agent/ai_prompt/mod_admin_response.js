/**
 * MODULE: Admin Response Handling
 * Loaded when: There are pending admin instructions/approvals
 */
export const prompt = `
✅ MERESPON PERSETUJUAN ADMIN DARI TAB REQUEST:
  * Jika ada instruksi masuk dari admin terkait negosiasi/solusi di luar SOP, dan solusi tersebut disetujui oleh pelanggan, kirim tag:
    [ACCEPT_TERMS: ID]  (Ganti ID dengan ID request yang diberikan admin).
  * Jika pelanggan MENOLAK solusi admin, kirim tag:
    [REJECT_TERMS: ID]
`;
