/**
 * Seed Script: 5 Paket Tour Advance Dummy dengan setting beragam
 * Run: node scripts/seed_advance_packages.mjs
 */

import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TENANT_ID = 11;

async function main() {
  console.log('🌱 Seeding 5 dummy advance packages...\n');

  // Bersihkan data lama untuk tenant ini (opsional, tapi disarankan)
  await prisma.advancedTravelPackage.deleteMany({
    where: { tenant_id: TENANT_ID }
  });
  console.log('🧹 Data lama berhasil dihapus.\n');

  // ========================================================
  // PAKET 1: Bali Eksotis 3H2M — Full featured (sub-items, addons, availability rules, slot limits)
  // Shared Availability = BUKA, Shared Slot = BUKA (Inherit)
  // ========================================================
  const pkg1 = await prisma.advancedTravelPackage.create({
    data: {
      tenant_id: TENANT_ID,
      package_type: 'private',
      title: 'Bali Eksotis & Nusa Penida 3H2M',
      description: 'Paket private tour Bali paling lengkap 3 Hari 2 Malam! Jelajahi keindahan Nusa Penida (termasuk tiket snorkeling, kunjungan ke Kelingking Beach, dan Angel Billabong). Trip ini juga termasuk kunjungan ke Uluwatu untuk menonton Kecak Dance saat sunset, dan cultural trip ke Ubud (Tegallalang Rice Terrace & Monkey Forest). Paket ini sangat cocok untuk pasangan, keluarga kecil, atau solo traveler. Harga sudah include penginapan hotel, transportasi mobil AC, dan guide lokal berbahasa Indonesia/Inggris.',
      has_sub_items: 1,
      context_description: '',
      ai_summary: '',
      validity_type: 'expiry_date',
      expiry_date: new Date('2026-12-31'),
      availability_type: 'configured',
      slot_mode: 'configured',
      slot_daily: 5,
      slot_total: 200,
      slot_used_total: 12,
      status: 'active',
    }
  });
  console.log(`✅ Paket 1: ${pkg1.title} (ID: ${pkg1.id})`);

  // Sub-items for Paket 1
  const sub1a = await prisma.advancedPackageSubItem.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg1.id,
      title: 'Reguler',
      description: 'Pilihan Reguler: Menggunakan akomodasi hotel bintang 3 yang nyaman di area Kuta/Legian. Transportasi menggunakan mobil Avanza atau Innova full AC. Termasuk makan 3x sehari di restoran lokal pilihan, dan didampingi oleh guide profesional berbahasa Indonesia yang ramah.',
      price: 2500000,
      sort_order: 1,
      context_description: '',
      ai_summary: '',
      slot_mode: 'inherit',
      availability_type: 'inherit',
      status: 'active',
    }
  });

  const sub1b = await prisma.advancedPackageSubItem.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg1.id,
      title: 'VVIP Experience',
      description: 'Pilihan VVIP Premium: Menginap di Private Villa mewah dengan infinity pool di Seminyak. Perjalanan ke Nusa Penida menggunakan speed boat eksklusif (bukan kapal umum). Termasuk private guide bilingual (Inggris-Indonesia), layanan priority booking di semua destinasi, dan pengalaman fine dining romantis di restoran bintang lima pada malam terakhir.',
      price: 5000000,
      sort_order: 2,
      context_description: '',
      ai_summary: '',
      slot_mode: 'configured',
      slot_daily: 2,
      slot_total: 50,
      availability_type: 'inherit',
      status: 'active',
    }
  });
  console.log(`   └─ Sub: ${sub1a.title} (Rp 2.5jt), ${sub1b.title} (Rp 5jt)`);

  // Addons for Paket 1
  const addon1a = await prisma.advancedPackageAddon.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg1.id,
      title: 'Sewa Drone DJI Mini 3',
      description: 'Dokumentasi aerial profesional sepanjang trip menggunakan Drone DJI Mini 3 Pro. Diterbangkan langsung oleh pilot bersertifikat BSKAI. Hasil dokumentasi berupa 50+ foto aerial resolusi tinggi dan 3 buah video cinematic resolusi 4K yang sudah diedit. Baterai cadangan sudah tersedia sehingga siap merekam momen kapan saja.',
      price: 500000,
      is_free: 0,
      context_description: '',
      ai_summary: '',
      sort_order: 1,
      status: 'active',
    }
  });

  const addon1b = await prisma.advancedPackageAddon.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg1.id,
      title: 'Upgrade Hotel Bintang 5',
      description: 'Upgrade akomodasi Anda dari hotel bintang 3 menjadi hotel bintang 5 (Pilihan: The Mulia Bali, Ayana Resort, atau hotel setara). Harga sudah termasuk fasilitas sarapan pagi (breakfast buffet internasional) sepuasnya dan bebas akses ke seluruh fasilitas eksklusif hotel seperti spa, gym, dan private beach.',
      price: 1500000,
      is_free: 0,
      context_description: '',
      ai_summary: '',
      sort_order: 2,
      status: 'active',
    }
  });
  console.log(`   └─ Addons: ${addon1a.title}, ${addon1b.title}`);

  // Availability rules for Paket 1 (blocked on Mondays and Nyepi)
  await prisma.packageAvailabilityRule.createMany({
    data: [
      { tenant_id: TENANT_ID, package_id: pkg1.id, rule_type: 'every_day_of_week', rule_value: 'monday', is_unavailable: 1 },
      { tenant_id: TENANT_ID, package_id: pkg1.id, rule_type: 'specific_date', rule_value: '2026-03-19', is_unavailable: 1 }, // Nyepi
    ]
  });

  // Price overrides for Paket 1 (peak season July)
  await prisma.packagePriceOverride.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg1.id,
      sub_item_id: sub1a.id,
      override_date: new Date('2026-07-15'),
      override_price: 3000000,
      context: 'Harga peak season bulan Juli, kenaikan 20% dari harga normal.',
    }
  });

  // ========================================================
  // PAKET 2: Sunrise Bromo & Ijen 2H1M — Simple (no sub-items)
  // Konfirmasi Sistem ON, Always Ask Admin
  // ========================================================
  const pkg2 = await prisma.advancedTravelPackage.create({
    data: {
      tenant_id: TENANT_ID,
      package_type: 'private',
      title: 'Sunrise Bromo & Kawah Ijen 2H1M (On Request)',
      description: 'Paket adventure 2 Hari 1 Malam ke Gunung Bromo dan Kawah Ijen dengan titik keberangkatan dari Surabaya. Hari 1: Penjemputan malam hari menuju Bromo, menikmati sunrise di viewpoint Penanjakan, tour lautan pasir menggunakan Jeep 4WD, dan mendaki ke Kawah Bromo. Hari 2: Perjalanan dilanjutkan dengan trekking malam di Kawah Ijen untuk melihat fenomena blue fire yang sangat langka, lalu kembali ke Surabaya pada pagi hari. Harga sudah termasuk sewa Jeep, tiket masuk semua destinasi wisata, guide lokal, dan penginapan sederhana di area Ijen. Jadwal keberangkatan memerlukan konfirmasi admin terlebih dahulu karena keterbatasan unit Jeep.',
      price: 1800000,
      has_sub_items: 0,
      context_description: '',
      ai_summary: '',
      validity_type: 'always_on',
      availability_type: 'confirmation_required', // Force confirmation
      slot_mode: 'always_ask_admin', // Auto-forced
      status: 'active',
    }
  });
  console.log(`\n✅ Paket 2: ${pkg2.title} (ID: ${pkg2.id}) — No sub-items, Confirmation Required`);

  // 1 addon for Paket 2
  await prisma.advancedPackageAddon.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg2.id,
      title: 'Fotografer Profesional',
      description: 'Layanan fotografer profesional yang akan mendampingi Anda selama trip Bromo dan Ijen. Fotografer menggunakan kamera mirrorless Sony A7IV berkualitas tinggi. Anda akan mendapatkan lebih dari 100 foto yang sudah melewati proses editing warna dan pencahayaan (dikirim dalam 3 hari kerja via link Google Drive). Bonus tambahan: Anda juga akan mendapatkan 5 lembar foto yang dicetak langsung di ukuran 4R secara gratis sebagai kenang-kenangan.',
      price: 750000,
      is_free: 0,
      context_description: '',
      ai_summary: '',
      sort_order: 1,
      status: 'active',
    }
  });

  // ========================================================
  // PAKET 3: Labuan Bajo & Komodo 4H3M — Sub-items, slot per day, monthly availability
  // Shared Availability = TUTUP (Individual), Shared Slot = TUTUP (Individual)
  // ========================================================
  const pkg3 = await prisma.advancedTravelPackage.create({
    data: {
      tenant_id: TENANT_ID,
      package_type: 'private',
      title: 'Labuan Bajo & Komodo Island 4H3M',
      description: 'Eksplorasi surga tersembunyi Indonesia dengan trip Liveaboard 4 Hari 3 Malam di Labuan Bajo. Anda akan tinggal dan berlayar menggunakan kapal phinisi tradisional. Rute pelayaran meliputi: Berangkat dari pelabuhan Labuan Bajo, singgah di Pulau Kelor, melihat komodo langsung di habitat aslinya di Pulau Rinca, trekking menikmati pemandangan di Padar Island, bersantai di pasir merah muda Pink Beach, dan snorkeling bersama pari manta di Manta Point. Paket ini menawarkan 3 opsi akomodasi: Backpacker (kabin bersama), Premium (kabin privat untuk pasangan), dan Exclusive (sewa 1 kapal penuh untuk rombongan).',
      has_sub_items: 1,
      context_description: '',
      ai_summary: '',
      validity_type: 'expiry_date',
      expiry_date: new Date('2027-03-31'),
      availability_type: 'always', // Fallback, we will use individual config
      slot_mode: 'always_ready', // Fallback, we will use individual config
      status: 'active',
    }
  });
  console.log(`\n✅ Paket 3: ${pkg3.title} (ID: ${pkg3.id}) — 3 sub-items, Individual Calendar & Slots`);

  // Sub-items for Paket 3
  const pkg3_sub1 = await prisma.advancedPackageSubItem.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg3.id,
      title: 'Backpacker',
      description: 'Opsi Backpacker: Akomodasi menggunakan shared cabin (kabin berbagi yang diisi oleh 4 orang per kabin). Sangat cocok bagi budget traveler atau solo traveler yang ingin mencari teman baru. Harga sudah termasuk makan 3 kali sehari dengan menu masakan Indonesia rumahan, peminjaman alat snorkeling standar (masker & snorkel), dan didampingi guide lokal berbahasa Indonesia.',
      price: 3500000,
      sort_order: 1,
      context_description: '',
      ai_summary: '',
      slot_mode: 'configured',
      slot_daily: 15,
      availability_type: 'configured',
      status: 'active',
    }
  });
  
  const pkg3_sub2 = await prisma.advancedPackageSubItem.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg3.id,
      title: 'Premium',
      description: 'Opsi Premium: Akomodasi eksklusif menggunakan private cabin (1 kabin hanya untuk 2 orang, ideal untuk pasangan atau honeymoon). Fasilitas ditingkatkan dengan menu makan premium (fusion masakan Indonesia-Western), alat snorkeling kualitas profesional (merk Cressi) yang lebih nyaman, welcome drink saat kedatangan, dan pelayanan guide bilingual yang ramah.',
      price: 6000000,
      sort_order: 2,
      context_description: '',
      ai_summary: '',
      slot_mode: 'always_ask_admin', // Minta admin untuk private cabin
      availability_type: 'confirmation_required', // Jadwal juga minta konfirmasi
      status: 'active',
    }
  });

  const pkg3_sub3 = await prisma.advancedPackageSubItem.create({
    data: {
      tenant_id: TENANT_ID,
      package_id: pkg3.id,
      title: 'Exclusive Full Charter',
      description: 'Opsi Exclusive Full Charter: Sewa penuh 1 kapal phinisi mewah secara private khusus untuk rombongan Anda (maksimal kapasitas 12 orang). Harga yang tercantum adalah harga all-inclusive untuk satu kapal penuh. Anda bebas merancang custom menu makanan dengan private chef, rute destinasi yang fleksibel, waktu snorkeling atau diving (bagi yang bersertifikat) sepuasnya tanpa batasan waktu, serta free dekorasi khusus untuk merayakan honeymoon atau anniversary di atas kapal.',
      price: 45000000,
      sort_order: 3,
      context_description: '',
      ai_summary: '',
      slot_mode: 'configured',
      slot_daily: 1,
      slot_total: 30,
      availability_type: 'configured',
      status: 'active',
    }
  });

  // Availability for sub-items
  // Backpacker: every Friday only
  await prisma.packageAvailabilityRule.createMany({
    data: [
      { tenant_id: TENANT_ID, package_id: pkg3.id, sub_item_id: pkg3_sub1.id, rule_type: 'every_day_of_week', rule_value: 'friday', is_unavailable: 0 },
    ]
  });
  
  // Charter: Blocked on 1st of month
  await prisma.packageAvailabilityRule.createMany({
    data: [
      { tenant_id: TENANT_ID, package_id: pkg3.id, sub_item_id: pkg3_sub3.id, rule_type: 'every_day_of_month', rule_value: '1', is_unavailable: 1 },
    ]
  });


  // ========================================================
  // PAKET 4 (Lainnya): Sewa Motor Harian Bali — package_type: 'others', simple pricing
  // ========================================================
  const pkg4 = await prisma.advancedTravelPackage.create({
    data: {
      tenant_id: TENANT_ID,
      package_type: 'others',
      title: 'Sewa Motor Harian Bali',
      description: 'Layanan penyewaan sepeda motor harian di area Pulau Bali. Menawarkan berbagai unit motor matic populer seperti Honda Vario, PCX, dan Yamaha NMAX yang dirawat secara berkala. Setiap penyewaan unit sudah termasuk: 2 buah helm SNI, 2 pasang jas hujan ponco, dan STNK kendaraan asli. Syarat penyewaan sangat mudah: cukup titipkan identitas asli (KTP/Paspor) dan wajib memiliki SIM C. Kami melayani antar-jemput motor gratis (free delivery) ke hotel/villa Anda khusus di area Kuta, Seminyak, dan Legian. Minimal durasi sewa adalah 1 hari (24 jam), dan kami memberikan diskon khusus 10% untuk penyewaan selama 7 hari atau lebih.',
      price: 75000,
      has_sub_items: 1,
      context_description: '',
      ai_summary: '',
      validity_type: 'always_on',
      availability_type: 'always',
      slot_mode: 'configured',
      slot_daily: 10,
      slot_total: null,
      status: 'active',
    }
  });
  console.log(`\n✅ Paket 4 (Lainnya): ${pkg4.title} (ID: ${pkg4.id}) — type: others, 3 sub-items motor`);

  // Sub-items for Paket 4 (different motor types)
  await prisma.advancedPackageSubItem.createMany({
    data: [
      {
        tenant_id: TENANT_ID,
        package_id: pkg4.id,
        title: 'Honda Vario 125',
        description: 'Unit Honda Vario berkapasitas mesin 125 CC. Motor ini sangat hemat bahan bakar (irit bensin), bodinya yang ringan membuatnya sangat lincah untuk menyalip kemacetan kota, cocok digunakan oleh pemula maupun untuk keperluan jalan-jalan santai jarak dekat. Memiliki kapasitas tangki bensin 5.5 Liter.',
        price: 75000,
        sort_order: 1,
        context_description: '',
        ai_summary: '',
        slot_mode: 'configured',
        slot_daily: 5,
        slot_total: null,
        availability_type: 'inherit',
        status: 'active',
      },
      {
        tenant_id: TENANT_ID,
        package_id: pkg4.id,
        title: 'Honda PCX 160',
        description: 'Unit Honda PCX berkapasitas mesin 160 CC. Tergolong motor matic premium dengan desain elegan dan suspensi yang sangat empuk. Dilengkapi dengan kapasitas bagasi super besar (30 Liter) yang bisa menampung banyak barang belanjaan, serta USB charger di dashboard. Sangat stabil dan nyaman digunakan untuk perjalanan jarak jauh (touring) melintasi kabupaten.',
        price: 120000,
        sort_order: 2,
        context_description: '',
        ai_summary: '',
        slot_mode: 'configured',
        slot_daily: 3,
        slot_total: null,
        availability_type: 'inherit',
        status: 'active',
      },
      {
        tenant_id: TENANT_ID,
        package_id: pkg4.id,
        title: 'Yamaha NMAX 155',
        description: 'Unit Yamaha NMAX berkapasitas mesin 155 CC. Motor tipe sport-matic dengan posisi berkendara rileks yang disukai turis asing. Mesin ini dilengkapi teknologi VVA sehingga tarikannya sangat bertenaga besar, serta sistem pengereman ABS untuk keamanan. Sangat tangguh dan cocok digunakan untuk touring menanjak curam ke area pegunungan di Bali, seperti kawasan Kintamani atau Bedugul.',
        price: 130000,
        sort_order: 3,
        context_description: '',
        ai_summary: '',
        slot_mode: 'configured',
        slot_daily: 2,
        slot_total: null,
        availability_type: 'inherit',
        status: 'active',
      },
    ]
  });

  // ========================================================
  // PAKET 5: Tour Eropa Barat 10 Hari — Group Tour type
  // Set Slot per Tanggal ON (with require admin for some reason)
  // ========================================================
  const pkg5 = await prisma.advancedTravelPackage.create({
    data: {
      tenant_id: TENANT_ID,
      package_type: 'group',
      title: 'Eropa Barat (Paris, Swiss, Italia) 10 Hari',
      description: 'Paket Open Trip (grup tur gabungan) keliling Eropa Barat selama 10 hari yang diberangkatkan dari Jakarta. Rute dan destinasi ikonik yang akan dikunjungi meliputi: Kota romantis Paris di Perancis (mengunjungi Menara Eiffel dan Museum Louvre), pegunungan salju abadi Mt. Titlis di Swiss, hingga berkeliling 3 kota di Italia yaitu pusat mode Milan, kota kanal Venice, dan berakhir di bangunan bersejarah Colosseum di Roma. Perjalanan antar kota di Eropa akan dilakukan menggunakan bus pariwisata eksekutif yang sangat nyaman. Harga paket sudah mencakup semua kebutuhan dasar (all-in): Tiket penerbangan kelas ekonomi Pulang Pergi menggunakan maskapai kelas dunia (Emirates/Qatar Airways), biaya pengurusan Visa Schengen, penginapan di Hotel setara Bintang 4 selama di Eropa, makan 3 kali sehari dengan sistem full board, perlindungan Asuransi Perjalanan internasional komprehensif, dan tentunya didampingi penuh oleh Tour Leader profesional dan berpengalaman dari Jakarta yang siap memandu sejak di bandara keberangkatan. Minimal kuota keberangkatan adalah 20 pax.',
      price: 25000000,
      has_sub_items: 0,
      context_description: '',
      ai_summary: '',
      validity_type: 'expiry_date',
      expiry_date: new Date('2028-12-31'),
      availability_type: 'configured',
      slot_mode: 'configured',
      slot_daily: 40, // Max pax per departure
      slot_require_admin: 1, // Require admin review for passport/visa checking
      status: 'active',
    }
  });
  console.log(`\n✅ Paket 5 (Group): ${pkg5.title} (ID: ${pkg5.id}) — type: group, configured slots + require admin`);

  // Availability rules for Paket 5 (Specific Dates only)
  await prisma.packageAvailabilityRule.createMany({
    data: [
      { tenant_id: TENANT_ID, package_id: pkg5.id, rule_type: 'specific_date', rule_value: '2026-06-15', is_unavailable: 0 },
      { tenant_id: TENANT_ID, package_id: pkg5.id, rule_type: 'specific_date', rule_value: '2026-09-10', is_unavailable: 0 },
      { tenant_id: TENANT_ID, package_id: pkg5.id, rule_type: 'specific_date', rule_value: '2026-12-20', is_unavailable: 0 },
    ]
  });


  console.log('\n🎉 Seeding selesai! Ringkasan:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`1. Bali Eksotis 3H2M               │ private │ Sub-items (Shared Config), Addons, Date Configured`);
  console.log(`2. Bromo & Ijen 2H1M (On Request)  │ private │ No Sub-items, Confirmation Required (Always Ask Admin)`);
  console.log(`3. Labuan Bajo & Komodo 4H3M       │ private │ 3 Sub-items (Individual Config), Sub-item 2 is Confirmation Required`);
  console.log(`4. Sewa Motor Harian Bali          │ others  │ 3 Sub-items (motor types), Configured Slots`);
  console.log(`5. Eropa Barat 10 Hari             │ group   │ No Sub-items, Date Configured, Configured Slots (Admin Required)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(err => {
    console.error('❌ Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
