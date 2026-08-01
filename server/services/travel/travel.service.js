import { PrismaClient } from '@prisma/client';
import { pdfGeneratorService } from '../pdfGenerator.service.js';
import { sendText, sendMedia } from '../shared/messaging.service.js';
import { saveMessage } from '../shared/chat.service.js';
import { broadcast } from '../shared/sse.service.js';
import { upsertDocument, deleteDocument } from '../ai_agent/vector.service.js';
import { embeddingService } from '../deep_rag_engine/embedding.service.js';
import { orderFormConfigService } from './orderFormConfig.service.js';
const prisma = new PrismaClient();

// Helper: Auto-generate booking code
const generateBookingCode = () => {
  const date = new Date();
  const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const randomPart = Math.floor(Math.random() * 9000 + 1000);
  return `BKG-${datePart}-${randomPart}`;
};

export const travelService = {
  getDashboardSummary: async (tenantId) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        onTripBookings,
        completedBookings,
        recentBookings,
        revenueThisMonth,
        upcomingDepartures,
      ] = await Promise.all([
        prisma.travelBooking.count({ where: { tenant_id: tenantId } }),
        prisma.travelBooking.count({ where: { tenant_id: tenantId, status: 'pending' } }),
        prisma.travelBooking.count({ where: { tenant_id: tenantId, status: 'confirmed' } }),
        prisma.travelBooking.count({ where: { tenant_id: tenantId, status: 'on_trip' } }),
        prisma.travelBooking.count({ where: { tenant_id: tenantId, status: 'completed' } }),
        prisma.travelBooking.findMany({
          where: { tenant_id: tenantId },
          orderBy: { created_at: 'desc' },
          take: 5,
          include: { travel_package: { select: { destination: true } } }
        }),
        prisma.travelBooking.aggregate({
          where: { tenant_id: tenantId, payment_status: 'paid', created_at: { gte: startOfMonth } },
          _sum: { total_price: true }
        }),
        prisma.travelBooking.findMany({
          where: {
            tenant_id: tenantId,
            status: { in: ['confirmed', 'on_trip'] },
            departure_date: { gte: today }
          },
          orderBy: { departure_date: 'asc' },
          take: 5
        }),
      ]);

      return {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        onTripBookings,
        completedBookings,
        recentBookings,
        revenueThisMonth: parseFloat(revenueThisMonth._sum.total_price || 0),
        upcomingDepartures,
      };
    } catch (error) {
      throw error;
    }
  },

  getAllPackages: async (tenantId) => {
    return prisma.travelPackage.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' }
    });
  },

  createPackage: async (tenantId, data) => {
    const result = await prisma.travelPackage.create({
      data: {
        tenant_id: tenantId,
        package_name: data.package_name,
        destination: data.destination,
        description: data.description,
        duration_days: parseInt(data.duration_days) || 1,
        duration_nights: parseInt(data.duration_nights) || 0,
        price: parseFloat(data.price) || 0,
        original_price: parseFloat(data.original_price) || 0,
        image_url: data.image_url,
        category: data.category || 'domestic',
        inclusions: data.inclusions ? JSON.stringify(data.inclusions) : null,
        exclusions: data.exclusions ? JSON.stringify(data.exclusions) : null,
        itinerary: data.itinerary ? JSON.stringify(data.itinerary) : null,
        min_pax: parseInt(data.min_pax) || 1,
        max_pax: parseInt(data.max_pax) || 100,
        is_promo: data.is_promo ? 1 : 0,
        status: data.status || 'active',
        transaction_mode: data.transaction_mode || 'auto'
      }
    });

    // Sync order form fields if provided
    if (data.order_form_fields !== undefined) {
      try {
        await orderFormConfigService.sync(tenantId, result.id, 'basic', data.order_form_fields);
      } catch (err) {
        console.error('[TravelService] Failed to sync order form fields on create:', err.message);
      }
    }

    // Trigger Redis Vector Sync
    const textRepresentation = `Paket: ${result.package_name}\nKategori: ${result.category}\nDestinasi: ${result.destination}\nHarga: ${result.price}\nDeskripsi: ${result.description}\nTermasuk: ${result.inclusions}\nTidak Termasuk: ${result.exclusions}`;
    upsertDocument(tenantId, 'TravelPackage', result.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

    // Trigger Deep RAG Embed — chunk & embed description for vector search
    const embeddingText = `Nama Paket: ${result.package_name}\nDestinasi: ${result.destination || '-'}\nKategori: ${result.category || '-'}\nHarga: Rp ${parseFloat(result.price || 0).toLocaleString('id-ID')}\nMinimum Peserta: ${result.min_pax || 1} orang\nMaksimum Peserta: ${result.max_pax || 100} orang\n\nDeskripsi Lengkap:\n${result.description || '-'}\n\nTermasuk:\n${result.inclusions || '-'}\n\nTidak Termasuk:\n${result.exclusions || '-'}`;
    embeddingService.chunkAndEmbed(tenantId, 'basic_package', result.id, embeddingText).catch(err => console.error('[BasicPkg] Embed Error:', err.message));

    return result;
  },

  getAllBookings: async (tenantId) => {
    return prisma.travelBooking.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
      include: {
        travel_package: { select: { id: true, package_name: true, destination: true } }
      }
    });
  },

  createBooking: async (tenantId, data) => {
    let packageName = data.package_name;
    let destination = data.destination;
    let totalPrice = parseFloat(data.total_price) || 0;
    const paxCount = parseInt(data.pax_count) || 1;
    const packageId = data.travel_package_id ? parseInt(data.travel_package_id) : null;
    
    if (packageId) {
      const pkg = await prisma.travelPackage.findFirst({
        where: { id: packageId, tenant_id: tenantId }
      });
      if (pkg) {
        packageName = pkg.package_name;
        destination = destination || pkg.destination;
        if (!totalPrice) {
          totalPrice = parseFloat(pkg.price) * paxCount;
        }
      }
    }

    const downpayment = parseFloat(data.downpayment_amount) || 0;

    return prisma.travelBooking.create({
      data: {
        tenant_id: tenantId,
        booking_code: generateBookingCode(),
        phone: data.phone,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_id_number: data.customer_id_number,
        travel_package_id: packageId,
        package_name: packageName,
        destination: destination,
        pax_count: paxCount,
        departure_date: data.departure_date ? new Date(data.departure_date) : null,
        return_date: data.return_date ? new Date(data.return_date) : null,
        meeting_point: data.meeting_point,
        total_price: totalPrice,
        downpayment_amount: downpayment,
        remaining_amount: totalPrice - downpayment,
        status: data.status || 'pending',
        payment_status: data.payment_status || 'unpaid',
        booking_source: data.booking_source || 'manual',
        special_request: data.special_request,
        notes: data.notes,
      }
    });
  },

  updateBookingStatus: async (tenantId, bookingId, status, paymentStatus) => {
    const data = { updated_at: new Date() };
    if (status) data.status = status;
    if (paymentStatus) data.payment_status = paymentStatus;

    return prisma.travelBooking.update({
      where: { id: parseInt(bookingId), tenant_id: tenantId },
      data
    });
  },

  deletePackage: async (tenantId, packageId) => {
    const result = await prisma.travelPackage.delete({
      where: { id: packageId, tenant_id: tenantId }
    });

    // Trigger Redis Vector Delete
    deleteDocument(tenantId, 'TravelPackage', result.id).catch(err => console.error('Vector Delete Error:', err.message));

    // Delete Deep RAG Embeddings
    embeddingService.deleteChunks(tenantId, 'basic_package', result.id).catch(err => console.error('[BasicPkg] Embed Delete Error:', err.message));

    return result;
  },

  updatePackage: async (tenantId, packageId, data) => {
    const updateData = { updated_at: new Date() };
    const fields = [
      'package_name', 'destination', 'description', 'duration_days', 'duration_nights',
      'image_url', 'category', 'min_pax', 'max_pax', 'is_promo', 'status', 'transaction_mode'
    ];
    fields.forEach(f => { if (data[f] !== undefined) updateData[f] = data[f]; });
    if (data.price !== undefined) updateData.price = parseFloat(data.price);
    if (data.original_price !== undefined) updateData.original_price = parseFloat(data.original_price);
    if (data.inclusions !== undefined) updateData.inclusions = JSON.stringify(data.inclusions);
    if (data.exclusions !== undefined) updateData.exclusions = JSON.stringify(data.exclusions);
    if (data.itinerary !== undefined) updateData.itinerary = JSON.stringify(data.itinerary);

    const result = await prisma.travelPackage.update({
      where: { id: packageId, tenant_id: tenantId },
      data: updateData
    });

    // Sync order form fields if provided
    if (data.order_form_fields !== undefined) {
      try {
        await orderFormConfigService.sync(tenantId, packageId, 'basic', data.order_form_fields);
      } catch (err) {
        console.error('[TravelService] Failed to sync order form fields:', err.message);
      }
    }

    // Trigger Redis Vector Sync
    const textRepresentation = `Paket: ${result.package_name}\nKategori: ${result.category}\nDestinasi: ${result.destination}\nHarga: ${result.price}\nDeskripsi: ${result.description}\nTermasuk: ${result.inclusions}\nTidak Termasuk: ${result.exclusions}`;
    upsertDocument(tenantId, 'TravelPackage', result.id, textRepresentation).catch(err => console.error('Vector Upsert Error:', err.message));

    // Trigger Deep RAG Re-embed — re-chunk & embed updated description
    const embeddingText = `Nama Paket: ${result.package_name}\nDestinasi: ${result.destination || '-'}\nKategori: ${result.category || '-'}\nHarga: Rp ${parseFloat(result.price || 0).toLocaleString('id-ID')}\nMinimum Peserta: ${result.min_pax || 1} orang\nMaksimum Peserta: ${result.max_pax || 100} orang\n\nDeskripsi Lengkap:\n${result.description || '-'}\n\nTermasuk:\n${result.inclusions || '-'}\n\nTidak Termasuk:\n${result.exclusions || '-'}`;
    embeddingService.chunkAndEmbed(tenantId, 'basic_package', result.id, embeddingText).catch(err => console.error('[BasicPkg] Re-embed Error:', err.message));

    return result;
  },

  getPendingApprovals: async (tenantId) => {
    return prisma.transaction.findMany({
      where: { tenant_id: tenantId, status: 'pending' },
      orderBy: { created_at: 'desc' }
    });
  },

  approvePayment: async (tenantId, transactionId) => {
    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId), tenant_id: tenantId }
    });

    if (!transaction) throw new Error('Transaction not found');
    if (transaction.status !== 'pending') throw new Error('Transaction is not pending');

    // 1. Update Transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'approved', updated_at: new Date() }
    });

    // 2. Update Travel Booking — gunakan booking_id jika ada, fallback ke parsing order_id
    let booking = null;
    const bookingId = transaction.booking_id
      ? transaction.booking_id
      : parseInt((transaction.order_id || '').replace('BKG-', ''));

    if (bookingId) {
      booking = await prisma.travelBooking.update({
        where: { id: bookingId },
        data: { status: 'confirmed', payment_status: 'paid', updated_at: new Date() }
      }).catch(() => null);
    }

    // 3. Generate Receipt PDF & Send via WA (opsional)
    if (booking) {
      const pdfResult = await pdfGeneratorService.generateReceipt(tenantId, booking.id, {
        invoiceNumber: `REC-${booking.id}`,
        customerName: booking.customer_name,
        customerPhone: booking.phone,
        packageDetails: `${booking.package_name} (${booking.pax_count} Pax)`,
        amount: booking.total_price,
        paymentInfo: `Lunas via Transfer (Approval Transaksi #${transaction.id})`
      }).catch(e => { console.error('[Travel] PDF Error:', e); return { success: false }; });

      if (pdfResult.success) {
        const baseUrl = process.env.PUBLIC_URL || 'http://localhost:3001';
        const pdfUrl = `${baseUrl}${pdfResult.fileUrl}`;
        const caption = `Pembayaran Anda untuk ${booking.package_name} telah kami terima! Berikut tanda terima Anda.\n\nTerima kasih telah mempercayakan perjalanan Anda bersama kami! 🙏`;
        
        try {
          await sendMedia(prisma, booking.phone, caption, pdfUrl, { tenantId });
          await saveMessage(prisma, booking.phone, 'assistant', caption, tenantId, pdfUrl);
          broadcast(tenantId, 'new_message', {
            phone: booking.phone,
            message: caption,
            media_url: pdfUrl,
            role: 'assistant',
            timestamp: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.error('[Travel] Failed to send receipt via WA:', e.message);
        }
      }
    }

    return { success: true, message: 'Payment approved and receipt sent.' };
  },

  rejectPayment: async (tenantId, transactionId, reason) => {
    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(transactionId), tenant_id: tenantId }
    });

    if (!transaction) throw new Error('Transaction not found');
    
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'rejected', updated_at: new Date() }
    });

    // Revert booking status jika ada
    const bookingId = transaction.booking_id
      ? transaction.booking_id
      : parseInt((transaction.order_id || '').replace('BKG-', ''));

    let booking = null;
    if (bookingId) {
      booking = await prisma.travelBooking.update({
        where: { id: bookingId },
        data: { payment_status: 'unpaid', updated_at: new Date() }
      }).catch(() => null);
    }

    if (booking) {
      const rejectMsg = `Mohon maaf, bukti pembayaran untuk paket ${booking.package_name} belum dapat kami validasi.\n\nAlasan: ${reason || 'Bukti transfer tidak valid/jelas'}.\n\nMohon kirimkan ulang bukti pembayaran yang benar. Terima kasih.`;
      try {
        await sendText(prisma, booking.phone, rejectMsg, { tenantId });
        await saveMessage(prisma, booking.phone, 'assistant', rejectMsg, tenantId);
        broadcast(tenantId, 'new_message', {
          phone: booking.phone,
          message: rejectMsg,
          role: 'assistant',
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
      } catch (e) {
        console.error('[Travel] Failed to send rejection via WA:', e.message);
      }
    }

    return { success: true, message: 'Payment rejected and user notified.' };
  },

  getPerformanceData: async (tenantId, { range = '7d', startDate, endDate }) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    let groupBy = 'day'; // 'hour', 'day', 'month'

    if (range === 'custom' && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 1) groupBy = 'hour';
      else if (diffDays > 90) groupBy = 'month';
    } else {
      switch (range) {
        case 'today':
          start.setHours(0, 0, 0, 0);
          groupBy = 'hour';
          break;
        case '1m':
          start.setDate(today.getDate() - 30);
          break;
        case '3m':
          start.setMonth(today.getMonth() - 3);
          groupBy = 'month';
          break;
        case '6m':
          start.setMonth(today.getMonth() - 6);
          groupBy = 'month';
          break;
        case '1y':
          start.setFullYear(today.getFullYear() - 1);
          groupBy = 'month';
          break;
        case '7d':
        default:
          start.setDate(today.getDate() - 7);
          break;
      }
    }

    // Fix end date to end of day if we are grouping by day/month to ensure all inclusive
    if (groupBy !== 'hour') {
      end.setHours(23, 59, 59, 999);
    }

    // Fetch raw data
    const leads = await prisma.lead.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: start, lte: end }
      },
      select: { created_at: true }
    });

    const bookings = await prisma.travelBooking.findMany({
      where: {
        tenant_id: tenantId,
        created_at: { gte: start, lte: end } // We use created_at to measure closing
      },
      select: { created_at: true }
    });

    // Grouping logic
    const groupedData = {};

    const getBucket = (date) => {
      const d = new Date(date);
      if (groupBy === 'hour') {
        return `${String(d.getHours()).padStart(2, '0')}:00`;
      } else if (groupBy === 'month') {
        return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      } else {
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      }
    };

    // Initialize buckets to avoid gaps
    let current = new Date(start);
    while (current <= end) {
      const bucket = getBucket(current);
      if (!groupedData[bucket]) {
        groupedData[bucket] = { label: bucket, leads: 0, closings: 0 };
      }
      if (groupBy === 'hour') {
        current.setHours(current.getHours() + 1);
      } else if (groupBy === 'month') {
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(current.getDate() + 1);
      }
    }

    // Fill data
    leads.forEach(l => {
      if (l.created_at) {
        const bucket = getBucket(l.created_at);
        if (groupedData[bucket]) groupedData[bucket].leads += 1;
      }
    });

    bookings.forEach(b => {
      if (b.created_at) {
        const bucket = getBucket(b.created_at);
        if (groupedData[bucket]) groupedData[bucket].closings += 1;
      }
    });

    return Object.values(groupedData);
  }
};
