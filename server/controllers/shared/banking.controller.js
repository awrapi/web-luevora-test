/**
 * ================================================================
 * Banking Controller
 * ================================================================
 */

import * as bankingService from '../../services/shared/banking.service.js';

export const getAll = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const accounts = await bankingService.getBankAccounts(tenantId);
    return res.status(200).json({ success: true, data: accounts });
  } catch (error) {
    console.error('Banking GET Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil data bank' });
  }
};

export const create = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const data = req.body;
    
    if (!data.bank_name || !data.account_number || !data.account_holder) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    const newAccount = await bankingService.createBankAccount(tenantId, data);
    return res.status(201).json({ success: true, data: newAccount });
  } catch (error) {
    console.error('Banking CREATE Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan data bank' });
  }
};

export const update = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;
    const data = req.body;

    if (!data.bank_name || !data.account_number || !data.account_holder) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi' });
    }

    const updatedAccount = await bankingService.updateBankAccount(tenantId, id, data);
    return res.status(200).json({ success: true, data: updatedAccount });
  } catch (error) {
    console.error('Banking UPDATE Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Gagal mengubah data bank' });
  }
};

export const remove = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    await bankingService.deleteBankAccount(tenantId, id);
    return res.status(200).json({ success: true, message: 'Data bank berhasil dihapus' });
  } catch (error) {
    console.error('Banking DELETE Error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Gagal menghapus data bank' });
  }
};
