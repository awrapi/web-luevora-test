import 'dotenv/config';
import { sendMetaMedia } from './services/whatsapp/meta.service.js';

async function main() {
  try {
    const tenantId = 11;
    const phone = '6283811221775';
    const mediaUrl = 'https://res.cloudinary.com/dnnwvev7o/raw/upload/v1780852827/luevora/11/package-media/file_1780852826134_d6n6qs';
    const filename = 'regulasi_dan_aturan_wisata_yogyakarta.pdf';
    
    console.log('Sending media to Meta API...');
    const result = await sendMetaMedia(tenantId, phone, mediaUrl, 'Test file via API directly', filename);
    console.log('Result:', result);
  } catch (e) {
    console.error('Error:', e.response?.data || e.message);
  }
}
main();
