import CustomerService from '../../services/shared/customer.service.js';

export const getCustomerList = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { search = '', sort = 'recent', limit = 200 } = req.query;
    const result = await CustomerService.fetchCustomerList(tenantId, { search, sort, limit });
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getCustomerDetail = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const detail = await CustomerService.fetchCustomerDetail(tenantId, phone);
    if (!detail) {
      return res.status(404).json({ status: false, message: 'Customer tidak ditemukan' });
    }

    res.json({ status: true, data: detail });
  } catch (err) {
    next(err);
  }
};

export const getCustomerChat = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const messages = await CustomerService.fetchCustomerChat(tenantId, phone);
    res.json({ status: true, data: messages });
  } catch (err) {
    next(err);
  }
};

export const getCustomerCrmHistory = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const history = await CustomerService.fetchCustomerCrmHistory(tenantId, phone);
    res.json({ status: true, data: history });
  } catch (err) {
    next(err);
  }
};

export const getLabels = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const labels = await CustomerService.fetchAvailableLabels(tenantId);
    res.json({ status: true, data: labels });
  } catch (err) {
    next(err);
  }
};

export const createCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const result = await CustomerService.createManualCustomer(tenantId, req.body || {});
    res.status(201).json({ status: true, ...result });
  } catch (err) {
    if (err.message?.includes('wajib diisi')) {
      return res.status(400).json({ status: false, message: err.message });
    }
    next(err);
  }
};

export const sendCustomerMessage = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    const { message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ status: false, message: 'Phone dan message wajib diisi' });
    }

    const result = await CustomerService.sendCustomerMessage(tenantId, phone, message);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const followUpCustomer = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { phone } = req.params;
    const { instruction = '' } = req.body;

    if (!phone) {
      return res.status(400).json({ status: false, message: 'Phone wajib diisi' });
    }

    const result = await CustomerService.followUpCustomer(tenantId, phone, instruction);
    res.json({ status: true, ...result });
  } catch (err) {
    next(err);
  }
};

export default {
  getCustomerList,
  getCustomerDetail,
  getCustomerChat,
  getCustomerCrmHistory,
  getLabels,
  createCustomer,
  sendCustomerMessage,
  followUpCustomer
};
