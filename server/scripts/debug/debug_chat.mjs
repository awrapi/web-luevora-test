import prisma from './config/database.js';
async function main() {
  const lastChat = await prisma.chatHistory.findFirst({
    orderBy: { id: 'desc' },
    take: 1
  });
  console.log('Last Chat:', lastChat);
}
main().catch(console.error).finally(() => prisma.$disconnect());
