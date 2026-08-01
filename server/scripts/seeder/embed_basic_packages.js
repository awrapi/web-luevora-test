/**
 * Backfill Script: Embed all existing basic travel packages
 * into the document_chunks table for vector search (Deep RAG).
 * 
 * Usage: node embed_basic_packages.js
 */
import { PrismaClient } from '@prisma/client';
import { embeddingService } from './services/deep_rag_engine/embedding.service.js';

const prisma = new PrismaClient();

const main = async () => {
  console.log('=== Basic Package Embedding Backfill ===\n');

  // Get all tenants
  const tenants = await prisma.tenant.findMany({ select: { id: true, business_name: true } });
  console.log(`Found ${tenants.length} tenant(s)\n`);

  let totalEmbedded = 0;
  let totalFailed = 0;

  for (const tenant of tenants) {
    console.log(`--- Tenant: ${tenant.business_name || 'Unknown'} (ID: ${tenant.id}) ---`);

    const packages = await prisma.travelPackage.findMany({
      where: { tenant_id: tenant.id },
      select: {
        id: true,
        package_name: true,
        description: true,
        destination: true,
        category: true,
        price: true,
        min_pax: true,
        max_pax: true,
        inclusions: true,
        exclusions: true,
      }
    });

    console.log(`  Found ${packages.length} basic package(s)`);

    for (const pkg of packages) {
      try {
        const embeddingText = [
          `Nama Paket: ${pkg.package_name}`,
          `Destinasi: ${pkg.destination || '-'}`,
          `Kategori: ${pkg.category || '-'}`,
          `Harga: Rp ${parseFloat(pkg.price || 0).toLocaleString('id-ID')}`,
          `Minimum Peserta: ${pkg.min_pax || 1} orang`,
          `Maksimum Peserta: ${pkg.max_pax || 100} orang`,
          '',
          `Deskripsi Lengkap:`,
          pkg.description || '-',
          '',
          `Termasuk:`,
          pkg.inclusions || '-',
          '',
          `Tidak Termasuk:`,
          pkg.exclusions || '-'
        ].join('\n');

        await embeddingService.chunkAndEmbed(tenant.id, 'basic_package', pkg.id, embeddingText);
        totalEmbedded++;
        console.log(`  ✅ Embedded: ${pkg.package_name} (ID: ${pkg.id})`);
      } catch (err) {
        totalFailed++;
        console.error(`  ❌ Failed: ${pkg.package_name} (ID: ${pkg.id}) — ${err.message}`);
      }

      // Small delay to avoid rate limiting the embedding API
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Embedded: ${totalEmbedded} | Failed: ${totalFailed}`);

  await prisma.$disconnect();
  process.exit(0);
};

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
