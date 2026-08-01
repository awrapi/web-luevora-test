import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MODELS = [
  { name: 'PackageMediaFile',     model: prisma.packageMediaFile },
  { name: 'KbMediaFile',          model: prisma.kbMediaFile },
  { name: 'MainPackageMediaFile', model: prisma.mainPackageMediaFile },
  { name: 'SubItemMediaFile',     model: prisma.subItemMediaFile },
  { name: 'AddonMediaFile',       model: prisma.addonMediaFile },
];

async function revertFileExtensions() {
  console.log('Reverting file_path extensions...');

  let totalReverted = 0;

  for (const { name, model } of MODELS) {
    const files = await model.findMany({
      where: {
        file_type: { notIn: ['image'] },
      },
      select: { id: true, file_path: true },
    });

    for (const file of files) {
      if (!file.file_path) continue;
      
      const lower = file.file_path.toLowerCase();
      let newPath = file.file_path;
      
      if (lower.endsWith('.pdf')) {
        newPath = file.file_path.slice(0, -4);
      } else if (lower.endsWith('.docx') || lower.endsWith('.xlsx')) {
        newPath = file.file_path.slice(0, -5);
      } else if (lower.endsWith('.doc') || lower.endsWith('.xls')) {
        newPath = file.file_path.slice(0, -4);
      }

      if (newPath !== file.file_path) {
        try {
          await model.update({
            where: { id: file.id },
            data: { file_path: newPath },
          });
          console.log(`Reverted ${name} ID ${file.id}: ${newPath}`);
          totalReverted++;
        } catch (err) {
          console.error(`Failed to revert ${name} ID ${file.id}: ${err.message}`);
        }
      }
    }
  }

  console.log(`\nTotal reverted: ${totalReverted}`);
  await prisma.$disconnect();
}

revertFileExtensions().catch(async (err) => {
  console.error('Fatal error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
