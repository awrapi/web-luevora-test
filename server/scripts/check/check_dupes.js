import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const dupes = await prisma.chatHistory.findMany({
    where: { message: { contains: "boleh liat detail" } }
  });
  console.log("Found records:", dupes.length);
  dupes.forEach(d => console.log(`[${d.id}] ${d.role}: ${d.message} (Provider ID: ${d.provider_msg_id})`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
