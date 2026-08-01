import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanPackages() {
  try {
    console.log('Memulai pembersihan paket basic...');
    
    // Attempt to clean package media contexts manually (Prisma might cascade, but this is safer)
    try {
        await prisma.packageMediaContext.deleteMany({});
        console.log('✅ Package Media Context cleaned');
    } catch (e) {
        console.log('Skip PackageMediaContext');
    }

    // Clean TravelPackages
    await prisma.travelPackage.deleteMany({});
    console.log('✅ Basic Travel Packages cleaned');
    
    console.log('Pembersihan data paket selesai!');
  } catch (error) {
    console.error('Gagal membersihkan data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanPackages();
