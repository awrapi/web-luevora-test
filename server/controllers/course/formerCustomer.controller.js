import FormerCustomerService from '../../services/course/formerCustomer.service.js';

export const getFormerCustomers = async (req, res, next) => {
  try {
    const data = await FormerCustomerService.getFormerCustomers(req.tenant.id);
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const moveToFormer = async (req, res, next) => {
  try {
    const result = await FormerCustomerService.moveToFormer(req.tenant.id, req.params.phone);
    res.json(result);
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const restoreCustomer = async (req, res, next) => {
  try {
    const result = await FormerCustomerService.restoreCustomer(req.tenant.id, req.params.phone);
    res.json(result);
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const deletePermanent = async (req, res, next) => {
  try {
    const result = await FormerCustomerService.deletePermanent(req.tenant.id, req.params.phone);
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

    const follow_up_text = await FormerCustomerService.generateAIFollowUp(req.tenant.id, req.params.phone, instruction);
    res.json({ status: true, message: 'Pesan AI berhasil digenerate', follow_up_text });
  } catch (err) {
    next(err);
  }
};

export default {
  getFormerCustomers,
  moveToFormer,
  restoreCustomer,
  deletePermanent,
  generateAIFollowUp
};
