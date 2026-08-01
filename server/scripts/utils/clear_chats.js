import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanData() {
  console.log('🧹 Membersihkan SEMUA data leads, chat, dan CRM...\n');
  
  try {
    // 1. Chat & Queue
    const chatResult    = await prisma.chatHistory.deleteMany({});
    const queueResult   = await prisma.messageQueue.deleteMany({});
    const sessionResult = await prisma.sessionManager.deleteMany({});
    const modeLogResult = await prisma.modeChangeLog.deleteMany({});

    // 2. Transaksi & Booking
    const trxResult     = await prisma.transaction.deleteMany({});
    const bookingResult = await prisma.travelBooking.deleteMany({});

    // 3. CRM
    const cslResult     = await prisma.customerServiceLabel.deleteMany({});
    const statResult    = await prisma.customerStat.deleteMany({});

    // 4. Leads (hapus terakhir karena ada relasi)
    const leadResult    = await prisma.lead.deleteMany({});

    console.log('✅ Berhasil menghapus:');
    console.log(`   💬 ${chatResult.count} pesan chat`);
    console.log(`   📨 ${queueResult.count} antrian pesan`);
    console.log(`   🔄 ${sessionResult.count} sesi WhatsApp`);
    console.log(`   📋 ${modeLogResult.count} log perubahan mode`);
    console.log(`   💳 ${trxResult.count} transaksi`);
    console.log(`   ✈️  ${bookingResult.count} booking travel`);
    console.log(`   🏷️  ${cslResult.count} label CRM`);
    console.log(`   📊 ${statResult.count} statistik customer`);
    console.log(`   👤 ${leadResult.count} leads / kontak`);
    console.log('\n🎉 Database bersih & fresh! Setting, akun login, paket, dan knowledge base tetap aman.');
  } catch (err) {
    console.error('❌ Gagal membersihkan data:', err.message);
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanData();
