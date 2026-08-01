import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning OrderForm data...');
  if (prisma.orderForm) await prisma.orderForm.deleteMany({});
  console.log('OrderForm data cleaned!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
