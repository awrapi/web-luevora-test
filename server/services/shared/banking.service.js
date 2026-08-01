/**
 * ================================================================
 * Banking Service (Shared)
 * ================================================================
 * Handles database operations for Bank Accounts.
 * ================================================================
 */

import prisma from '../../config/database.js';

export const getBankAccounts = async (tenantId) => {
  return await prisma.bankAccount.findMany({
    where: { tenant_id: tenantId },
    orderBy: { created_at: 'desc' },
  });
};

export const createBankAccount = async (tenantId, data) => {
  return await prisma.bankAccount.create({
    data: {
      tenant_id: tenantId,
      bank_name: data.bank_name,
      account_number: data.account_number,
      account_holder: data.account_holder,
    },
  });
};

export const updateBankAccount = async (tenantId, id, data) => {
  // Verify ownership
  const existing = await prisma.bankAccount.findFirst({
    where: { id: parseInt(id), tenant_id: tenantId },
  });

  if (!existing) throw new Error('Bank account not found or access denied');

  return await prisma.bankAccount.update({
    where: { id: parseInt(id) },
    data: {
      bank_name: data.bank_name,
      account_number: data.account_number,
      account_holder: data.account_holder,
    },
  });
};

export const deleteBankAccount = async (tenantId, id) => {
  // Verify ownership
  const existing = await prisma.bankAccount.findFirst({
    where: { id: parseInt(id), tenant_id: tenantId },
  });

  if (!existing) throw new Error('Bank account not found or access denied');

  return await prisma.bankAccount.delete({
    where: { id: parseInt(id) },
  });
};
