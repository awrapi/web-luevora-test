import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Menjalankan Seeder Database...');

  // 1. Bersihkan Data (Secara berurutan untuk menghindari foreign key constraint errors)
  console.log('🧹 Membersihkan data lama...');
  
  // Analytics, Logs, Queues
  await prisma.customerStat.deleteMany({});
  await prisma.trafficSource.deleteMany({});
  await prisma.modeChangeLog.deleteMany({});
  await prisma.messageQueue.deleteMany({});
  await prisma.sessionManager.deleteMany({});
  
  // Travel specific
  await prisma.travelBooking.deleteMany({});
  await prisma.travelPackage.deleteMany({});

  // Rental specific
  await prisma.activeRental.deleteMany({});
  await prisma.rentalRequest.deleteMany({});
  await prisma.rentalUnit.deleteMany({});
  
  // Course specific
  await prisma.rescheduleRequest.deleteMany({});
  await prisma.dateRequest.deleteMany({});
  await prisma.customerSchedule.deleteMany({});
  await prisma.scheduleFollowupQueue.deleteMany({});
  await prisma.scheduleContact.deleteMany({});
  await prisma.schedule.deleteMany({});

  // Shared Core
  await prisma.customerServiceLabel.deleteMany({});
  await prisma.serviceLabel.deleteMany({});
  await prisma.globalSetting.deleteMany({});
  await prisma.bankAccount.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.knowledgeBase.deleteMany({});
  await prisma.chatHistory.deleteMany({});
  
  // Webhook Phone Mapping
  await prisma.tenantPhoneNumber.deleteMany({});

  // Base
  await prisma.lead.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.tenant.deleteMany({});

  const hashedPassword = await bcrypt.hash('password123', 10);

  // =========================================================================
  // 2. TENANT CREATION
  // =========================================================================
  console.log('🏢 Membuat Tenant...');
  
  const tenantCourse = await prisma.tenant.create({
    data: {
      client_slug: 'kampus-inggris',
      business_name: 'Kampus Inggris Official',
      business_type: 'course',
      owner_phone: '+6281234567890',
      owner_email: 'owner@kampusinggris.com',
      is_active: 1,
      users: {
        create: {
          name: 'Ahmad Course (Owner)',
          username: 'ahmadcourse',
          email: 'owner@ahmadcourse.com',
          password: hashedPassword,
          role: 'owner',
          is_active: 1,
          email_verified_at: new Date(),
        },
      },
    },
  });

  const tenantRental1 = await prisma.tenant.create({
    data: {
      client_slug: 'bali-rent-car',
      business_name: 'Bali Premium Rent Car',
      business_type: 'rental',
      owner_phone: '+6289876543210',
      owner_email: 'owner@balirentcar.com',
      is_active: 1,
      users: {
        create: {
          name: 'Wayan Putra (Owner)',
          username: 'wayanrent',
          email: 'owner@balirentcar.com',
          password: hashedPassword,
          role: 'owner',
          is_active: 1,
          email_verified_at: new Date(),
        },
      },
    },
  });

  const tenantRental2 = await prisma.tenant.create({
    data: {
      client_slug: 'bogor-rent-car',
      business_name: 'Bogor Rent Car',
      business_type: 'rental',
      owner_phone: '+6281234567890',
      owner_email: 'owner@bogorrentcar.com',
      is_active: 1,
      users: {
        create: {
          name: 'Budi Santoso (Owner)',
          username: 'budirent2',
          email: 'owner@bogorrentcar.com',
          password: hashedPassword,
          role: 'owner',
          is_active: 1,
          email_verified_at: new Date(),
        },
      },
    },
  });

  const tenantTravel = await prisma.tenant.create({
    data: {
      client_slug: 'pesona-travel',
      business_name: 'Pesona Indonesia Travel',
      business_type: 'travel',
      owner_phone: '+6281112223334',
      owner_email: 'owner@pesonatravel.com',
      is_active: 1,
      users: {
        create: {
          name: 'Sarah Travel (Owner)',
          username: 'sarahtravel',
          email: 'owner@pesonatravel.com',
          password: hashedPassword,
          role: 'owner',
          is_active: 1,
          email_verified_at: new Date(),
        },
      },
    },
  });

  const allTenants = [tenantCourse, tenantRental1, tenantRental2, tenantTravel];

  // =========================================================================
  // 2.5 PHONE NUMBER MAPPING (Central Webhook)
  // =========================================================================
  console.log('📱 Membuat Phone Number Mapping (Central Webhook)...');

  // Untuk testing: Sandbox Meta (+14155238886) di-map ke tenant pertama
  // Production: Setiap tenant punya nomor WA sendiri
  await prisma.tenantPhoneNumber.createMany({
    data: [
      { tenant_id: tenantCourse.id,  wa_number: '+14155238886', label: 'Meta Sandbox (Testing)', provider: 'meta', is_active: 1 },
      { tenant_id: tenantRental1.id, wa_number: '+6289876500001', label: 'Nomor WA Bali Rent', provider: 'meta', is_active: 1 },
      { tenant_id: tenantRental2.id, wa_number: '+6289876500002', label: 'Nomor WA Bogor Rent', provider: 'meta', is_active: 1 },
      { tenant_id: tenantTravel.id,  wa_number: '+6289876500003', label: 'Nomor WA Travel', provider: 'meta', is_active: 1 },
    ]
  });



  // =========================================================================
  // 3. SHARED TABLES (For all tenants)
  // =========================================================================
  console.log('🌐 Membuat Data Shared (Leads, Settings, KB, Bank)...');
  
  for (const tenant of allTenants) {
    // 3.1 Leads
    await prisma.lead.createMany({
      data: [
        { tenant_id: tenant.id, phone: '+6285711112222', push_name: 'Rina', saved_name: 'Rina Pembeli', status: 'baru', label: 'potensial', traffic_source: 'Instagram Ads' },
        { tenant_id: tenant.id, phone: '+628199998888', push_name: 'Andi JKT', saved_name: null, status: 'follow_up', label: 'hot', traffic_source: 'Tiktok' },
        { tenant_id: tenant.id, phone: '+6281233334444', push_name: 'Siti', saved_name: 'Siti Customer', status: 'closing', label: 'member', traffic_source: 'Google Search' },
      ],
    });

    // 3.2 Global Settings
    await prisma.globalSetting.createMany({
      data: [
        { tenant_id: tenant.id, setting_key: 'ai_persona_sales', setting_value: `Kamu adalah asisten penjualan untuk ${tenant.business_name}. Tawarkan produk kami dengan ramah.` },
        { tenant_id: tenant.id, setting_key: 'store_form_url', setting_value: 'https://checkout.example.com' },
      ],
    });

    // 3.3 Bank Accounts
    await prisma.bankAccount.createMany({
      data: [
        { tenant_id: tenant.id, bank_name: 'BCA', account_number: '1234567890', account_holder: tenant.business_name },
        { tenant_id: tenant.id, bank_name: 'Mandiri', account_number: '0987654321', account_holder: 'Owner' },
      ],
    });

    // 3.4 Knowledge Base (General Info)
    await prisma.knowledgeBase.createMany({
      data: [
        { tenant_id: tenant.id, type: 'custom_info', title: 'Alamat Kantor', content_text: 'Jalan Raya No 1, Jakarta', ai_context: 'Gunakan ini jika ditanya alamat.' },
        { tenant_id: tenant.id, type: 'custom_info', title: 'Jam Operasional', content_text: '08:00 - 17:00 Senin sampai Jumat.', ai_context: 'Gunakan ini jika ditanya jam buka.' },
      ],
    });

    // 3.5 Chat History (Mocking some messages)
    await prisma.chatHistory.createMany({
      data: [
        { tenant_id: tenant.id, user_phone: '+6285711112222', role: 'user', message: 'Halo kak, apakah buka hari ini?' },
        { tenant_id: tenant.id, user_phone: '+6285711112222', role: 'assistant', message: 'Halo kak! Ya kami buka dari 08:00 sampai 17:00.' },
      ],
    });

    // 3.6 Transactions
    await prisma.transaction.createMany({
      data: [
        { tenant_id: tenant.id, order_id: `TRX-${tenant.id}-1`, user_phone: '+6281233334444', customer_name: 'Siti', destination: 'Produk A', total_price: 150000, status: 'pending' },
        { tenant_id: tenant.id, order_id: `TRX-${tenant.id}-2`, user_phone: '+628199998888', customer_name: 'Andi JKT', destination: 'Produk B', total_price: 250000, status: 'approved' },
      ],
    });

    // 3.7 Session Manager
    await prisma.sessionManager.create({
      data: { tenant_id: tenant.id, session_id: `session_${tenant.id}`, status: 'connected', phone_number: tenant.owner_phone }
    });

    // 3.8 Service Labels
    const serviceLabel = await prisma.serviceLabel.create({
      data: { tenant_id: tenant.id, label_name: 'VIP Customer', label_slug: 'vip-customer', color: 'bg-yellow-500' }
    });
    
    // 3.9 Customer Service Labels
    await prisma.customerServiceLabel.create({
      data: { tenant_id: tenant.id, phone: '+6281233334444', label_id: serviceLabel.id }
    });
  }

  // =========================================================================
  // 4. COURSE SPECIFIC (Tenant 1)
  // =========================================================================
  console.log('📅 Membuat Data Course (Schedule, dll)...');
  const schedule1 = await prisma.schedule.create({
    data: {
      tenant_id: tenantCourse.id,
      title: 'Webinar Jago Bahasa Inggris',
      schedule_date: new Date(new Date().setDate(new Date().getDate() + 3)),
      schedule_time: '19:00',
      max_capacity: 100,
      current_booked: 15,
      description: 'Webinar gratis cara cepat mahir bahasa Inggris tanpa grammar ribet.',
      status: 'active',
      contacts: {
        create: [
          { tenant_id: tenantCourse.id, phone: '+6285711112222', name: 'Rina', status: 'pending' },
        ],
      },
      followups: {
        create: [
          { tenant_id: tenantCourse.id, phone: '+6285711112222', name: 'Rina', message: 'Jangan lupa hadir ya kak besok!', status: 'pending' }
        ]
      }
    },
  });

  await prisma.customerSchedule.create({
    data: {
      tenant_id: tenantCourse.id,
      phone: '+6281233334444',
      customer_name: 'Siti',
      service_label: 'TOEFL Preparation',
      schedule_date: new Date(),
      schedule_id: schedule1.id,
      status: 'active'
    }
  });

  await prisma.dateRequest.create({
    data: {
      tenant_id: tenantCourse.id,
      phone: '+628199998888',
      name: 'Andi JKT',
      requested_date_raw: 'Besok',
      status: 'pending'
    }
  });

  // =========================================================================
  // 5. RENTAL SPECIFIC (Tenant 2 & 3)
  // =========================================================================
  console.log('🚗 Membuat Data Rental (Units, Requests, Active)...');
  
  for (const rentalTenant of [tenantRental1, tenantRental2]) {
    const unit1 = await prisma.rentalUnit.create({
      data: {
        tenant_id: rentalTenant.id,
        unit_name: 'Toyota Avanza 2022',
        unit_type: 'MPV',
        plate_number: 'B 1234 CDE',
        price_per_day: 350000,
        status: 'available',
      }
    });

    const unit2 = await prisma.rentalUnit.create({
      data: {
        tenant_id: rentalTenant.id,
        unit_name: 'Honda Brio 2023',
        unit_type: 'City Car',
        plate_number: 'B 5678 FGH',
        price_per_day: 250000,
        status: 'rented',
        current_renter_phone: '+6281233334444'
      }
    });

    const rentalReq = await prisma.rentalRequest.create({
      data: {
        tenant_id: rentalTenant.id,
        phone: '+6285711112222',
        name: 'Rina',
        unit_type: 'City Car',
        start_date: new Date(),
        duration_days: 3,
        status: 'pending',
      }
    });

    await prisma.activeRental.create({
      data: {
        tenant_id: rentalTenant.id,
        phone: '+6281233334444',
        name: 'Siti Customer',
        unit_id: unit2.id,
        unit_name: unit2.unit_name,
        start_date: new Date(),
        duration_days: 2,
        total_price: 500000,
        status: 'active'
      }
    });
  }

  // =========================================================================
  // 6. TRAVEL SPECIFIC (Tenant Travel)
  // =========================================================================
  console.log('✈️ Membuat Data Travel (Packages, Bookings)...');
  
  const package1 = await prisma.travelPackage.create({
    data: {
      tenant_id: tenantTravel.id,
      package_name: 'Bali Gateway 3D2N',
      destination: 'Bali',
      description: 'Nikmati liburan singkat namun berkesan di Bali, mengunjungi Kuta, Seminyak, dan Tanah Lot.',
      duration_days: 3,
      duration_nights: 2,
      price: 1500000,
      status: 'active',
    }
  });

  const package2 = await prisma.travelPackage.create({
    data: {
      tenant_id: tenantTravel.id,
      package_name: 'Explore Labuan Bajo 4D3N',
      destination: 'Labuan Bajo',
      description: 'Petualangan eksotis mengelilingi pulau-pulau indah di Labuan Bajo dan Pulau Komodo.',
      duration_days: 4,
      duration_nights: 3,
      price: 4500000,
      status: 'active',
    }
  });

  await prisma.travelBooking.create({
    data: {
      tenant_id: tenantTravel.id,
      phone: '+6285711112222',
      customer_name: 'Diana Kusuma',
      travel_package_id: package1.id,
      package_name: package1.package_name,
      pax_count: 2,
      departure_date: new Date(new Date().setDate(new Date().getDate() + 14)), // 14 days from now
      return_date: new Date(new Date().setDate(new Date().getDate() + 16)),
      total_price: 3000000,
      status: 'confirmed',
      payment_status: 'paid',
    }
  });

  await prisma.travelBooking.create({
    data: {
      tenant_id: tenantTravel.id,
      phone: '+628199998888',
      customer_name: 'Fahri Hamzah',
      travel_package_id: package2.id,
      package_name: package2.package_name,
      pax_count: 4,
      departure_date: new Date(new Date().setDate(new Date().getDate() + 30)),
      return_date: new Date(new Date().setDate(new Date().getDate() + 33)),
      total_price: 18000000,
      status: 'pending',
      payment_status: 'unpaid',
    }
  });

  console.log('✅ Seeding database berhasil diselesaikan!');
}

main()
  .catch((e) => {
    console.error('❌ Gagal menjalankan seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🔌 Koneksi Prisma ditutup.');
  });
