/**
 * ================================================================
 * Database Config (Single Database Multi-Tenant)
 * ================================================================
 * Exports a single PrismaClient instance.
 * Multi-tenancy is handled via the `tenant_id` field in all tables.
 * ================================================================
 */

import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

export const globalDbEmitter = new EventEmitter();
// Naikkan batas listener agar tidak ada warning jika banyak user connect SSE
globalDbEmitter.setMaxListeners(100);

const basePrisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

const prisma = basePrisma.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        
        // Cek apakah operasi adalah manipulasi data
        if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(operation)) {
          // Tabel-tabel yang dipantau untuk notifikasi
          if (['Transaction', 'CustomerRequest', 'StatusInformation', 'Offer'].includes(model)) {
            let tenant_id = null;
            
            // Mencari tenant_id dari result (untuk create/update)
            if (result && typeof result === 'object' && result.tenant_id) {
              tenant_id = result.tenant_id;
            } 
            // Mencari tenant_id dari args (untuk createMany/updateMany atau jika result tidak me-return field)
            else if (args && args.data && typeof args.data === 'object' && args.data.tenant_id) {
              tenant_id = args.data.tenant_id;
            } else if (args && args.where && typeof args.where === 'object' && args.where.tenant_id) {
              tenant_id = args.where.tenant_id;
            }

            if (tenant_id) {
              globalDbEmitter.emit('db_change', { model, operation, tenant_id });
            }
          }
        }
        
        return result;
      }
    }
  }
});

export default prisma;
