import ServiceLabelService from '../../services/course/serviceLabel.service.js';

export const getServiceLabels = async (req, res, next) => {
  try {
    const data = await ServiceLabelService.getServiceLabels(req.tenant.id);
    res.json({ status: true, data });
  } catch (err) {
    next(err);
  }
};

export const createServiceLabel = async (req, res, next) => {
  try {
    const data = await ServiceLabelService.createServiceLabel(req.tenant.id, req.body);
    res.json({ status: true, data, message: 'Layanan berhasil ditambahkan' });
  } catch (err) {
    if (err.message.includes('wajib diisi') || err.message.includes('sudah ada')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const updateServiceLabel = async (req, res, next) => {
  try {
    const data = await ServiceLabelService.updateServiceLabel(req.tenant.id, req.params.id, req.body);
    res.json({ status: true, data, message: 'Layanan berhasil diupdate' });
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const deleteServiceLabel = async (req, res, next) => {
  try {
    const result = await ServiceLabelService.deleteServiceLabel(req.tenant.id, req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message.includes('tidak ditemukan')) {
      return res.status(404).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export default {
  getServiceLabels,
  createServiceLabel,
  updateServiceLabel,
  deleteServiceLabel
};
