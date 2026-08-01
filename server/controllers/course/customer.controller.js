import CustomerService from '../../services/course/customer.service.js';

/**
 * ================================================================
 * Course Customer Controller
 * ================================================================
 */

export const addCustomerManual = async (req, res, next) => {
  try {
    const result = await CustomerService.addCustomerManual(req.tenant.id, req.body);
    res.json(result);
  } catch (err) {
    if (err.message.includes('terdaftar')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    if (err.message.includes('wajib diisi')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const getCustomerDetail = async (req, res, next) => {
  try {
    const result = await CustomerService.getCustomerDetail(req.tenant.id, req.params.phone);
    res.json({ status: true, data: result });
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const editCustomer = async (req, res, next) => {
  try {
    const result = await CustomerService.editCustomer(req.tenant.id, req.params.phone, req.body);
    res.json(result);
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const generateAIFollowUp = async (req, res, next) => {
  try {
    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ status: false, message: 'Instruksi wajib diisi' });

    const follow_up_text = await CustomerService.generateAIFollowUp(req.tenant.id, req.params.phone, instruction);
    res.json({ status: true, message: 'Pesan AI berhasil digenerate', follow_up_text });
  } catch (err) {
    next(err);
  }
};

export default {
  addCustomerManual,
  editCustomer,
  getCustomerDetail,
  generateAIFollowUp
};
