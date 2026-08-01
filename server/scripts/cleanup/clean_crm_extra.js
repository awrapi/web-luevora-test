import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up EXTRA data...');
  
  if (prisma.refundRequest) await prisma.refundRequest.deleteMany({});
  if (prisma.statusInformation) await prisma.statusInformation.deleteMany({});
  if (prisma.ragContextCache) await prisma.ragContextCache.deleteMany({});
  if (prisma.travelBooking) await prisma.travelBooking.deleteMany({});
  if (prisma.dateRequest) await prisma.dateRequest.deleteMany({});
  if (prisma.rescheduleRequest) await prisma.rescheduleRequest.deleteMany({});
  if (prisma.customerSchedule) await prisma.customerSchedule.deleteMany({});
  if (prisma.mediaSentLog) await prisma.mediaSentLog?.deleteMany?.({}); // If exists

  console.log('Extra cleanup complete!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
