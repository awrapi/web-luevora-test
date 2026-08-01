import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Starting cleanup of empty contexts...');

  // 1. Package Media Contexts
  const pkgContexts = await prisma.packageMediaContext.findMany({
    include: { files: true }
  });
  let countPkg = 0;
  for (const ctx of pkgContexts) {
    if (ctx.files.length === 0) {
      await prisma.packageMediaContext.delete({ where: { id: ctx.id } });
      countPkg++;
    }
  }
  console.log(`Deleted ${countPkg} empty PackageMediaContexts.`);

  // 2. KB Media Contexts
  const kbContexts = await prisma.kbMediaContext.findMany({
    include: { files: true }
  });
  let countKb = 0;
  for (const ctx of kbContexts) {
    if (ctx.files.length === 0) {
      await prisma.kbMediaContext.delete({ where: { id: ctx.id } });
      countKb++;
    }
  }
  console.log(`Deleted ${countKb} empty KbMediaContexts.`);

  // 3. Main Package Media Contexts
  const mainContexts = await prisma.mainPackageMediaContext.findMany({
    include: { files: true }
  });
  let countMain = 0;
  for (const ctx of mainContexts) {
    if (ctx.files.length === 0) {
      await prisma.mainPackageMediaContext.delete({ where: { id: ctx.id } });
      countMain++;
    }
  }
  console.log(`Deleted ${countMain} empty MainPackageMediaContexts.`);

  // 4. Sub Item Media Contexts
  const subContexts = await prisma.subItemMediaContext.findMany({
    include: { files: true }
  });
  let countSub = 0;
  for (const ctx of subContexts) {
    if (ctx.files.length === 0) {
      await prisma.subItemMediaContext.delete({ where: { id: ctx.id } });
      countSub++;
    }
  }
  console.log(`Deleted ${countSub} empty SubItemMediaContexts.`);

  // 5. Addon Media Contexts
  const addonContexts = await prisma.addonMediaContext.findMany({
    include: { files: true }
  });
  let countAddon = 0;
  for (const ctx of addonContexts) {
    if (ctx.files.length === 0) {
      await prisma.addonMediaContext.delete({ where: { id: ctx.id } });
      countAddon++;
    }
  }
  console.log(`Deleted ${countAddon} empty AddonMediaContexts.`);

  console.log('Cleanup complete!');
  process.exit(0);
}

cleanup().catch(e => {
  console.error(e);
  process.exit(1);
});
