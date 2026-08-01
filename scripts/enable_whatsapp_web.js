const fs = require('fs');
const path = require('path');

console.log('Mengaktifkan kembali integrasi WhatsApp Web (Baileys)...');

const platformsPath = path.join(__dirname, '../dashboard/src/lib/config/platforms.js');
try {
  let platformsCode = fs.readFileSync(platformsPath, 'utf8');
  platformsCode = platformsCode.replace(/\/\/ ====== WHATSAPP WEB DISABLED ======\n([\s\S]*?)\/\/ ===================================/g, (match, p1) => {
    // Menghapus komentar dari block
    return p1.split('\n').map(line => line.replace(/^\/\/ ?/, '')).join('\n');
  });
  fs.writeFileSync(platformsPath, platformsCode);
  console.log('[+] Connect Platform: WhatsApp Web (Baileys) berhasil diaktifkan.');
} catch (e) {
  console.error('[-] Gagal memodifikasi platforms.js:', e.message);
}

const serverIndexPath = path.join(__dirname, '../server/index.js');
try {
  let indexCode = fs.readFileSync(serverIndexPath, 'utf8');
  indexCode = indexCode.replace(/\/\/ ====== WHATSAPP WEB DISABLED ======\n([\s\S]*?)\/\/ ===================================/g, (match, p1) => {
    // Menghapus komentar dari block
    return p1.split('\n').map(line => line.replace(/^\/\/ ?/, '')).join('\n');
  });
  fs.writeFileSync(serverIndexPath, indexCode);
  console.log('[+] Server: Service WhatsApp Web berhasil diaktifkan kembali.');
} catch (e) {
  console.error('[-] Gagal memodifikasi server/index.js:', e.message);
}

console.log('\nSelesai! Silakan restart Server dan buka Dashboard kembali.');
