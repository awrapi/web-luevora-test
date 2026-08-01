import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Update ig_account_id to match the one shown in Meta Dashboard
  const result = await p.globalSetting.updateMany({
    where: {
      tenant_id: 11,
      setting_key: 'ig_account_id'
    },
    data: {
      setting_value: '17841472257465100'
    }
  });
  console.log('Updated ig_account_id:', result);

  // Verify
  const check = await p.globalSetting.findMany({
    where: { tenant_id: 11, setting_key: { in: ['ig_account_id'] } },
    select: { setting_key: true, setting_value: true }
  });
  console.log('Verified:', JSON.stringify(check, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
