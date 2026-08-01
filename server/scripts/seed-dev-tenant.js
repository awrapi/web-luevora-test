/**
 * Seed script — buat tenant travel agent untuk development
 * Run: node scripts/seed-dev-tenant.js
 */

import prisma from '../config/database.js';
import bcrypt from 'bcryptjs';

const SLUG     = 'dev-travel';
const EMAIL    = 'dev@luevora.internal';
const PASSWORD = 'DevTravel2024!';

async function main() {
  console.log('🌱 Seeding dev tenant...');

  // ── 1. Buat tenant ────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { client_slug: SLUG },
    update: {},
    create: {
      client_slug:          SLUG,
      business_name:        'Nusantara Travel Dev',
      business_type:        'travel',
      business_description: 'Akun development untuk testing Luevora AI — Travel Agent',
      owner_email:          EMAIL,
      owner_phone:          '628000000001',
      subscription_plan:    'development',
      subscription_status:  'active',
      is_active:            1,
    },
  });
  console.log(`✅ Tenant: ${tenant.business_name} (id=${tenant.id})`);

  // ── 2. Buat user admin ────────────────────────────────────────
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      tenant_id:          tenant.id,
      name:               'Dev Admin',
      email:              EMAIL,
      password:           hashed,
      role:               'admin',
      is_active:          1,
      email_verified_at:  new Date(),
    },
  });
  console.log(`✅ User: ${user.email} (id=${user.id})`);

  // ── 3. Inisialisasi AI credit (15.000 kredit) ─────────────────
  const credit = await prisma.tenantAiCredit.upsert({
    where: { tenant_id: tenant.id },
    update: {},
    create: {
      tenant_id:    tenant.id,
      credits_used: 0,
      credit_limit: 15000,
      is_active:    1,
    },
  });
  console.log(`✅ AI Credit: limit=${credit.credit_limit} kredit`);

  // ── 4. Persona AI (GlobalSetting) ────────────────────────────
  const persona = `Kamu adalah Naya, asisten AI dari Nusantara Travel — agen perjalanan yang spesialis paket wisata domestik dan internasional.

Karaktermu:
- Ramah, antusias, dan profesional
- Suka merekomendasikan destinasi berdasarkan preferensi pelanggan
- Selalu menawarkan paket terbaik sesuai budget pelanggan
- Berbicara dalam bahasa Indonesia yang santai namun tetap sopan

Keahlianmu:
- Paket tour domestik (Bali, Raja Ampat, Lombok, Labuan Bajo, dll)
- Paket tour internasional (Jepang, Eropa, Timur Tengah, dll)
- Honeymoon packages, family trip, group tour
- Custom itinerary dan private tour

Aturan penting:
- Selalu tanyakan tanggal keberangkatan, jumlah peserta, dan budget sebelum merekomendasikan paket
- Jangan memberikan harga yang tidak ada di knowledge base
- Jika tidak tahu, minta pelanggan menunggu dan escalate ke admin`;

  await prisma.globalSetting.upsert({
    where: { uk_tenant_setting: { tenant_id: tenant.id, setting_key: 'persona' } },
    update: { setting_value: persona },
    create: {
      tenant_id:     tenant.id,
      setting_key:   'persona',
      setting_value: persona,
    },
  });
  console.log('✅ Persona AI: Naya (Nusantara Travel)');

  // ── 4b. Aktifkan sandbox mode Zernio (nomor test) ────────────
  // Agar akun dev menggunakan shared sandbox number Zernio untuk testing WhatsApp
  // tanpa perlu mendaftarkan nomor WA produksi.
  await prisma.globalSetting.upsert({
    where: { uk_tenant_setting: { tenant_id: tenant.id, setting_key: 'zernio_sandbox_mode' } },
    update: { setting_value: 'true' },
    create: {
      tenant_id:     tenant.id,
      setting_key:   'zernio_sandbox_mode',
      setting_value: 'true',
    },
  });
  console.log('✅ Zernio: Sandbox mode AKTIF (nomor test shared Zernio)');

  // ── 5. Contoh knowledge base (3 paket wisata) ─────────────────
  const packages = [
    {
      type:         'travel_package',
      title:        'Paket Bali Romantic 4D3N',
      content_text: `Paket Bali Romantic 4D3N — Rp 3.500.000/pax (min 2 pax)

Itinerary:
Hari 1: Tiba Ngurah Rai → Check-in hotel Seminyak bintang 4 → Sunset di Tanah Lot
Hari 2: Ubud Tour (Tegallalang Rice Terrace, Monkey Forest, Ubud Palace) → Kintamani Volcano View
Hari 3: Nusa Penida Day Trip (Kelingking Beach, Angel's Billabong, Broken Beach)
Hari 4: Bebas / Shopping → Transfer Bandara

Fasilitas:
✅ Hotel bintang 4 (3 malam)
✅ Sarapan setiap hari
✅ Transport AC + driver lokal
✅ Guide berbahasa Indonesia
✅ Welcome drink & fruit basket
✅ Tiket masuk semua destinasi
✅ Snorkeling kit (Nusa Penida)

Tidak termasuk: Tiket pesawat, makan siang/malam, pengeluaran pribadi`,
      price:          3500000,
      original_price: 4200000,
      is_promo:       1,
      promo_context:  'Promo honeymoon & couple trip — diskon 17% dari harga normal',
    },
    {
      type:         'travel_package',
      title:        'Paket Raja Ampat Explorer 5D4N',
      content_text: `Paket Raja Ampat Explorer 5D4N — Rp 8.500.000/pax (min 4 pax)

Itinerary:
Hari 1: Sorong → Speedboat ke Raja Ampat → Check-in resort → Snorkeling perdana
Hari 2: Wayag Island Tour (view point ikonik) → Piaynemo
Hari 3: Misool Island → Snorkeling Coral Garden → Cave Exploration
Hari 4: Free diving & kayaking → Sunset di dermaga → Cultural night
Hari 5: Pagi bebas → Transfer Sorong → Pulang

Fasilitas:
✅ Resort 3 malam + homestay 1 malam (full board)
✅ Speedboat pp Sorong-Raja Ampat
✅ Semua aktivitas snorkeling & diving
✅ Guide lokal berpengalaman
✅ Makan 3x sehari (masakan lokal & seafood segar)
✅ Peralatan snorkeling

Tidak termasuk: Tiket pesawat ke/dari Sorong, visa, asuransi perjalanan`,
      price:          8500000,
      original_price: 8500000,
      is_promo:       0,
    },
    {
      type:         'travel_package',
      title:        'Paket Jepang Sakura 7D6N',
      content_text: `Paket Jepang Sakura Season 7D6N — Rp 22.000.000/pax (min 10 pax)

Itinerary:
Hari 1: Jakarta → Tokyo (Narita) → Check-in Hotel Shinjuku
Hari 2: Tokyo Sightseeing — Senso-ji, Harajuku, Shibuya, Tokyo Tower
Hari 3: Nikko Day Trip — Tosho-gu Shrine, Kegon Falls
Hari 4: Bullet Train Tokyo → Kyoto → Nishiki Market, Gion District
Hari 5: Kyoto — Fushimi Inari, Arashiyama Bamboo Grove, Kinkakuji
Hari 6: Kyoto → Osaka — Osaka Castle, Dotonbori, Shinsaibashi Shopping
Hari 7: Free shopping → Kansai Airport → Jakarta

Fasilitas:
✅ Tiket pesawat pp (GA/SQ)
✅ Hotel bintang 3-4 (6 malam)
✅ Sarapan setiap hari
✅ JR Pass 7 hari
✅ AC Bus + guide berbahasa Indonesia
✅ Tiket masuk semua destinasi
✅ Visa Jepang

Periode: Maret–April (Sakura Season) & November (Autumn)`,
      price:          22000000,
      original_price: 24500000,
      is_promo:       1,
      promo_context:  'Early bird discount — booking sebelum 30 Januari',
    },
  ];

  for (const pkg of packages) {
    await prisma.knowledgeBase.create({
      data: {
        tenant_id:      tenant.id,
        type:           pkg.type,
        title:          pkg.title,
        content_text:   pkg.content_text,
        price:          pkg.price,
        original_price: pkg.original_price,
        is_promo:       pkg.is_promo,
        promo_context:  pkg.promo_context || null,
      },
    });
    console.log(`  ✅ Paket: ${pkg.title}`);
  }

  // ── 6. Rekening bank ──────────────────────────────────────────
  await prisma.bankAccount.create({
    data: {
      tenant_id:      tenant.id,
      bank_name:      'BCA',
      account_number: '1234567890',
      account_holder: 'Nusantara Travel',
    },
  });
  console.log('✅ Bank: BCA 1234567890 a/n Nusantara Travel');

  console.log('\n🎉 Seeding selesai!');
  console.log('──────────────────────────────────');
  console.log(`   Tenant ID  : ${tenant.id}`);
  console.log(`   Slug       : ${SLUG}`);
  console.log(`   Email      : ${EMAIL}`);
  console.log(`   Password   : ${PASSWORD}`);
  console.log(`   Plan       : development (15.000 kredit)`);
  console.log('──────────────────────────────────');
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
