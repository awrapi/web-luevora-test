import prisma from '../../config/database.js';


/**
 * Get all configurations for the current tenant.
 */
export const getConfigurations = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const settings = await prisma.globalSetting.findMany({
      where: { tenant_id: tenantId },
    });
    
    const emailAccount = await prisma.emailAccount.findUnique({
      where: { tenant_id: tenantId }
    });

    // Convert array to key-value object
    const configMap = {};
    settings.forEach(setting => {
      configMap[setting.setting_key] = setting.setting_value;
    });

    if (emailAccount) {
      // Sembunyikan password
      emailAccount.email_password = '';
      configMap.emailAccount = emailAccount;
    }

    res.json({ success: true, data: configMap });
  } catch (error) {
    console.error('[ConfigurationController] Error fetching configs:', error);
    res.status(500).json({ success: false, message: 'Server error fetching configurations.' });
  }
};

/**
 * Update configurations.
 * Expects an object of key-value pairs in req.body.
 */
export const updateConfigurations = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const configs = req.body;
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid configuration data.' });
    }


    // Process all updates in a transaction
    const updatePromises = Object.entries(configs).map(([key, value]) => {
      // Ensure value is a string or handle nulls
      const stringValue = value !== null && value !== undefined ? String(value) : '';

      return prisma.globalSetting.upsert({
        where: {
          uk_tenant_setting: {
            tenant_id: tenantId,
            setting_key: key
          }
        },
        update: {
          setting_value: stringValue,
          updated_at: new Date()
        },
        create: {
          tenant_id: tenantId,
          setting_key: key,
          setting_value: stringValue
        }
      });
    });

    await prisma.$transaction(updatePromises);
    
    res.json({ success: true, message: 'Configurations updated successfully.' });
  } catch (error) {
    console.error('[ConfigurationController] Error updating configs:', error);
    res.status(500).json({ success: false, message: 'Server error updating configurations.' });
  }
};

/**
 * Clear chat history for the tenant.
 */
export const clearChatHistory = async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    
    await prisma.chatHistory.deleteMany({
      where: { tenant_id: tenantId }
    });
    
    res.json({ success: true, message: 'Chat history cleared successfully.' });
  } catch (error) {
    console.error('[ConfigurationController] Error clearing chat history:', error);
    res.status(500).json({ success: false, message: 'Server error clearing chat history.' });
  }
};
