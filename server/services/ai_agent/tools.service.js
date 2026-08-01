import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import db from '../../config/database.js';
import { broadcast } from '../shared/sse.service.js';
import { orderFormService } from './orderForm.service.js';
import * as centralInfoRequestService from '../shared/centralInfoRequest.service.js';
import { handleNameExtraction, handleLeadMerge } from '../shared/identity.service.js';
import * as deferredGuidance from './deferredGuidance.service.js';
import { addRequestItem } from './cmCopilot.service.js';

/**
 * =========================================================================
 * AI TOOL REGISTRY (FUNCTION CALLING)
 * =========================================================================
 * File ini berisi daftar fungsi-fungsi khusus yang bisa dipanggil oleh AI 
 * secara mandiri untuk berinteraksi langsung dengan database/sistem.
 * 
 * Gunakan file ini jika Anda ingin menambah fitur baru seperti:
 * - Cek Inventory/Slot
 * - Kalkulator Harga
 * - Booking Otomatis
 * - Cek Status Pengiriman
 * =========================================================================
 */

/**
 * 1. TOOL: CALCULATE EXACT PRICE
 * Tool ini digunakan agar AI tidak menghitung manual harga paket.
 */
const CalculateExactPriceTool = new DynamicStructuredTool({
  name: "calculate_exact_price",
  description: "PANGGIL TOOL INI SECARA WAJIB jika pelanggan menyebutkan jumlah kuantitas pesanan (contoh: '2 dewasa 2 anak', 'untuk 4 orang', 'beli 3 tiket') ATAU ketika menanyakan harga total. Jangan pernah menebak atau menghitung harga secara manual! PENTING: Jika pelanggan TIDAK menyebutkan nama produk/layanan DAN ada lebih dari 1 topik/produk di Notes/Topik Aktif, JANGAN PANGGIL TOOL INI. Bertanyalah dulu ke pelanggan untuk klarifikasi.",
  schema: z.object({
    product_name: z.string().describe("Nama produk atau layanan yang ingin dihitung harganya"),
    quantity: z.number().describe("Jumlah total kuantitas yang dipesan (pax, pcs, unit, tiket)"),
    categories: z.array(z.object({
      category_name: z.string().describe("Nama kategori khusus (misal: 'Dewasa', 'Anak', 'VIP', 'WNA')"),
      count: z.number().describe("Jumlah untuk kategori tersebut")
    })).optional().describe("Breakdown detail kategori kuantitas jika disebutkan")
  }),
  func: async ({ product_name, quantity, categories }) => {
    try {
      let participants = [];
      if (Array.isArray(categories) && categories.length > 0) {
        participants = categories.map(c => ({ category: c.category_name, count: c.count }));
      } else {
        participants = [{ category: "Dewasa", count: quantity || 1 }];
      }

      const keyword = (product_name || '').trim();
      
      // Search BOTH advanced and basic packages
      const [advPackages, basicPackages] = await Promise.all([
        db.advancedTravelPackage.findMany({
          where: { title: { contains: keyword } },
          include: { sub_items: { where: { status: 'active' } } },
          take: 3
        }),
        db.travelPackage.findMany({
          where: { package_name: { contains: keyword }, status: 'active' },
          take: 3
        })
      ]);

      if (advPackages.length === 0 && basicPackages.length === 0) {
        return JSON.stringify({
          status: "error",
          message: `Produk/Layanan dengan nama mirip "${product_name}" tidak ditemukan di database. Pastikan nama yang diminta sudah benar.`
        });
      }

      let reqSummary = participants.map(p => `${p.count} ${p.category}`).join(', ');
      let resultText = `Berikut adalah hasil perhitungan pasti dari sistem database untuk pemesanan: ${reqSummary}.\n\n`;

      // Process Advanced Packages
      for (const pkg of advPackages) {
        resultText += `=== PRODUK/LAYANAN: ${pkg.title} ===\n`;
        if (pkg.sub_items.length === 0) {
          resultText += `- Belum ada sub-item/varian harga untuk produk ini.\n`;
          continue;
        }

        for (const sub of pkg.sub_items) {
          let adultPrice = parseFloat(sub.price) || 0;
          let grandTotal = 0;
          let breakdownText = "";

          for (const p of participants) {
            let priceToUse = adultPrice;
            let labelUsed = "Harga Standar/Reguler";

            if (sub.custom_prices && Array.isArray(sub.custom_prices)) {
              const match = sub.custom_prices.find(cp => 
                (cp.label || '').toLowerCase().includes(p.category.toLowerCase()) || 
                p.category.toLowerCase().includes((cp.label || '').toLowerCase())
              );

              if (match) {
                priceToUse = parseFloat(match.price) || 0;
                labelUsed = `Harga Khusus (${match.label})`;
              } else if (p.category.toLowerCase() === 'bayi' || p.category.toLowerCase() === 'infant' || p.category.toLowerCase() === 'balita') {
                priceToUse = 0;
                labelUsed = "Otomatis Gratis (Bayi/Balita)";
              }
            } else {
              if (p.category.toLowerCase() === 'bayi' || p.category.toLowerCase() === 'infant' || p.category.toLowerCase() === 'balita') {
                priceToUse = 0;
                labelUsed = "Otomatis Gratis (Bayi/Balita)";
              }
            }

            const subtotal = priceToUse * p.count;
            grandTotal += subtotal;
            breakdownText += `- ${p.count} unit/pax [Kategori: ${p.category} -> Match DB: ${labelUsed}] x Rp ${priceToUse.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}\n`;
          }

          resultText += `Varian [${sub.title}]:\n`;
          resultText += breakdownText;
          resultText += `> TOTAL BIAYA: Rp ${grandTotal.toLocaleString('id-ID')}\n\n`;
        }
      }

      // Process Basic Packages
      for (const pkg of basicPackages) {
        const basePrice = parseFloat(pkg.price) || 0;
        resultText += `=== PRODUK/LAYANAN: ${pkg.package_name} ===\n`;
        resultText += `Harga per unit/pax: Rp ${basePrice.toLocaleString('id-ID')}\n`;
        
        let grandTotal = 0;
        let breakdownText = "";
        
        for (const p of participants) {
          let priceToUse = basePrice;
          let labelUsed = "Harga per unit/pax";
          
          if (p.category.toLowerCase() === 'bayi' || p.category.toLowerCase() === 'infant' || p.category.toLowerCase() === 'balita') {
            priceToUse = 0;
            labelUsed = "Otomatis Gratis (Bayi/Balita)";
          }
          
          const subtotal = priceToUse * p.count;
          grandTotal += subtotal;
          breakdownText += `- ${p.count} unit/pax [Kategori: ${p.category} -> ${labelUsed}] x Rp ${priceToUse.toLocaleString('id-ID')} = Rp ${subtotal.toLocaleString('id-ID')}\n`;
        }
        
        resultText += breakdownText;
        resultText += `> TOTAL BIAYA: Rp ${grandTotal.toLocaleString('id-ID')}\n`;
        resultText += `Catatan: Menggunakan harga flat per unit/pax.\n\n`;
      }

      resultText += `\n[INSTRUKSI UNTUK AI]: Gunakan angka-angka TOTAL BIAYA di atas untuk menjawab pertanyaan pelanggan. Anda TIDAK PERLU menghitung manual lagi.`;

      return resultText;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 2. TOOL: CHECK LIVE AVAILABILITY
 * Tool ini digunakan untuk mengecek sisa slot pada tanggal tertentu.
 */
const CheckLiveAvailabilityTool = new DynamicStructuredTool({
  name: "check_live_availability",
  description: "Gunakan tool ini jika kustomer bertanya apakah masih ada slot/ketersediaan/jadwal pada tanggal spesifik.",
  schema: z.object({
    product_name: z.string().describe("Nama produk atau layanan yang ingin dicek ketersediaannya"),
    date: z.string().describe("Tanggal yang ditanyakan dalam format YYYY-MM-DD")
  }),
  func: async ({ product_name, date }) => {
    try {
      const keyword = (product_name || '').trim();
      
      const packages = await db.advancedTravelPackage.findMany({
        where: { title: { contains: keyword } },
        take: 3
      });

      if (packages.length === 0) {
        return JSON.stringify({
          status: "error",
          message: `Produk/Layanan "${product_name}" tidak ditemukan.`
        });
      }

      const targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        return "Format tanggal tidak valid. Gunakan YYYY-MM-DD.";
      }

      let resultText = `KETERSEDIAAN SLOT TANGGAL ${date}:\n\n`;

      for (const pkg of packages) {
        resultText += `=== ITEM: ${pkg.title} ===\n`;

        // 1. Cek ketersediaan di tabel override harian
        const override = await db.packageSlotOverride.findFirst({
          where: { 
            package_id: pkg.id, 
            override_date: {
              gte: new Date(targetDate.setHours(0, 0, 0, 0)),
              lt: new Date(targetDate.setHours(23, 59, 59, 999))
            }
          }
        });

        if (override) {
          const sisa = override.slot_limit - override.slot_used;
          resultText += `- Keterangan Khusus Tanggal Ini: Kuota Terbatas\n`;
          resultText += `- Total Kuota: ${override.slot_limit}\n`;
          resultText += `- Telah Terisi: ${override.slot_used}\n`;
          resultText += `- SISA SLOT: ${sisa > 0 ? sisa + ' unit/kursi' : 'HABIS/PENUH'}\n`;
        } else {
          // 2. Jika tidak ada override, gunakan aturan default
          if (pkg.slot_mode === 'always_ready') {
            resultText += `- Slot selalu tersedia setiap hari (Unlimited).\n`;
          } else if (pkg.slot_mode === 'daily_limit') {
            resultText += `- Kuota harian default: ${pkg.slot_daily || 'Tidak ditentukan'} unit/kursi per hari. (Belum ada booking khusus di tanggal ini).\n`;
          } else {
            resultText += `- Metode Slot: ${pkg.slot_mode}. Hubungi admin untuk memastikan ketersediaan.\n`;
          }
        }
        resultText += "\n";
      }

      resultText += `[INSTRUKSI UNTUK AI]: Informasikan sisa slot ini kepada pelanggan dengan bahasa yang ramah. Jika statusnya \"HABIS\", tawarkan tanggal lain.`;
      
      return resultText;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 3. TOOL: TRACK ORDER STATUS
 * Tool ini digunakan untuk mengecek status pesanan atau invoice.
 */
const TrackOrderStatusTool = new DynamicStructuredTool({
  name: "track_order_status",
  description: "Gunakan tool ini ketika pelanggan bertanya tentang status pesanan, invoice, atau menanyakan apakah pembayaran mereka sudah masuk. Wajib dipanggil jika ada pertanyaan terkait 'invoice', 'lunas', 'pembayaran', atau 'pesanan saya'.",
  schema: z.object({
    invoice_number: z.string().describe("Nomor invoice jika disebutkan oleh pelanggan (contoh: INV-001). Isi string kosong jika tidak disebutkan"),
    search_query: z.string().describe("Kata kunci pencarian tambahan. Isi string kosong jika tidak ada")
  }),
  func: async ({ invoice_number, search_query }, context) => {
    try {
      if (!context || !context.phone) {
        return "Sistem tidak dapat mengidentifikasi nomor WhatsApp pelanggan. Mohon tanyakan nomor invoice mereka.";
      }

      let whereClause = { tenant_id: context.tenantId };
      
      // Jika kustomer menyebut nomor invoice spesifik, cari berdasarkan nomor itu
      // Jika tidak, cari berdasarkan nomor WA kustomer yang sedang chat
      if (invoice_number && invoice_number.length > 0) {
        whereClause.invoice_number = { contains: invoice_number };
      } else {
        whereClause.customer_phone = { contains: context.phone };
      }

      const invoices = await db.invoice.findMany({
        where: whereClause,
        orderBy: { created_at: 'desc' },
        take: 3
      });

      if (invoices.length === 0) {
        return "Tidak ditemukan invoice atau pesanan atas nomor Anda. Jika Anda baru saja transfer, mohon tunggu sebentar atau sebutkan nomor invoice Anda.";
      }

      let resultText = "Ditemukan data pesanan/invoice berikut:\n";
      for (const inv of invoices) {
        resultText += `- Invoice: ${inv.invoice_number}\n`;
        resultText += `  Status: ${inv.status}\n`;
        resultText += `  Total: Rp ${parseFloat(inv.amount || 0).toLocaleString('id-ID')}\n`;
        resultText += `  Tanggal: ${inv.created_at ? inv.created_at.toISOString().split('T')[0] : '-'}\n`;
      }
      resultText += "\n[INSTRUKSI UNTUK AI]: Beritahukan status invoice tersebut kepada pelanggan dengan ramah.";
      
      return resultText;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 4. TOOL: UPDATE CUSTOMER PREFERENCE (SMART CRM)
 * Tool ini menyimpan preferensi khusus dari kustomer secara diam-diam (background).
 */
const UpdateCustomerPreferenceTool = new DynamicStructuredTool({
  name: "update_customer_preference",
  description: "PANGGIL TOOL INI SECARA RAHASIA jika pelanggan menyebutkan preferensi penting, keluhan, atau kondisi khusus (misal: 'saya bawa balita', 'saya tidak suka capek', 'alergi seafood', dll). Jangan beri tahu pelanggan bahwa Anda memanggil tool ini.",
  schema: z.object({
    preference_category: z.string().describe("Kategori preferensi, misal: 'Makanan', 'Kondisi Fisik', 'Keluarga', 'Jadwal'"),
    preference_detail: z.string().describe("Detail preferensi yang spesifik")
  }),
  func: async ({ preference_category, preference_detail }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return "Data konteks tidak lengkap untuk menyimpan preferensi.";
      }

      const category = (preference_category || 'GENERAL').toUpperCase().replace(/\s+/g, '_');

      await db.customerCrmHistory.create({
        data: {
          tenant_id: context.tenantId,
          phone: context.phone,
          event_type: `AI_PREFERENCE_${category}`,
          event_detail: `[AI Auto-Profile] Kustomer menyatakan: ${preference_detail || 'Tidak disebutkan'}`
        }
      });

      return "[INTERNAL NOTE]: Preferensi berhasil disimpan ke database CRM. Lanjutkan percakapan dengan pelanggan seperti biasa secara natural tanpa menyinggung database.";
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 5. TOOL: GENERATE CUSTOMER REQUEST
 * Menggantikan tag [CUSTOMER_REQUEST]. Dipanggil ketika pelanggan ingin memesan paket atau meminta request khusus.
 */
const GenerateCustomerRequestTool = new DynamicStructuredTool({
  name: "generate_customer_request",
  description: "JANGAN PERNAH memanggil tool ini jika kustomer masih bertanya-tanya, berdiskusi, menambah fitur, atau sekadar minta hitung harga total. PANGGIL TOOL INI HANYA JIKA kustomer secara eksplisit sudah berkata 'Deal', 'Setuju', 'Oke fix', 'Lanjut bayar', atau meminta link invoice/pembayaran. Ini akan langsung mengirimkan form pesanan Final ke sistem kasir beserta detail konteks untuk owner.",
  schema: z.object({
    customer_name: z.string().describe("Nama lengkap pelanggan"),
    product_name: z.string().describe("Nama produk atau layanan yang dipesan"),
    request_detail: z.string().describe("Catatan detail pemesanan atau permintaan khusus dari pelanggan"),
    quantity_detail: z.string().optional().describe("Detail jumlah/pax pesanan lengkap, contoh: '2 Dewasa + 1 Anak', '4 unit', '3 box'"),
    schedule_date: z.string().optional().describe("Jadwal/tanggal pelaksanaan atau pengiriman yang disepakati, contoh: '5 Juli 2025'"),
    agreed_price: z.number().optional().describe("Harga total yang disepakati (setelah negosiasi jika ada). Isi 0 jika menggunakan harga standar."),
    price_per_unit: z.number().optional().describe("Harga per unit/pax yang disepakati. Isi 0 jika tidak diketahui."),
    special_requests: z.string().optional().describe("Permintaan khusus tambahan dari pelanggan"),
    custom_attributes: z.record(z.string()).optional().describe("Atribut tambahan kustom dalam format JSON (misal: preferensi hotel, warna, ukuran, dll)")
  }),
  func: async ({ customer_name, product_name, request_detail, quantity_detail, schedule_date, agreed_price, price_per_unit, special_requests, custom_attributes }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return "Sistem tidak dapat mengidentifikasi konteks pelanggan.";
      }

      // Backward compatibility mappings
      const package_name = product_name;
      const pax_detail = quantity_detail || '';
      const departure_date = schedule_date || '';
      const hotel_preference = custom_attributes?.hotel_preference || custom_attributes?.preferensi_hotel || '';
      const price_per_pax = price_per_unit || 0;

      // ── Name validation gate ──
      const genericNames = ['pelanggan', 'kosong', 'whatsapp user', 'user', 'telegram user', 'customer', ''];
      if (genericNames.includes((customer_name || '').toLowerCase().trim())) {
        console.warn(`[Tool:CustomerRequest] ⛔ BLOCKED — generic customer name: "${customer_name}". Must ask for full name first.`);
        return "[INTERNAL NOTE]: GAGAL — Nama pelanggan belum diketahui. Anda WAJIB menanyakan nama lengkap pelanggan terlebih dahulu sebelum mengirim pesanan. Tanyakan sekarang dengan sopan.";
      }

      // ── Build rich admin note ──
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const paxInfo = pax_detail ? `\n   • Kuantitas: ${pax_detail}` : '';
      const hotelInfo = hotel_preference ? `\n   • Preferensi: ${hotel_preference}` : '';
      const dateInfo = departure_date ? `\n   • Jadwal: ${departure_date}` : '';
      const priceInfo = agreed_price > 0 ? `\n   • Harga disepakati: Rp ${agreed_price.toLocaleString('id-ID')}` : '';
      const paxPriceInfo = price_per_pax > 0 ? `\n   • Harga/unit: Rp ${price_per_pax.toLocaleString('id-ID')}` : '';
      const detailInfo = request_detail ? `\n   • Detail: ${request_detail}` : '';
      const specialInfo = special_requests ? `\n   • Request khusus: ${special_requests}` : '';

      const adminNote =
        `[${now}] ✅ Pesanan DEAL — menunggu proses oleh owner` +
        `\n   • Item: ${package_name}` +
        paxInfo +
        hotelInfo +
        dateInfo +
        priceInfo +
        paxPriceInfo +
        detailInfo +
        specialInfo;

      // --- AUTO CLEANUP: Cancel existing pending requests first ---
      const oldPendingRequests = await db.customerRequest.findMany({
        where: { tenant_id: context.tenantId, phone: context.phone, status: 'pending' }
      });

      for (const oldReq of oldPendingRequests) {
        await db.customerRequest.update({
          where: { id: oldReq.id },
          data: { status: 'canceled_customer', revision_note: 'Dibatalkan/direvisi oleh AI karena customer memesan produk lain.' }
        });
        broadcast(context.tenantId, 'customer_request_updated', { id: oldReq.id, status: 'canceled_customer' });
      }

      const request = await db.customerRequest.create({
        data: {
          tenant_id: context.tenantId,
          phone: context.phone,
          customer_name: customer_name,
          package_name: package_name,
          request_detail: request_detail,
          request_type: "booking_request",
          status: "pending"
        }
      });

      broadcast(context.tenantId, 'new_customer_request', request);

      // ── Write rich note to CustomerManagement ──
      try {
        const existingCM = await db.customerManagement.findFirst({
          where: {
            tenant_id: context.tenantId,
            phone: context.phone,
            status: { notIn: ['done', 'canceled_customer', 'canceled'] }
          },
          orderBy: { updated_at: 'desc' }
        });

        if (existingCM) {
          const existingNote = existingCM.admin_note || '';
          await db.customerManagement.update({
            where: { id: existingCM.id },
            data: {
              customer_name: customer_name !== 'Pelanggan' ? customer_name : existingCM.customer_name,
              package_name: package_name || existingCM.package_name,
              admin_note: existingNote ? existingNote + '\n' + adminNote : adminNote,
              updated_at: new Date()
            }
          });
        } else {
          await db.customerManagement.create({
            data: {
              tenant_id: context.tenantId,
              phone: context.phone,
              customer_name: customer_name || 'Pelanggan',
              package_name: package_name || null,
              admin_note: adminNote,
              status: 'waiting_offer'
            }
          });
        }
      } catch (cmErr) {
        console.warn('[Tool:CustomerRequest] Failed to write admin note to CM:', cmErr.message);
      }

      // ── Also write to unified CmRequestItem ──
      try {
        await addRequestItem(
          context.tenantId,
          context.phone,
          'booking_request',
          `Booking: ${package_name}${pax_detail ? ` (${pax_detail})` : ''}`,
          request_detail + (special_requests ? `\nRequest khusus: ${special_requests}` : ''),
          {
            package_name,
            pax_detail: pax_detail || null,
            hotel_preference: hotel_preference || null,
            departure_date: departure_date || null,
            agreed_price: agreed_price || null,
            price_per_pax: price_per_pax || null,
            special_requests: special_requests || null,
            request_id: request.id
          },
          customer_name,
          package_name
        );
      } catch (cmItemErr) {
        console.warn('[Tool:CustomerRequest] Failed to create CmRequestItem:', cmItemErr.message);
      }

      return `[INTERNAL NOTE]: Formulir pesanan (Request ID: ${request.id}) telah berhasil dibuat di sistem dan diteruskan ke Dashboard Admin beserta detail konteks lengkap. Sampaikan kepada pelanggan bahwa pesanan mereka sedang diproses dan admin akan segera memberikan konfirmasi/pembayaran.`;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});


/**
 * 6. TOOL: GENERATE BARGAIN OFFER
 * Menggantikan tag [OFFER_DETECTED]. Dipanggil ketika terjadi negosiasi atau tawar menawar harga.
 */
const GenerateBargainOfferTool = new DynamicStructuredTool({
  name: "generate_bargain_offer",
  description: "PANGGIL TOOL INI SAJA ketika pelanggan melakukan tawar-menawar harga dan Anda sebagai AI menyetujuinya. Tool ini akan mencatat penawaran ke sistem manajer BESERTA detail konteks penting agar owner bisa mengambil keputusan dengan tepat.",
  schema: z.object({
    customer_name: z.string().describe("Nama pelanggan"),
    product_name: z.string().describe("Nama produk atau layanan"),
    original_price: z.number().describe("Harga asli/normal sebelum ditawar (total keseluruhan, bukan per unit)"),
    offered_price: z.number().describe("Harga tawaran pelanggan yang disepakati (total keseluruhan)"),
    quantity_detail: z.string().optional().describe("Detail kuantitas/pax yang ditawar, contoh: '4 orang', '5 unit'"),
    schedule_date: z.string().optional().describe("Jadwal/tanggal rencana penggunaan atau pengiriman yang diajukan pelanggan"),
    price_per_unit: z.number().optional().describe("Harga per unit/pax yang ditawar (jika bisa dihitung). Isi 0 jika tidak diketahui."),
    discount_reason: z.string().optional().describe("Alasan/konteks mengapa ada negosiasi harga, contoh: 'Pelanggan meminta diskon karena family trip 4 pax'"),
    custom_attributes: z.record(z.string()).optional().describe("Atribut tambahan kustom dalam format JSON (misal: preferensi hotel, warna, ukuran, dll)")
  }),
  func: async ({ customer_name, product_name, original_price, offered_price, quantity_detail, schedule_date, price_per_unit, discount_reason, custom_attributes }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return "Sistem tidak dapat mengidentifikasi konteks pelanggan.";
      }

      // Backward compatibility mappings
      const package_name = product_name;
      const pax_detail = quantity_detail || '';
      const departure_date = schedule_date || '';
      const hotel_preference = custom_attributes?.hotel_preference || custom_attributes?.preferensi_hotel || '';
      const price_per_pax = price_per_unit || 0;

      // ── Name validation gate ──
      const genericNames = ['pelanggan', 'kosong', 'whatsapp user', 'user', 'telegram user', 'customer', ''];
      if (genericNames.includes((customer_name || '').toLowerCase().trim())) {
        console.warn(`[Tool:BargainOffer] ⛔ BLOCKED — generic customer name: "${customer_name}". Must ask for full name first.`);
        return "[INTERNAL NOTE]: GAGAL — Nama pelanggan belum diketahui. Anda WAJIB menanyakan nama lengkap pelanggan terlebih dahulu sebelum mengirim penawaran. Tanyakan sekarang dengan sopan.";
      }

      // ── Build rich admin note ──
      const now = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const discountAmount = original_price - offered_price;
      const discountPct = original_price > 0 ? ((discountAmount / original_price) * 100).toFixed(1) : '0';
      const paxInfo = pax_detail ? `\n   • Kuantitas: ${pax_detail}` : '';
      const hotelInfo = hotel_preference ? `\n   • Preferensi: ${hotel_preference}` : '';
      const dateInfo = departure_date ? `\n   • Jadwal: ${departure_date}` : '';
      const paxPriceInfo = price_per_pax > 0 ? `\n   • Harga/unit ditawar: Rp ${price_per_pax.toLocaleString('id-ID')}` : '';
      const reasonInfo = discount_reason ? `\n   • Konteks: ${discount_reason}` : '';

      const adminNote =
        `[${now}] 💬 Negosiasi Harga — menunggu keputusan owner` +
        `\n   • Item: ${package_name}` +
        paxInfo +
        hotelInfo +
        dateInfo +
        `\n   • Harga normal: Rp ${original_price.toLocaleString('id-ID')}` +
        `\n   • Harga ditawar: Rp ${offered_price.toLocaleString('id-ID')} (-${discountPct}%, selisih Rp ${discountAmount.toLocaleString('id-ID')})` +
        paxPriceInfo +
        reasonInfo;

      // Overwrite if pending exists, else create
      const existingOffer = await db.offer.findFirst({
        where: { tenant_id: context.tenantId, phone: context.phone, status: 'pending' }
      });

      let broadcastOffer;
      if (existingOffer) {
        broadcastOffer = await db.offer.update({
          where: { id: existingOffer.id },
          data: { package_name, original_price, offered_price }
        });
      } else {
        broadcastOffer = await db.offer.create({
          data: {
            tenant_id: context.tenantId,
            phone: context.phone,
            customer_name,
            package_name,
            original_price,
            offered_price,
            status: "pending"
          }
        });
      }

      // ── Write rich note to CustomerManagement ──
      try {
        const existingCM = await db.customerManagement.findFirst({
          where: {
            tenant_id: context.tenantId,
            phone: context.phone,
            status: { notIn: ['done', 'canceled_customer', 'canceled'] }
          },
          orderBy: { updated_at: 'desc' }
        });

        if (existingCM) {
          const existingNote = existingCM.admin_note || '';
          await db.customerManagement.update({
            where: { id: existingCM.id },
            data: {
              customer_name: customer_name !== 'Pelanggan' ? customer_name : existingCM.customer_name,
              package_name: package_name || existingCM.package_name,
              admin_note: existingNote ? existingNote + '\n' + adminNote : adminNote,
              updated_at: new Date()
            }
          });
        } else {
          // Create new CM record with the rich note
          await db.customerManagement.create({
            data: {
              tenant_id: context.tenantId,
              phone: context.phone,
              customer_name: customer_name || 'Pelanggan',
              package_name: package_name || null,
              admin_note: adminNote,
              status: 'waiting_offer'
            }
          });
        }
      } catch (cmErr) {
        console.warn('[Tool:BargainOffer] Failed to write admin note to CM:', cmErr.message);
      }

      // ── Also write to unified CmRequestItem ──
      try {
        await addRequestItem(
          context.tenantId,
          context.phone,
          'bargain_offer',
          `Nawar: ${package_name} Rp ${offered_price.toLocaleString('id-ID')} (dari Rp ${original_price.toLocaleString('id-ID')})`,
          `Diskon ${discountPct}% (selisih Rp ${discountAmount.toLocaleString('id-ID')})${discount_reason ? `. Alasan: ${discount_reason}` : ''}`,
          {
            package_name,
            original_price,
            offered_price,
            discount_percent: parseFloat(discountPct),
            pax_detail: pax_detail || null,
            hotel_preference: hotel_preference || null,
            departure_date: departure_date || null,
            price_per_pax: price_per_pax || null,
            discount_reason: discount_reason || null,
            offer_id: broadcastOffer.id
          },
          customer_name,
          package_name
        );
      } catch (cmItemErr) {
        console.warn('[Tool:BargainOffer] Failed to create CmRequestItem:', cmItemErr.message);
      }

      broadcast(context.tenantId, 'new_offer', broadcastOffer);

      return `[INTERNAL NOTE]: Penawaran harga sebesar Rp ${offered_price.toLocaleString('id-ID')} (diskon ${discountPct}% dari Rp ${original_price.toLocaleString('id-ID')}) telah dikirimkan ke sistem manajer untuk persetujuan, beserta detail konteks (pax, hotel, tanggal). Sampaikan kepada pelanggan untuk menunggu konfirmasi dari manajer.`;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 7. TOOL: CANCEL ORDER REQUEST
 * Dipanggil khusus ketika pelanggan menyatakan batal memesan secara keseluruhan.
 */
const CancelOrderRequestTool = new DynamicStructuredTool({
  name: "cancel_order_request",
  description: "PANGGIL TOOL INI HANYA JIKA pelanggan dengan tegas menyatakan membatalkan pesanan atau penawarannya (Misal: 'Maaf kak, saya ga jadi pesen ya'). JANGAN panggil ini jika pelanggan HANYA ingin pindah paket (untuk pindah paket gunakan langsung tool generate_customer_request).",
  schema: z.object({
    reason: z.string().describe("Alasan pembatalan dari pelanggan (singkat)")
  }),
  func: async ({ reason }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return "Sistem tidak dapat mengidentifikasi konteks pelanggan.";
      }

      let canceledCount = 0;

      // 1. Cancel Offers
      const pendingOffers = await db.offer.findMany({
        where: { tenant_id: context.tenantId, phone: context.phone, status: 'pending' }
      });
      for (const off of pendingOffers) {
        await db.offer.update({ where: { id: off.id }, data: { status: 'canceled_customer' } });
        canceledCount++;
      }

      // 2. Cancel Requests
      const pendingRequests = await db.customerRequest.findMany({
        where: { tenant_id: context.tenantId, phone: context.phone, status: 'pending' }
      });
      for (const req of pendingRequests) {
        await db.customerRequest.update({ 
          where: { id: req.id }, 
          data: { status: 'canceled_customer', revision_note: `Dibatalkan pelanggan: ${reason}` } 
        });
        broadcast(context.tenantId, 'customer_request_updated', { id: req.id, status: 'canceled_customer' });
        canceledCount++;
      }

      if (canceledCount === 0) {
        return "[INTERNAL NOTE]: Tidak ada pesanan aktif yang perlu dibatalkan. Balas pelanggan dengan ramah.";
      }

      return `[INTERNAL NOTE]: Sebanyak ${canceledCount} pesanan/tawaran (pending) untuk pelanggan ini berhasil dibatalkan di sistem. Balas pelanggan dengan ucapan terima kasih dan sampaikan semoga di lain waktu bisa melayani mereka kembali.`;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 8. TOOL: UPDATE ACTIVE TOPICS (DYNAMIC FORM / NOTES)
 * Memperbarui daftar paket/topik yang sedang dibahas.
 */
const UpdateActiveTopicsTool = new DynamicStructuredTool({
  name: "update_active_topics",
  description: "PANGGIL TOOL INI SECARA RAHASIA di background untuk memperbarui daftar nama produk, layanan, atau topik yang sedang dibahas dengan pelanggan saat ini. Tool ini bertindak seperti Dynamic Notes bagi AI. Jika pelanggan merujuk ke produk/layanan baru, tambahkan ke dalam notes ini. Jika membahas lebih dari 1 produk/layanan sekaligus, cantumkan semuanya. PENTING: JANGAN PERNAH mengosongkan (mengirim array kosong) jika sebelumnya sudah ada topik yang dibahas, kecuali pelanggan secara eksplisit membatalkan minat mereka.",
  schema: z.object({
    active_topics: z.array(z.string()).describe("Daftar nama produk/layanan/topik yang saat ini sedang relevan dan aktif dibicarakan. (Contoh: ['Bali Eksotis 3H2M', 'Sewa Avanza', 'Konsultasi'])")
  }),
  func: async ({ active_topics }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return "Sistem tidak dapat mengidentifikasi konteks pelanggan.";
      }
      
      const topicsJson = JSON.stringify(active_topics || []);
      
      await db.lead.update({
        where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
        data: { active_topics: topicsJson }
      });
      
      return `[INTERNAL NOTE]: Active topics / Dynamic Notes berhasil diperbarui menjadi: ${topicsJson}. Jangan beri tahu pelanggan tentang pembaruan ini, lanjutkan percakapan natural.`;
    } catch (error) {
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 9. TOOL: UPDATE ORDER FORM (DYNAMIC FORM DATA)
 * Menyimpan data formulir pesanan secara reliable melalui function calling.
 * Menggantikan tag-based [ORDER_FORM_UPDATE] yang tidak reliable.
 */
const UpdateOrderFormTool = new DynamicStructuredTool({
  name: "update_order_form",
  description: "PANGGIL TOOL INI setiap kali pelanggan memberikan informasi yang cocok dengan field formulir pesanan (nama, email, nomor telepon, produk/layanan, jumlah, jadwal, catatan, request khusus, alamat, dll). WAJIB dipanggil LANGSUNG saat data terdeteksi dari pesan pelanggan — JANGAN menunggu atau menunda. Tool ini menyimpan data ke database secara permanen sehingga tidak perlu ditanyakan lagi.",
  schema: z.object({
    field_updates: z.record(z.string()).describe("Object berisi field_key dan nilainya yang ingin disimpan. Contoh: { 'nama': 'Budi Santoso', 'email': 'budi@gmail.com', 'no_telp': '08123456789', 'jumlah': '4', 'jadwal': '23 Juni 2026', 'produk': 'Paket Premium' }. Gunakan field_key yang persis sama dengan yang ada di formulir."),
    customer_name: z.string().optional().describe("Nama pelanggan jika terdeteksi dari percakapan (untuk update data lead juga)")
  }),
  func: async ({ field_updates, customer_name }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return JSON.stringify({ status: "error", message: "Context tidak tersedia" });
      }

      // Guard: AI sometimes sends field_updates as null/undefined
      if (!field_updates || (typeof field_updates === 'object' && Object.keys(field_updates).length === 0)) {
        return JSON.stringify({ status: "error", message: "field_updates kosong. Berikan field yang ingin diupdate, misalnya: { nama: 'Budi', email: 'budi@gmail.com' }" });
      }

      // Save to order form
      await orderFormService.updateFormField(context.tenantId, context.phone, field_updates);

      // Also update lead name if provided — but GUARD against push_name
      if (customer_name) {
        try {
          const leadForName = await db.lead.findUnique({
            where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
            select: { push_name: true }
          });
          const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const isPushName = leadForName?.push_name && normalize(customer_name) === normalize(leadForName.push_name);
          if (!isPushName) {
            await db.lead.update({
              where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
              data: { saved_name: customer_name }
            });
          } else {
            console.log(`[Tool:UpdateOrderForm] BLOCKED saved_name update — "${customer_name}" matches push_name`);
          }
        } catch (e) { /* non-critical */ }
      }

      const fields = Object.entries(field_updates).map(([k, v]) => `${k}=${v}`).join(', ');
      console.log(`[Tool:UpdateOrderForm] Saved for ${context.phone}: ${fields}`);

      return JSON.stringify({
        status: "success",
        message: `Data formulir berhasil disimpan: ${fields}. Jangan tanyakan field ini lagi ke pelanggan.`,
        saved_fields: Object.keys(field_updates)
      });
    } catch (error) {
      console.error('[Tool:UpdateOrderForm] Error:', error.message);
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 10. TOOL: CONFIRM ORDER FORM
 * Menggantikan tag [ORDER_FORM_CONFIRM]. Dipanggil setelah AI menampilkan ringkasan dan customer setuju.
 */
const ConfirmOrderFormTool = new DynamicStructuredTool({
  name: "confirm_order_form",
  description: "PANGGIL TOOL INI setelah Anda menampilkan ringkasan formulir pesanan ke pelanggan DAN semua field wajib sudah terisi. Tool ini mengubah status form menjadi 'pending_confirm' agar admin bisa review. JANGAN panggil jika masih ada field wajib yang kosong.",
  schema: z.object({
    summary: z.string().describe("Ringkasan singkat data form yang sudah diisi (untuk log internal)")
  }),
  func: async ({ summary }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return JSON.stringify({ status: "error", message: "Context tidak tersedia" });
      }

      await orderFormService.setFormStatus(context.tenantId, context.phone, 'pending_confirm');
      console.log(`[Tool:ConfirmOrderForm] Form set to pending_confirm for ${context.phone}. Summary: ${summary}`);

      return JSON.stringify({
        status: "success",
        message: "Form pesanan berhasil diubah ke status pending_confirm. Tampilkan ringkasan data ke pelanggan dan tanyakan apakah sudah benar."
      });
    } catch (error) {
      console.error('[Tool:ConfirmOrderForm] Error:', error.message);
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 11. TOOL: FINALIZE ORDER FORM
 * Menggantikan tag [ORDER_FORM_FINALIZE]. Dipanggil setelah customer mengkonfirmasi data sudah benar.
 */
const FinalizeOrderFormTool = new DynamicStructuredTool({
  name: "finalize_order_form",
  description: "PANGGIL TOOL INI HANYA setelah pelanggan secara EKSPLISIT mengkonfirmasi bahwa data pesanan sudah benar (misal: 'sudah benar', 'iya betul', 'ok lanjut'). Tool ini akan memproses form menjadi booking + transaksi + invoice. JANGAN panggil sebelum customer konfirmasi!",
  schema: z.object({
    confirmation_message: z.string().describe("Pesan konfirmasi dari customer (untuk audit log)")
  }),
  func: async ({ confirmation_message }, context) => {
    try {
      if (!context || !context.tenantId || !context.phone) {
        return JSON.stringify({ status: "error", message: "Context tidak tersedia" });
      }

      const result = await orderFormService.processConfirmedForm(context.tenantId, context.phone);
      if (result) {
        console.log(`[Tool:FinalizeOrderForm] Booking#${result.booking?.id} Trx#${result.transaction?.id} for ${context.phone}`);
        return JSON.stringify({
          status: "success",
          message: `Pesanan berhasil difinalisasi! Booking ID: ${result.booking?.id}, Transaction ID: ${result.transaction?.id}. Sampaikan ke pelanggan bahwa pesanan sedang diproses oleh admin.`,
          booking_id: result.booking?.id,
          transaction_id: result.transaction?.id
        });
      }
      return JSON.stringify({ status: "error", message: "Tidak ada form aktif yang bisa difinalisasi." });
    } catch (error) {
      console.error('[Tool:FinalizeOrderForm] Error:', error.message);
      return JSON.stringify({ status: "error", message: error.message });
    }
  },
});

/**
 * 12. TOOL: REQUEST ADMIN GUIDANCE (menggantikan tag [CENTRAL_INFO_REQUEST:])
 * Dipanggil ketika AI tidak bisa menjawab karena info tidak ada di KB.
 */
const RequestAdminGuidanceTool = new DynamicStructuredTool({
  name: "request_admin_guidance",
  description: "WAJIB DIPANGGIL ketika AI tidak bisa menjawab pertanyaan customer karena informasi BENAR-BENAR TIDAK ADA di Knowledge Base atau deskripsi paket. Tool ini mengirim notifikasi ke System Guider agar admin bisa memberikan arahan. JANGAN panggil jika jawaban sudah tersedia di KB! WAJIB MUTLAK isi question_summary dengan kalimat lengkap dan jelas yang merangkum APA yang customer butuhkan — admin harus bisa membaca dan langsung paham tanpa melihat chat.",
  schema: z.object({
    question_summary: z.string().min(20).describe("TULIS LAPORAN/KESIMPULAN LENGKAP untuk admin seolah-olah Anda menulis memo internal. WAJIB mengikuti format ini: 'Customer [NAMA LENGKAP] meminta [APA YANG DIMINTA secara spesifik: jumlah pax, paket, tanggal, destinasi] untuk [KONTEKS: acara company/liburan keluarga/dll]. Informasi ini tidak tersedia di Knowledge Base karena [ALASAN SPESIFIK: harga untuk jumlah pax tersebut di luar tier yang ada/paket custom/dll]. Mohon berikan instruksi mengenai [APA YANG DIBUTUHKAN DARI ADMIN: harga khusus/ketersediaan/quotation].' DILARANG KERAS: mengutip mentah kata-kata customer, menulis fragment pendek, atau menulis kalimat generik. CONTOH BAGUS: 'Customer Rizky Mustafa meminta paket Bali Selatan & Ubud 4H3M untuk 43 pax dalam rangka acara company gathering. Harga untuk 43 pax tidak ada di pricelist (maksimal tier harga di KB hanya sampai 10 pax). Mohon berikan quotation harga khusus corporate untuk 43 pax beserta opsi hotel yang tersedia.'"),
    ai_notes: z.string().optional().describe("Konteks tambahan untuk admin: data form yang sudah terisi, preferensi customer, kondisi khusus, dll."),
    required_info_fields: z.array(z.object({
      key: z.string().describe("Nama field unik tanpa spasi, contoh: 'harga_bintang_3', 'ketersediaan_tanggal', 'minimal_pax'"),
      label: z.string().describe("Pertanyaan spesifik untuk admin, contoh: 'Harga total Bintang 3 untuk 57 pax', 'Apakah tanggal 22 Agustus tersedia?'")
    })).describe("WAJIB DIISI. Daftar pertanyaan/info spesifik yang admin perlu jawab. Buat minimal 1-3 field yang relevan dan spesifik sesuai konteks. Ini yang akan muncul sebagai form checklist di System Guider. Contoh untuk harga corporate: [{key:'harga_paket', label:'Harga total untuk 57 pax paket Bali 4H3M'}, {key:'hotel_tersedia', label:'Hotel bintang berapa yang tersedia?'}]")
  }),
  func: async ({ question_summary, ai_notes, required_info_fields }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";

      const lead = await db.lead.findUnique({
        where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
        select: { saved_name: true, first_name: true, last_name: true, push_name: true, chat_summary: true, preferences: true, email: true, company_name: true }
      });

      const customerName = lead?.saved_name || [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || null;

      // ── AI-Powered Summary Generator ──
      let safeQuestionSummary = (question_summary && question_summary.trim().length >= 40)
        ? question_summary.trim()
        : null;

      const needsAiSummary = !safeQuestionSummary
        || /bertanya:|meminta:/i.test(safeQuestionSummary)
        || (safeQuestionSummary.match(/\|/g) || []).length >= 2;

      if (needsAiSummary) {
        try {
          const recentChat = await db.chatHistory.findMany({
            where: { tenant_id: context.tenantId, user_phone: context.phone },
            orderBy: { created_at: 'desc' },
            take: 8,
            select: { role: true, message: true }
          });
          const chatContext = recentChat.reverse().map(m =>
            `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.message.substring(0, 150)}`
          ).join('\n');

          const { executeFastJsonAI } = await import('./logic.service.js');
          const aiSummary = await executeFastJsonAI(context.tenantId,
            `Kamu adalah AI yang membuat LAPORAN INTERNAL untuk admin. Baca percakapan dan buat KESIMPULAN jelas.

TUGAS: Buat laporan 2-3 kalimat:
1. SIAPA customer (nama + konteks)
2. APA yang diminta secara SPESIFIK
3. KENAPA AI tidak bisa menjawab
4. APA yang dibutuhkan dari admin

DATA CUSTOMER:
- Nama: ${customerName || context.phone}
- Perusahaan: ${lead?.company_name || 'Tidak diketahui'}
- Preferensi: ${lead?.preferences || 'Belum ada'}
${ai_notes ? `- Catatan AI: ${ai_notes}` : ''}

FORMAT: Memo internal singkat tapi informatif. JANGAN kutip kata customer mentah. JANGAN sertakan nomor telepon.
Output JSON: { "summary": "Laporan 2-3 kalimat..." }`,
            `PERCAKAPAN:\n${chatContext || '(tidak ada)'}${safeQuestionSummary ? `\n\nRingkasan awal: ${safeQuestionSummary}` : ''}`,
            [], 'tool_summarize'
          );

          if (aiSummary?.summary && aiSummary.summary.length > 20) {
            safeQuestionSummary = aiSummary.summary;
            console.log(`[Tool:RequestAdminGuidance] ✅ AI-generated summary: "${safeQuestionSummary.substring(0, 100)}"`);
          }
        } catch (aiErr) {
          console.warn('[Tool:RequestAdminGuidance] AI summary failed:', aiErr.message);
        }
      }

      // Ensure customer name is in the summary
      if (safeQuestionSummary && customerName && !safeQuestionSummary.includes(customerName)) {
        safeQuestionSummary = safeQuestionSummary.replace(/^Customer\s*/i, `Customer ${customerName} `);
      }

      // Final fallback
      if (!safeQuestionSummary || safeQuestionSummary.length < 20) {
        safeQuestionSummary = `Customer ${customerName || context.phone} memiliki pertanyaan yang tidak dapat dijawab AI dari Knowledge Base. Mohon cek riwayat chat untuk detail.`;
      }

      const contextSnippet = `Customer: ${customerName || context.phone}\nPertanyaan: ${safeQuestionSummary}${lead?.chat_summary ? `\nRingkasan chat: ${lead.chat_summary}` : ''}`;

      // Enrich aiNotes with order form data
      let fullNotes = ai_notes || null;
      try {
        const orderForm = await db.orderForm.findFirst({
          where: { tenant_id: context.tenantId, phone: context.phone, status: { in: ['collecting', 'pending_confirm'] } },
          orderBy: { updated_at: 'desc' }
        });
        if (orderForm) {
          const formData = JSON.parse(orderForm.form_data || '{}');
          const filled = Object.entries(formData).filter(([, v]) => v && v !== '');
          if (filled.length > 0) {
            const formNote = '📋 Data Form: ' + filled.map(([k, v]) => `${k}=${v}`).join(', ');
            fullNotes = fullNotes ? fullNotes + '\n' + formNote : formNote;
          }
        }
        if (lead?.email) fullNotes = (fullNotes ? fullNotes + '\n' : '') + `📧 Email: ${lead.email}`;
        if (lead?.preferences) fullNotes = (fullNotes ? fullNotes + '\n' : '') + `⭐ Preferensi: ${lead.preferences}`;
      } catch (e) { /* ignore */ }

      // Build structured required_info from fields provided by AI
      let requiredInfo = null;
      if (required_info_fields && required_info_fields.length > 0) {
        requiredInfo = required_info_fields.map(f => ({
          key: f.key,
          label: f.label,
          value: null,
          answered: false
        }));
      }

      const result = await centralInfoRequestService.createOrUpdateRequest(
        context.tenantId,
        context.phone,
        customerName,
        safeQuestionSummary,
        contextSnippet,
        fullNotes,
        requiredInfo
      );

      if (result) {
        console.log(`[Tool:RequestAdminGuidance] Request #${result.id} filed for ${context.phone}: ${safeQuestionSummary.substring(0, 80)}`);

        // ── Real-time broadcast to dashboard ──
        try {
          const { broadcast } = await import('../shared/sse.service.js');
          broadcast(context.tenantId, 'central_info_request_created', {
            id: result.id,
            phone: context.phone,
            consolidated: result.consolidated
          });
        } catch (sseErr) {
          console.warn('[Tool:RequestAdminGuidance] SSE broadcast failed:', sseErr.message);
        }

        return `[INTERNAL NOTE]: Pertanyaan customer telah DIKIRIM ke System Guider (Request #${result.id}). ⚠️ PENTING: Admin BELUM menjawab. DILARANG bilang "sudah mendapatkan konfirmasi" atau "paket tersedia". Sampaikan kepada customer bahwa kamu sedang mengkonfirmasi ke tim terkait dan minta mereka menunggu.`;
      }
      return "[INTERNAL NOTE]: Gagal membuat request ke System Guider, coba lagi nanti.";
    } catch (err) {
      console.error('[Tool:RequestAdminGuidance] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});


/**
 * 13. TOOL: UPDATE CRM PROFILE (menggantikan tag [UPDATE_INFO:])
 * Menyimpan informasi CRM pelanggan ke database secara reliable.
 */
const UpdateCrmProfileTool = new DynamicStructuredTool({
  name: "update_crm_profile",
  description: "PANGGIL SECARA RAHASIA di background setiap kali pelanggan menyebutkan informasi personal apapun: preferensi perjalanan, kota, email, jabatan, nama perusahaan, dll. Jangan beri tahu pelanggan tool ini dipanggil. Hanya isi field yang ada datanya — tidak perlu isi semua.",
  schema: z.object({
    email: z.string().optional().describe("Alamat email pelanggan"),
    preferences: z.string().optional().describe("Minat/preferensi perjalanan, contoh: 'Minat Bali, 2 pax dewasa'"),
    first_name: z.string().optional().describe("Nama depan pelanggan"),
    last_name: z.string().optional().describe("Nama belakang pelanggan"),
    city: z.string().optional().describe("Kota domisili pelanggan"),
    country: z.string().optional().describe("Negara pelanggan"),
    gender: z.string().optional().describe("Jenis kelamin: male/female/other"),
    birth_date: z.string().optional().describe("Tanggal lahir format YYYY-MM-DD"),
    personal_notes: z.string().optional().describe("Catatan personal: kondisi fisik, hobi, waktu bisa dihubungi, dll"),
    pipeline_status: z.string().optional().describe("Status pipeline: new_prospect, contacted, evaluation, closing, closed_won, closed_lost"),
    position_title: z.string().optional().describe("Jabatan/posisi pelanggan"),
    company_name: z.string().optional().describe("Nama perusahaan pelanggan"),
    industry: z.string().optional().describe("Jenis industri perusahaan"),
    company_size: z.string().optional().describe("Ukuran perusahaan, contoh: '1-10', '11-50', '51-200'"),
    lead_source: z.string().optional().describe("Sumber prospek: facebook_ads, google, referral, event, dll"),
    communication_preference: z.string().optional().describe("Preferensi komunikasi: whatsapp, email, phone"),
    former_services: z.string().optional().describe("Riwayat layanan/trip sebelumnya"),
    full_address: z.string().optional().describe("Alamat lengkap pelanggan"),
    linkedin_url: z.string().optional().describe("URL profil LinkedIn"),
    social_media: z.string().optional().describe("Username atau URL media sosial"),
    chat_summary: z.string().optional().describe("Ringkasan singkat konteks percakapan terkini")
  }),
  func: async (args, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";

      const allowedFields = ['email', 'preferences', 'chat_summary', 'first_name', 'last_name', 'position_title', 'company_name', 'industry', 'company_size', 'city', 'country', 'full_address', 'linkedin_url', 'social_media', 'gender', 'birth_date', 'lead_source', 'communication_preference', 'personal_notes', 'pipeline_status', 'former_services'];

      const updates = {};
      for (const [key, val] of Object.entries(args)) {
        if (allowedFields.includes(key) && val && val !== 'kosong' && val !== '-') {
          updates[key] = val;
        }
      }

      if (Object.keys(updates).length === 0) {
        return "[INTERNAL NOTE]: Tidak ada field valid yang perlu diupdate.";
      }

      // ── Type conversions for Prisma schema compatibility ──
      if (updates.birth_date) {
        try { updates.birth_date = new Date(updates.birth_date); if (isNaN(updates.birth_date)) delete updates.birth_date; }
        catch { delete updates.birth_date; }
      }
      if (updates.nps_score !== undefined) {
        const n = parseInt(updates.nps_score, 10);
        if (!isNaN(n) && n >= 0 && n <= 10) updates.nps_score = n;
        else delete updates.nps_score;
      }

      await db.lead.update({
        where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
        data: updates
      });

      const updatedFields = Object.keys(updates).join(', ');
      console.log(`[Tool:UpdateCrmProfile] Updated for ${context.phone}: ${updatedFields}`);
      return `[INTERNAL NOTE]: Profil CRM berhasil diperbarui (${updatedFields}). Lanjutkan percakapan secara natural.`;
    } catch (err) {
      console.error('[Tool:UpdateCrmProfile] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * 14. TOOL: UPDATE CUSTOMER NAME (menggantikan tag [UPDATE_NAME:])
 * Dipanggil saat pelanggan memberitahukan nama mereka.
 */
const UpdateCustomerNameTool = new DynamicStructuredTool({
  name: "update_customer_name",
  description: "PANGGIL LANGSUNG dan RAHASIA ketika pelanggan memberitahukan nama mereka atau mengoreksi nama yang salah. Simpan ke database CRM agar bisa dipanggil dengan nama yang benar di percakapan berikutnya.",
  schema: z.object({
    full_name: z.string().describe("Nama lengkap pelanggan yang baru diketahui atau dikoreksi")
  }),
  func: async ({ full_name }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";
      const lead = await db.lead.findUnique({
        where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } }
      });
      if (!lead) return "[INTERNAL NOTE]: Lead tidak ditemukan, nama tidak bisa disimpan.";

      // ── GUARD: Jangan simpan push_name sebagai saved_name ──
      // AI sering salah mengira push_name (display name platform) adalah nama asli.
      // Tolak jika nama yang diberikan identik/mirip dengan push_name.
      if (lead.push_name) {
        const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalize(full_name) === normalize(lead.push_name)) {
          console.log(`[Tool:UpdateCustomerName] BLOCKED — name "${full_name}" matches push_name "${lead.push_name}". Not saving.`);
          return `[INTERNAL NOTE]: Nama "${full_name}" ADALAH display name platform (push_name), BUKAN nama asli pelanggan. JANGAN simpan ini. Tanyakan nama asli pelanggan secara natural dengan "Boleh tahu nama lengkapnya, Kak?".`;
        }
      }

      await handleNameExtraction(context.tenantId, lead, full_name);
      console.log(`[Tool:UpdateCustomerName] Name saved for ${context.phone}: ${full_name}`);
      return `[INTERNAL NOTE]: Nama pelanggan berhasil disimpan sebagai "${full_name}". PENTING: LANJUTKAN percakapan yang sedang berlangsung — JANGAN reset ke sapaan generik atau "ada yang bisa dibantu?". Panggil pelanggan dengan nama "${full_name}" dan lanjutkan topik yang sedang dibahas sebelumnya.`;
    } catch (err) {
      console.error('[Tool:UpdateCustomerName] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * 15. TOOL: MERGE LEAD (menggantikan tag [MERGE_LEAD:])
 * Dipanggil saat pelanggan mengkonfirmasi mereka adalah orang yang sama di platform lain.
 */
const MergeLeadTool = new DynamicStructuredTool({
  name: "merge_lead",
  description: "PANGGIL ketika pelanggan mengkonfirmasi bahwa mereka adalah orang yang sama yang sebelumnya menggunakan nomor/ID berbeda di platform lain. Akan menggabungkan riwayat percakapan mereka.",
  schema: z.object({
    old_phone: z.string().describe("Nomor WhatsApp lama atau ID platform lain yang perlu digabungkan ke profil aktif ini")
  }),
  func: async ({ old_phone }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";
      const lead = await db.lead.findUnique({
        where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } }
      });
      if (!lead) return "[INTERNAL NOTE]: Lead tidak ditemukan, merge tidak bisa dilakukan.";
      await handleLeadMerge(context.tenantId, lead, old_phone);
      console.log(`[Tool:MergeLead] Merged ${old_phone} → ${context.phone}`);
      return `[INTERNAL NOTE]: Lead dari ${old_phone} berhasil digabungkan ke profil aktif pelanggan ini.`;
    } catch (err) {
      console.error('[Tool:MergeLead] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * 16. TOOL: DEFER GUIDANCE REQUEST
 * Dipanggil ketika AI mendeteksi knowledge gap TETAPI perlu mengumpulkan data
 * customer terlebih dahulu (nama, preferensi, dll) sebelum mengirim ke admin.
 * AI WAJIB mengisi pre_fill dengan data yang SUDAH diketahui dari percakapan.
 */
const DeferGuidanceRequestTool = new DynamicStructuredTool({
  name: "defer_guidance_request",
  description: "Panggil tool ini ketika Anda mendeteksi pertanyaan customer yang TIDAK BISA dijawab dari Knowledge Base, TETAPI Anda masih perlu mengumpulkan data customer sebelum mengirim request ke admin. ⚠️ KRITIS: Jika customer SUDAH menyebutkan data tertentu dalam percakapan (nama, jumlah peserta, preferensi, dll), Anda WAJIB memasukkannya ke parameter 'pre_fill' agar data tersebut TIDAK ditanyakan ulang. Contoh: customer bilang '47 pax' → pre_fill: [{key: 'quantity', value: '47'}]. JANGAN biarkan pre_fill kosong jika ada data yang sudah diketahui!",
  schema: z.object({
    question_summary: z.string().min(20).describe("TULIS LAPORAN/KESIMPULAN LENGKAP untuk admin seolah-olah Anda menulis memo internal. WAJIB mengikuti format ini: 'Customer [NAMA LENGKAP] meminta [APA YANG DIMINTA secara spesifik: jumlah, produk/layanan, jadwal, spesifikasi] untuk [KONTEKS: acara/kebutuhan/dll]. Informasi ini tidak tersedia di Knowledge Base karena [ALASAN SPESIFIK: harga untuk jumlah tersebut di luar tier yang ada/produk custom/dll]. Mohon berikan instruksi mengenai [APA YANG DIBUTUHKAN DARI ADMIN: harga khusus/ketersediaan/quotation].' DILARANG KERAS: mengutip mentah kata-kata customer, menulis fragment pendek, atau menulis kalimat generik. CONTOH BAGUS: 'Customer Rizky Mustafa meminta Paket Premium untuk 43 unit dalam rangka acara corporate. Harga untuk 43 unit tidak ada di pricelist (maksimal tier harga di KB hanya sampai 10 unit). Mohon berikan quotation harga khusus corporate untuk 43 unit beserta opsi yang tersedia.'"),
    required_data: z.array(z.object({
      key: z.string().describe("Key unik field tanpa spasi: customer_name, email, preference, quantity, company_name, dll"),
      label: z.string().describe("Deskripsi readable: 'Nama lengkap customer', 'Preferensi produk/varian', dll")
    })).min(1).describe("Daftar data yang Anda perlukan untuk mengirim request yang lengkap ke admin. Minimal selalu sertakan customer_name."),
    pre_fill: z.array(z.object({
      key: z.string().describe("Key field yang SAMA PERSIS dengan key di required_data, contoh: 'quantity', 'customer_name'"),
      value: z.string().describe("Nilai yang SUDAH DIKETAHUI dari percakapan. Contoh: '47', 'Anwar Faturrahman', 'PT Maju Bersama'")
    })).optional().describe("⚠️ WAJIB DIISI jika customer SUDAH menyebutkan data terkait dalam percakapan! Jangan biarkan kosong jika ada info yang bisa diambil dari konteks chat. Contoh: customer bilang '47 pax untuk acara company' → pre_fill: [{key: 'quantity', value: '47'}, {key: 'purpose', value: 'acara company'}]"),
    admin_info_fields: z.array(z.object({
      key: z.string().describe("Nama field unik tanpa spasi, contoh: 'harga_produk', 'ketersediaan_stok', 'varian_tersedia'"),
      label: z.string().describe("Pertanyaan spesifik untuk admin yang perlu dijawab, contoh: 'Harga total 57 unit Paket Premium', 'Apakah varian ini tersedia?'")
    })).optional().describe("Daftar info spesifik yang perlu dijawab ADMIN (bukan customer). Ini akan muncul sebagai form checklist di System Guider. Isi jika sudah tahu info apa yang admin perlu berikan."),
    ai_notes: z.string().optional().describe("Catatan konteks tambahan: apa yang customer mau, produk/layanan yang dibahas, dll.")
  }),
  func: async ({ question_summary, required_data, pre_fill, admin_info_fields, ai_notes }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";

      // Load customer CRM data for context
      let customerDisplayName = context.phone;
      let customerPreferences = '';
      let customerCompany = '';
      try {
        const leadData = await db.lead.findUnique({
          where: { uk_tenant_phone: { tenant_id: context.tenantId, phone: context.phone } },
          select: { saved_name: true, first_name: true, last_name: true, preferences: true, company_name: true }
        });
        if (leadData) {
          customerDisplayName = leadData.saved_name || [leadData.first_name, leadData.last_name].filter(Boolean).join(' ') || context.phone;
          customerPreferences = leadData.preferences || '';
          customerCompany = leadData.company_name || '';
        }
      } catch {}

      // ── AI-Powered Summary Generator ──
      // Always use AI to generate a proper admin-facing report,
      // regardless of whether the model provided a question_summary or not.
      // This ensures consistent, high-quality reports.
      let safeQuestion = question_summary;
      
      const needsAiSummary = !safeQuestion 
        || typeof safeQuestion !== 'string' 
        || safeQuestion.trim().length < 40
        || /bertanya:|meminta:|berapa.*pax/i.test(safeQuestion) // raw customer text detected
        || (safeQuestion.match(/\|/g) || []).length >= 2; // concatenated messages

      if (needsAiSummary) {
        try {
          // Fetch recent conversation for context
          const recentChat = await db.chatHistory.findMany({
            where: { tenant_id: context.tenantId, user_phone: context.phone },
            orderBy: { created_at: 'desc' },
            take: 8,
            select: { role: true, message: true }
          });
          const chatContext = recentChat.reverse().map(m => 
            `${m.role === 'user' ? 'Customer' : 'AI'}: ${m.message.substring(0, 150)}`
          ).join('\n');

          const { executeFastJsonAI } = await import('./logic.service.js');
          const aiSummary = await executeFastJsonAI(context.tenantId,
            `Kamu adalah AI yang membuat LAPORAN INTERNAL untuk admin. Baca percakapan di bawah dan buat KESIMPULAN yang jelas.

TUGAS: Buat laporan 2-3 kalimat yang menjelaskan:
1. SIAPA customer ini (nama + konteks: perusahaan/perorangan)
2. APA yang mereka minta secara SPESIFIK (jumlah pax, paket, destinasi, tanggal, dll)
3. KENAPA AI tidak bisa menjawab (data tidak ada di KB, di luar pricelist, perlu quotation khusus, dll)
4. APA yang dibutuhkan dari admin (instruksi harga, ketersediaan, quotation, dll)

DATA CUSTOMER:
- Nama: ${customerDisplayName}
- Perusahaan: ${customerCompany || 'Tidak diketahui'}
- Preferensi: ${customerPreferences || 'Belum ada'}
${ai_notes ? `- Catatan AI: ${ai_notes}` : ''}

FORMAT: Tulis seperti memo internal yang singkat tapi informatif. JANGAN kutip kata-kata customer mentah. JANGAN sertakan nomor telepon.

Output JSON: { "summary": "Laporan 2-3 kalimat..." }`,
            `PERCAKAPAN:\n${chatContext || '(tidak ada riwayat)'}${safeQuestion ? `\n\nRingkasan awal dari AI: ${safeQuestion}` : ''}`,
            [], 'tool_summarize'
          );

          if (aiSummary?.summary && aiSummary.summary.length > 20) {
            safeQuestion = aiSummary.summary;
            console.log(`[Tool:DeferGuidanceRequest] ✅ AI-generated summary: "${safeQuestion.substring(0, 100)}"`);
          }
        } catch (aiErr) {
          console.warn('[Tool:DeferGuidanceRequest] AI summary generation failed:', aiErr.message);
        }
      }

      // Ensure customer name is in the summary
      if (safeQuestion && customerDisplayName !== context.phone && !safeQuestion.includes(customerDisplayName)) {
        safeQuestion = safeQuestion.replace(/^Customer\s*/i, `Customer ${customerDisplayName} `);
      }

      // Final fallback if AI summary also failed
      if (!safeQuestion || safeQuestion.length < 20) {
        safeQuestion = `Customer ${customerDisplayName} memiliki pertanyaan yang tidak dapat dijawab AI dari Knowledge Base. Mohon cek riwayat chat untuk detail dan berikan instruksi.`;
      }

      // Defensive: ensure required_data is a valid array
      let safeRequiredData = required_data;
      if (!Array.isArray(safeRequiredData) || safeRequiredData.length === 0) {
        safeRequiredData = [{ key: 'customer_name', label: 'Nama lengkap customer' }];
      }

      // Build admin_info_fields for System Guider form
      const safeAdminFields = Array.isArray(admin_info_fields) && admin_info_fields.length > 0
        ? admin_info_fields
        : null;

      console.log(`[Tool:DeferGuidanceRequest] Called for ${context.phone}: question="${safeQuestion.substring(0, 80)}" | required_data: ${safeRequiredData.length} field(s) | admin_fields: ${safeAdminFields?.length || 0}`);

      const result = await deferredGuidance.createIntent(
        context.tenantId,
        context.phone,
        safeQuestion,
        safeRequiredData,
        ai_notes,
        safeAdminFields
      );

      if (result.autoExecuted) {
        return `[INTERNAL NOTE]: Semua data sudah tersedia! Request telah DIKIRIM ke System Guider (Request #${result.result?.id || '?'}). ⚠️ PENTING: Admin BELUM menjawab/mengkonfirmasi. DILARANG KERAS bilang "sudah mendapatkan konfirmasi" atau "paket tersedia" atau "siap dipesan". Yang BENAR: sampaikan ke customer bahwa Anda sedang mengkonfirmasi ke tim terkait dan minta mereka menunggu sebentar.`;
      }

      // ── Process pre_fill: AI menyetor data yang sudah diketahui dari percakapan ──
      // Ini adalah sumber utama data — langsung dari konteks konversasi, bukan CRM
      if (pre_fill && Array.isArray(pre_fill) && pre_fill.length > 0 && result.created) {
        console.log(`[Tool:DeferGuidanceRequest] Processing ${pre_fill.length} pre_fill entries from conversation context...`);
        for (const { key: pfKey, value: pfValue } of pre_fill) {
          if (pfKey && pfValue) {
            try {
              const collectResult = await deferredGuidance.collectData(context.tenantId, context.phone, pfKey, pfValue);
              if (collectResult.success) {
                console.log(`[Tool:DeferGuidanceRequest] ✅ Pre-filled from conversation: "${pfKey}" = "${pfValue}"`);
                if (collectResult.allCollected) {
                  return `[INTERNAL NOTE]: Semua data sudah terkumpul dari percakapan! Request telah otomatis dikirim ke System Guider (Request #${collectResult.requestId || '?'}). ⚠️ PENTING: Admin BELUM menjawab. DILARANG KERAS bilang "sudah mendapatkan konfirmasi". Katakan ke customer bahwa Anda sedang berkoordinasi dengan tim terkait, minta mereka menunggu sebentar.`;
                }
              }
            } catch (pfErr) {
              console.warn(`[Tool:DeferGuidanceRequest] Pre-fill failed for "${pfKey}":`, pfErr.message);
            }
          }
        }
      }

      // Re-check intent state after pre_fill processing
      const updatedIntent = await deferredGuidance.getIntent(context.tenantId, context.phone);
      const currentMissing = updatedIntent
        ? updatedIntent.requiredData.filter(f => !f.collected)
        : result.missingFields;
      const currentCollected = updatedIntent
        ? updatedIntent.requiredData.filter(f => f.collected)
        : result.intent.requiredData.filter(f => f.collected);

      const missingLabels = currentMissing.map(f => f.label).join(', ');
      const preFilledLabels = currentCollected.map(f => `${f.label}: ${(updatedIntent?.collectedValues?.[f.key]) || '?'}`).join(', ');

      let response = `[INTERNAL NOTE]: Rencana pengiriman ke admin telah disimpan di belakang layar.`;
      if (preFilledLabels) response += ` Data yang sudah tercatat: ${preFilledLabels}.`;
      if (missingLabels) {
        response += ` Anda MASIH PERLU menanyakan: ${missingLabels}. PENTING: Tanyakan HANYA data yang benar-benar belum disebutkan customer — JANGAN menanyakan ulang data yang sudah ada! Setelah semua data terkumpul, panggil tool "collect_deferred_data" untuk setiap jawaban customer.`;
      }
      return response;
    } catch (err) {
      console.error('[Tool:DeferGuidanceRequest] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * 17. TOOL: CANCEL DEFERRED GUIDANCE
 * Dipanggil ketika customer berubah pikiran / tidak jadi.
 */
const CancelDeferredGuidanceTool = new DynamicStructuredTool({
  name: "cancel_deferred_guidance",
  description: "Panggil tool ini jika customer membatalkan atau berubah pikiran tentang pertanyaan yang sebelumnya memerlukan konfirmasi ke admin. Ini akan menghapus rencana pengiriman yang tertunda.",
  schema: z.object({
    reason: z.string().optional().describe("Alasan pembatalan jika ada")
  }),
  func: async ({ reason }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";

      const existed = await deferredGuidance.cancelIntent(context.tenantId, context.phone);
      if (existed) {
        console.log(`[Tool:CancelDeferredGuidance] Cancelled for ${context.phone}${reason ? `: ${reason}` : ''}`);
        return `[INTERNAL NOTE]: Rencana pengiriman ke admin telah dibatalkan. Lanjutkan percakapan secara natural.`;
      }
      return `[INTERNAL NOTE]: Tidak ada rencana tertunda yang perlu dibatalkan.`;
    } catch (err) {
      console.error('[Tool:CancelDeferredGuidance] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * 17b. TOOL: COLLECT DEFERRED DATA
 * Dipanggil secara langsung ketika customer memberikan data yang kurang untuk deferred guidance.
 */
const CollectDeferredDataTool = new DynamicStructuredTool({
  name: "collect_deferred_data",
  description: "WAJIB DIPANGGIL segera setelah customer memberikan jawaban/informasi yang kurang untuk rencana pengiriman ke admin (deferred guidance). Contoh: Customer memberitahu preferensi yang diinginkan, jumlah peserta/kuantitas, atau jadwal. Tool ini akan langsung mencatat data tersebut dan jika semua data sudah lengkap, request akan otomatis dikirim ke admin.",
  schema: z.object({
    key: z.string().describe("Key unik field yang dicatat, harus persis atau mirip dengan field key yang ada di list ❌ rencana tertunda, contoh: 'preference', 'company_name', 'email'"),
    value: z.string().describe("Nilai/informasi yang diberikan oleh customer, contoh: 'Bintang 3', 'PT Maju Bersama', 'budi@gmail.com'")
  }),
  func: async ({ key, value }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return "Context tidak tersedia.";

      const result = await deferredGuidance.collectData(context.tenantId, context.phone, key, value);
      if (!result.success) {
        if (result.error === 'no_intent') {
          return `[INTERNAL NOTE]: GAGAL — Tidak ada rencana pengiriman tertunda (deferred intent) aktif untuk pelanggan ini.`;
        }
        return `[INTERNAL NOTE]: GAGAL — Key "${key}" tidak ditemukan di daftar data yang dibutuhkan. Daftar yang masih dibutuhkan: ${result.remaining.join(', ')}`;
      }

      if (result.allCollected) {
        return `[INTERNAL NOTE]: Sukses mencatat "${key}" = "${value}". SEMUA DATA SUDAH TERKUMPUL! Request telah otomatis dikirim ke System Guider (Request #${result.requestId || '?'}). ⚠️ PENTING: Admin BELUM menjawab. DILARANG KERAS bilang "sudah mendapatkan konfirmasi" atau "paket tersedia". Katakan ke customer bahwa data sudah dicatat dan Anda sedang berkoordinasi dengan tim terkait, minta mereka menunggu sebentar.`;
      }

      return `[INTERNAL NOTE]: Sukses mencatat "${key}" = "${value}". Data yang masih kurang dan WAJIB ditanyakan kembali ke customer: ${result.remaining.join(', ')}`;
    } catch (err) {
      console.error('[Tool:CollectDeferredData] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * TOOL: MARK TODO QUESTION ASKED
 * AI calls this tool right after it has asked the customer a todo question.
 * This marks the question as 'asked' in DB so we know AI is waiting for answer.
 */
const MarkTodoQuestionAskedTool = new DynamicStructuredTool({
  name: "mark_todo_question_asked",
  description: "PANGGIL TOOL INI SECARA RAHASIA setelah Anda menanyakan pertanyaan yang ada dalam daftar [PERTANYAAN YANG HARUS DITANYAKAN KE CUSTOMER]. Ini mencatat bahwa pertanyaan sudah disampaikan ke customer dan sistem sekarang menunggu jawaban. WAJIB dipanggil setiap kali Anda bertanya sesuai todo question.",
  schema: z.object({
    todo_id: z.number().describe("ID dari todo question yang sudah Anda tanyakan ke customer (dari daftar [PERTANYAAN YANG HARUS DITANYAKAN KE CUSTOMER])"),
    question_sent: z.string().describe("Kalimat pertanyaan yang persis Anda kirim ke customer")
  }),
  func: async ({ todo_id, question_sent }, context) => {
    try {
      if (!context?.tenantId) return "Context tidak tersedia.";

      await db.systemGuiderTodo.update({
        where: { id: todo_id },
        data: {
          status: 'asked',
          asked_at: new Date(),
          // Store actual question sent for reference
          ai_confirmation: question_sent
        }
      });

      broadcast(context.tenantId, 'guider_question_asked', {
        todo_id,
        question: question_sent,
        phone: context.phone
      });

      console.log(`[Tool:MarkTodoQuestionAsked] Todo #${todo_id} marked as 'asked' for ${context.phone}`);
      return `[INTERNAL NOTE]: Pertanyaan todo #${todo_id} berhasil dicatat sebagai sudah ditanyakan. Lanjutkan percakapan secara natural dan tunggu jawaban customer.`;
    } catch (err) {
      console.error('[Tool:MarkTodoQuestionAsked] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * TOOL: ANSWER TODO QUESTION
 * AI calls this when it detects the customer has answered a pending todo question.
 * This stores the answer and notifies admin via SSE + System Guider chat.
 */
const AnswerTodoQuestionTool = new DynamicStructuredTool({
  name: "answer_todo_question",
  description: "PANGGIL TOOL INI SECARA RAHASIA ketika Anda mendeteksi bahwa pesan customer adalah JAWABAN dari pertanyaan yang ada di daftar [PERTANYAAN YANG SUDAH DITANYAKAN — DETEKSI JAWABAN]. Jangan beri tahu customer bahwa jawaban mereka sedang dicatat. Tool ini otomatis meneruskan jawaban ke admin di balik layar.",
  schema: z.object({
    todo_id: z.number().describe("ID dari todo question yang dijawab customer (dari daftar [PERTANYAAN YANG SUDAH DITANYAKAN])"),
    customer_answer: z.string().describe("Jawaban customer, persis seperti yang mereka sampaikan (atau ringkasan singkat jika terlalu panjang)")
  }),
  func: async ({ todo_id, customer_answer }, context) => {
    try {
      if (!context?.tenantId) return "Context tidak tersedia.";

      // Load the todo to get request_id and question_text
      const todo = await db.systemGuiderTodo.findFirst({
        where: { id: todo_id, tenant_id: context.tenantId }
      });
      if (!todo) return `[INTERNAL NOTE]: Todo #${todo_id} tidak ditemukan.`;

      // Update todo with answer
      await db.systemGuiderTodo.update({
        where: { id: todo_id },
        data: {
          status: 'answered',
          customer_answer,
          executed_at: new Date()
        }
      });

      // Notify admin via System Guider chat as a system message
      await db.systemGuiderChat.create({
        data: {
          tenant_id: context.tenantId,
          request_id: todo.request_id,
          role: 'system',
          message: JSON.stringify({
            type: 'question_answered',
            todo_id,
            question: todo.question_text,
            answer: customer_answer
          }),
          message_type: 'question_answered'
        }
      });

      // Broadcast SSE for real-time notification
      broadcast(context.tenantId, 'guider_todo_answered', {
        todo_id,
        request_id: todo.request_id,
        question: todo.question_text,
        answer: customer_answer,
        phone: context.phone
      });

      console.log(`[Tool:AnswerTodoQuestion] Todo #${todo_id} answered: "${customer_answer.substring(0, 80)}" — request #${todo.request_id} notified`);
      return `[INTERNAL NOTE]: Jawaban customer berhasil dicatat dan admin telah dinotifikasi. Lanjutkan percakapan secara normal — tidak perlu memberitahu customer bahwa jawaban mereka sedang diteruskan ke admin.`;
    } catch (err) {
      console.error('[Tool:AnswerTodoQuestion] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * TOOL: ANSWER CM ITEM QUESTION
 * When a CmRequestItem has a pending_question and customer answers it,
 * AI calls this to store the answer and notify admin.
 */
const AnswerCmItemQuestionTool = new DynamicStructuredTool({
  name: "answer_cm_item_question",
  description: "PANGGIL TOOL INI SECARA RAHASIA ketika customer menjawab pertanyaan yang ada di daftar [PERTANYAAN CM ITEM — DETEKSI JAWABAN]. Tool ini menyimpan jawaban ke database dan memberitahu admin tanpa customer tahu.",
  schema: z.object({
    item_id: z.number().describe("ID dari CmRequestItem yang questionnya dijawab customer"),
    customer_answer: z.string().describe("Jawaban customer secara verbatim atau ringkasan singkat")
  }),
  func: async ({ item_id, customer_answer }, context) => {
    try {
      if (!context?.tenantId) return "Context tidak tersedia.";

      // Load item to get cm_id for notification
      const item = await db.cmRequestItem.findFirst({
        where: { id: item_id, tenant_id: context.tenantId }
      });
      if (!item) return `[INTERNAL NOTE]: Item #${item_id} tidak ditemukan.`;

      // Update item
      await db.cmRequestItem.update({
        where: { id: item_id },
        data: {
          question_answer: customer_answer,
          status: 'question_answered',
          updated_at: new Date()
        }
      });

      // Broadcast SSE so CM modal refreshes
      broadcast(context.tenantId, 'cm_item_updated', {
        cm_id: item.cm_id,
        item_id,
        status: 'question_answered',
        question: item.pending_question,
        answer: customer_answer
      });

      // Also push to CM chat as a system notification card
      await db.cmChat.create({
        data: {
          tenant_id: context.tenantId,
          cm_id: item.cm_id,
          role: 'system',
          message: JSON.stringify({
            type: 'question_answered',
            item_id,
            question: item.pending_question,
            answer: customer_answer,
            title: item.title
          }),
          message_type: 'question_answered'
        }
      });

      console.log(`[Tool:AnswerCmItemQuestion] Item #${item_id} (cm #${item.cm_id}) answered: "${customer_answer.substring(0, 80)}"`);
      return `[INTERNAL NOTE]: Jawaban customer untuk item "${item.title}" berhasil dicatat. Admin telah dinotifikasi di CM Copilot. Lanjutkan percakapan normal.`;
    } catch (err) {
      console.error('[Tool:AnswerCmItemQuestion] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

// ================================================================
// OPEN QUESTION TOOLS — Proactive follow-up answer detection
// ================================================================

/**
 * Tool: answer_open_question
 * AI calls this when customer answers one of the open questions from NEED_INFO_CARD follow-up.
 */
const AnswerOpenQuestionTool = new DynamicStructuredTool({
  name: 'answer_open_question',
  description: 'Catat jawaban customer untuk salah satu pertanyaan yang pernah ditanyakan (open question). Panggil ini saat customer menjawab pertanyaan dari follow-up sebelumnya.',
  schema: z.object({
    question_key: z.string().describe('Key pertanyaan yang dijawab (contoh: "company_name", "hotel_pref")'),
    answer: z.string().describe('Inti jawaban dari customer')
  }),
  func: async ({ question_key, answer }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return 'Context tidak tersedia.';

      const lead = await db.lead.findFirst({
        where: { tenant_id: context.tenantId, phone: context.phone },
        select: { id: true, open_questions: true }
      });
      if (!lead || !Array.isArray(lead.open_questions)) {
        return '[INTERNAL NOTE]: Tidak ada open questions aktif.';
      }

      const updated = lead.open_questions.map(q => {
        if (q.key === question_key && !q.answered) {
          return { ...q, answer, answered: true };
        }
        return q;
      });

      const found = updated.find(q => q.key === question_key);
      if (!found) return `[INTERNAL NOTE]: Key "${question_key}" tidak ditemukan di open questions.`;

      await db.lead.update({
        where: { id: lead.id },
        data: { open_questions: updated }
      });

      // Broadcast SSE for real-time updates
      broadcast(context.tenantId, 'open_question_answered', {
        phone: context.phone,
        key: question_key,
        answer,
        progress: `${updated.filter(q => q.answered).length}/${updated.length}`
      });

      const allAnswered = updated.every(q => q.answered);
      console.log(`[Tool:AnswerOpenQuestion] ${context.phone} key="${question_key}" = "${answer.substring(0, 80)}" | All done: ${allAnswered}`);

      if (allAnswered) {
        return `[INTERNAL NOTE]: Jawaban untuk "${question_key}" dicatat. SEMUA pertanyaan sudah terjawab (${updated.length}/${updated.length}). WAJIB panggil tool "complete_open_questions" SEKARANG.`;
      }
      return `[INTERNAL NOTE]: Jawaban untuk "${question_key}" dicatat. Progress: ${updated.filter(q => q.answered).length}/${updated.length} terjawab. Lanjutkan percakapan natural.`;
    } catch (err) {
      console.error('[Tool:AnswerOpenQuestion] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * Tool: complete_open_questions
 * AI calls this when ALL open questions have been answered.
 * Reports collected answers back to admin via System Guider.
 */
const CompleteOpenQuestionsTool = new DynamicStructuredTool({
  name: 'complete_open_questions',
  description: 'Panggil ini HANYA ketika SEMUA open questions sudah terjawab. Ini akan mengirim laporan jawaban ke admin melalui System Guider.',
  schema: z.object({
    summary: z.string().describe('Rangkuman singkat semua jawaban yang didapat dari customer')
  }),
  func: async ({ summary }, context) => {
    try {
      if (!context?.tenantId || !context?.phone) return 'Context tidak tersedia.';

      const lead = await db.lead.findFirst({
        where: { tenant_id: context.tenantId, phone: context.phone },
        select: { id: true, open_questions: true, personal_notes: true }
      });
      if (!lead || !Array.isArray(lead.open_questions) || lead.open_questions.length === 0) {
        return '[INTERNAL NOTE]: Tidak ada open questions untuk dilaporkan.';
      }

      const questions = lead.open_questions;
      const requestId = questions[0]?.request_id;

      // Build report
      const reportLines = questions.map(q => {
        const answerText = q.answered ? q.answer : '(Tidak dijawab)';
        return `- ${q.question}: ${answerText}`;
      }).join('\n');

      // Save to System Guider chat as AI report
      if (requestId) {
        await db.systemGuiderChat.create({
          data: {
            tenant_id: context.tenantId,
            request_id: requestId,
            role: 'system',
            message: `✅ Semua pertanyaan terjawab!\n\n${reportLines}\n\nRingkasan: ${summary}`,
            message_type: 'system'
          }
        });

        // Update todo status
        await db.systemGuiderTodo.updateMany({
          where: {
            tenant_id: context.tenantId,
            request_id: requestId,
            todo_type: 'need_info',
            status: 'awaiting_customer'
          },
          data: { status: 'info_received', result: summary, executed_at: new Date() }
        });

        // Update request status
        await db.centralInfoRequest.update({
          where: { id: requestId },
          data: { status: 'info_received', updated_at: new Date() }
        });

        // Broadcast SSE for dashboard notification
        broadcast(context.tenantId, 'open_questions_completed', {
          phone: context.phone,
          request_id: requestId,
          summary,
          answers: questions
        });
      }

      // Save to personal_notes for AI memory
      const note = `[Info dari customer ${new Date().toLocaleDateString('id-ID')}]: ${reportLines.substring(0, 500)}`;
      const existing = lead.personal_notes || '';
      await db.lead.update({
        where: { id: lead.id },
        data: {
          personal_notes: (existing ? existing + '\n' + note : note).substring(0, 2000),
          open_questions: [] // Clear open questions
        }
      });

      console.log(`[Tool:CompleteOpenQuestions] ${context.phone} — all ${questions.length} questions answered. Report sent to guider.`);
      return `[INTERNAL NOTE]: Laporan jawaban customer berhasil dikirim ke admin melalui System Guider. Open questions dibersihkan. Lanjutkan percakapan normal.`;
    } catch (err) {
      console.error('[Tool:CompleteOpenQuestions] Error:', err.message);
      return JSON.stringify({ error: err.message });
    }
  }
});

/**
 * DAFTAR SELURUH TOOLS YANG AKTIF
 * Export array ini untuk di-bind ke LangChain model.
 */
export const activeAITools = [
  CalculateExactPriceTool,
  CheckLiveAvailabilityTool,
  TrackOrderStatusTool,
  UpdateCustomerPreferenceTool,
  GenerateCustomerRequestTool,
  GenerateBargainOfferTool,
  CancelOrderRequestTool,
  UpdateActiveTopicsTool,
  UpdateOrderFormTool,
  ConfirmOrderFormTool,
  FinalizeOrderFormTool,
  UpdateCrmProfileTool,
  UpdateCustomerNameTool,
  MergeLeadTool,
  DeferGuidanceRequestTool,
  CancelDeferredGuidanceTool,
  CollectDeferredDataTool,
  // Todo Question tools
  MarkTodoQuestionAskedTool,
  AnswerTodoQuestionTool,
  AnswerCmItemQuestionTool,
  // Open Question tools (proactive follow-up)
  AnswerOpenQuestionTool,
  CompleteOpenQuestionsTool,
];

