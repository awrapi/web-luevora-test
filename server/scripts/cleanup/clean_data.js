import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning leads and related data...');
  try {
    // Delete in order to respect foreign keys
    await prisma.chatHistory.deleteMany();
    await prisma.customerCrmHistory.deleteMany();
    await prisma.customerSchedule.deleteMany();
    await prisma.customerRequest.deleteMany();
    await prisma.customerServiceLabel.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.customerManagement.deleteMany();
    await prisma.offer.deleteMany();
    
    // Finally delete leads
    await prisma.lead.deleteMany();
    
    console.log('✅ Successfully cleaned data!');
  } catch (err) {
    console.error('Error cleaning data:', err);
  } finally {
    await prisma.$disconnect();
  }
}

clean();
