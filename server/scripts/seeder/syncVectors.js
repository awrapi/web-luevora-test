import 'dotenv/config';
import prisma from '../../config/database.js';
import { upsertDocument } from '../../services/ai_agent/vector.service.js';

/**
 * Script untuk memigrasikan/menyinkronkan seluruh data paket wisata dan KB
 * yang sudah ada di database MySQL ke Vector Database Redis.
 * Ini HANYA DILAKUKAN SATU KALI, atau setiap kali Redis Index dihapus.
 */
const syncVectors = async () => {
  console.log('=============================================');
  console.log('🚀 MEMULAI PROSES SINKRONISASI VECTOR DATABASE');
  console.log('=============================================');

  try {
    // 1. Sync Knowledge Base (SOP, FAQ, Policies)
    const kbs = await prisma.knowledgeBase.findMany();
    console.log(`\n📚 Ditemukan ${kbs.length} dokumen Knowledge Base.`);
    for (const kb of kbs) {
      const textRepresentation = `Judul: ${kb.title}\nTipe: ${kb.type}\nKonten: ${kb.content_text}\nKonteks Tambahan: ${kb.ai_context || ''}\nInfo Promo: ${kb.promo_context || ''}`;
      console.log(`Menyinkronkan KB ID ${kb.id}...`);
      await upsertDocument(kb.tenant_id, 'KnowledgeBase', kb.id, textRepresentation);
      // Jeda 200ms agar Ollama lokal tidak kewalahan
      await new Promise(r => setTimeout(r, 200));
    }

    // 2. Sync Basic Travel Packages
    const basicPackages = await prisma.travelPackage.findMany();
    console.log(`\n🏖️ Ditemukan ${basicPackages.length} dokumen Basic Travel Package.`);
    for (const pkg of basicPackages) {
      const textRepresentation = `Paket: ${pkg.package_name}\nKategori: ${pkg.category}\nDestinasi: ${pkg.destination}\nHarga: ${pkg.price}\nDeskripsi: ${pkg.description}\nTermasuk: ${pkg.inclusions}\nTidak Termasuk: ${pkg.exclusions}`;
      console.log(`Menyinkronkan Basic Package ID ${pkg.id}...`);
      await upsertDocument(pkg.tenant_id, 'TravelPackage', pkg.id, textRepresentation);
      await new Promise(r => setTimeout(r, 200));
    }

    // 3. Sync Advanced Travel Packages
    const advancedPackages = await prisma.advancedTravelPackage.findMany({
      include: {
        sub_items: true,
        addons: true
      }
    });
    console.log(`\n💎 Ditemukan ${advancedPackages.length} dokumen Advanced Travel Package.`);
    for (const pkg of advancedPackages) {
      let subItemsText = pkg.sub_items.map(s => `- ${s.title}: Rp ${s.price}`).join('\n');
      let addonsText = pkg.addons.map(a => `- ${a.title}: Rp ${a.price}`).join('\n');
      
      const textRepresentation = `Paket Advanced: ${pkg.title}\nTipe: ${pkg.package_type}\nDeskripsi: ${pkg.description}\nKonteks AI: ${pkg.context_description || ''}\nSub-Paket (Varian Harga):\n${subItemsText}\nAdd-ons:\n${addonsText}`;
      
      console.log(`Menyinkronkan Advanced Package ID ${pkg.id}...`);
      await upsertDocument(pkg.tenant_id, 'AdvancedTravelPackage', pkg.id, textRepresentation);
      await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n✅ PROSES SINKRONISASI SELESAI!');
  } catch (error) {
    console.error('\n❌ Gagal menyinkronkan data:', error);
  } finally {
    await prisma.$disconnect();
  }
};

syncVectors();
