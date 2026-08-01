import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing messages (chat history)...');
  await prisma.chatHistory.deleteMany({});
  
  console.log('Clearing travel bookings...');
  await prisma.travelBooking.deleteMany({});
  
  console.log('Clearing leads (CRM data)...');
  await prisma.lead.deleteMany({});
  
  console.log('Database CRM and Chat data cleared successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
