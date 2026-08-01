import prisma from '../config/database.js';

export const getLeads = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(400).json({ success: false, message: 'Tenant ID is required.' });
    }

    const leads = await prisma.lead.findMany({
      where: { tenant_id: tenantId },
      orderBy: { last_message_at: 'desc' }
    });

    // Standardize JSON response
    const formattedLeads = leads.map(lead => ({
      ...lead,
      latestMessage: lead.last_message_preview || '',
      status: lead.status || 'baru', // Default status matching React expectation
      label: lead.label || 'potensial'
    }));

    return res.status(200).json({
      success: true,
      data: formattedLeads
    });
  } catch (error) {
    console.error('[Lead Controller Error - getLeads]:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

export const getChatMessages = async (req, res) => {
  try {
    const tenantId = req.tenant?.id;
    const { user_phone } = req.params;

    if (!tenantId || !user_phone) {
      return res.status(400).json({ success: false, message: 'Tenant ID and user_phone are required.' });
    }

    const messages = await prisma.chatHistory.findMany({
      where: {
        tenant_id: tenantId,
        user_phone: user_phone
      },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }]
    });

    return res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('[Lead Controller Error - getChatMessages]:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
