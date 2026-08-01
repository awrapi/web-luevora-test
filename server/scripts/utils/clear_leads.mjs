import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearLeads() {
  try {
    console.log('Menghapus seluruh data kontak (leads)...');
    const leadResult = await prisma.lead.deleteMany({});
    console.log(`Berhasil menghapus ${leadResult.count} kontak/lead.`);
    
    console.log('Daftar inbox sekarang sepenuhnya kosong!');
  } catch (error) {
    console.error('Terjadi kesalahan:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearLeads();
