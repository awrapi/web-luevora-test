import { filterFieldRelevance } from './services/ai_agent/rag.service.js';

const rawPackageContext = `
=== Paket Wisata Bali ===
Deskripsi: Ini adalah paket wisata bali.
Jadwal Keberangkatan: Tersedia setiap hari.
Harga: Rp 1.000.000
Sub-Paket:
✅ Reguler: Rp 1.000.000
Harga Khusus Sub-Paket:
- Anak: Rp 500.000
Layanan Tambahan (Addons):
- Fotografer: Rp 200.000
`;

async function runTest() {
    const tenantId = 1; // Assuming 1
    const userMessage = "berapa harga khusus untuk anak anak?";
    const chatHistorySnippet = "";
    
    console.log("Testing filterFieldRelevance...");
    const result = await filterFieldRelevance(tenantId, userMessage, chatHistorySnippet, rawPackageContext);
    console.log("=== RESULT ===");
    console.log(result);
}

runTest().catch(console.error);
