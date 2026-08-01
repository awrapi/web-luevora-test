import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Cleaning up inventory packages and knowledge base...\n');

  try {
    // Media and context files (children)
    const kbMediaCtx = await prisma.kbMediaContext.deleteMany({});
    const kbMediaFile = await prisma.kbMediaFile.deleteMany({});
    const pkgMediaCtx = await prisma.packageMediaContext.deleteMany({});
    const pkgMediaFile = await prisma.packageMediaFile.deleteMany({});
    
    // Child items for Advanced Travel Packages
    const advSubItems = await prisma.advancedPackageSubItem.deleteMany({});
    const advAddons = await prisma.advancedPackageAddon.deleteMany({});
    
    // Parent Tables
    const kb = await prisma.knowledgeBase.deleteMany({});
    const travel = await prisma.travelPackage.deleteMany({});
    const advTravel = await prisma.advancedTravelPackage.deleteMany({});
    const rental = await prisma.rentalUnit.deleteMany({});

    console.log('📊 Deletion summary:');
    console.log(`  ✅ KnowledgeBases: ${kb.count} deleted`);
    console.log(`  ✅ TravelPackages: ${travel.count} deleted`);
    console.log(`  ✅ AdvancedTravelPackages: ${advTravel.count} deleted`);
    console.log(`  ✅ RentalUnits: ${rental.count} deleted`);
    console.log(`  ✅ KnowledgeBase Media: ${kbMediaCtx.count + kbMediaFile.count} deleted`);
    console.log(`  ✅ Package Media: ${pkgMediaCtx.count + pkgMediaFile.count} deleted`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
