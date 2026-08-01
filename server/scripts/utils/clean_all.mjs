import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const chats = await prisma.chatHistory.deleteMany({});
const queue = await prisma.messageQueue.deleteMany({});
const invoices = await prisma.invoice.deleteMany({});
const offers = await prisma.offer.deleteMany({});
const transactions = await prisma.transaction.deleteMany({});
const bookings = await prisma.travelBooking.deleteMany({});
const requests = await prisma.customerRequest.deleteMany({});
const leads = await prisma.lead.deleteMany({});

console.log(`✅ Cleaned: ${chats.count} chats, ${queue.count} queue, ${invoices.count} invoices, ${offers.count} offers, ${transactions.count} transactions, ${bookings.count} bookings, ${requests.count} customer requests, ${leads.count} leads`);
console.log('🎉 Database bersih!');
await prisma.$disconnect();

