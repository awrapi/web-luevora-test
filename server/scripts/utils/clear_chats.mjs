import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearChats() {
  try {
    console.log('Menghapus seluruh data chat_history...');
    const chatResult = await prisma.chatHistory.deleteMany({});
    console.log(`Berhasil menghapus ${chatResult.count} pesan.`);

    console.log('Mereset memori percakapan pada data Lead...');
    const leadResult = await prisma.lead.updateMany({
      data: {
        chat_summary: null,
        last_message_preview: null,
        last_ai_reply: null,
        preferences: null,
        msg_count_since_summary: 0
      }
    });
    console.log(`Berhasil mereset memori untuk ${leadResult.count} kontak/lead.`);
    
    console.log('Data percakapan berhasil dikosongkan!');
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearChats();
