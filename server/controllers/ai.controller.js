import { processIncomingChat } from '../services/ai_agent/handler.service.js';

export const handleChat = async (req, res) => {
  try {
    // Di aplikasi nyata, tenantId mungkin dari req.tenant.id via middleware
    // Di sini kita ambil dari req.body untuk kemudahan testing endpoint
    const { tenant_id, message, chat_type } = req.body;

    if (!tenant_id || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'tenant_id dan message wajib disertakan.' 
      });
    }

    const response = await processIncomingChat({
      tenantId: parseInt(tenant_id, 10),
      userMessage: message,
      chatType: chat_type || 'sales'
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('[AI Controller Error]:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Terjadi kesalahan pada server AI.' 
    });
  }
};
