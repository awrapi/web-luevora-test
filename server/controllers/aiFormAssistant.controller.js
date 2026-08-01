import { processFormAssistantChat } from '../services/ai_agent/formAssistant.service.js';

export const handleFormAssistantChat = async (req, res) => {
  try {
    const { message, currentFormState, schema, history } = req.body;

    if (!message || !currentFormState || !schema || !history) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: message, currentFormState, schema, history.'
      });
    }

    const response = await processFormAssistantChat(message, currentFormState, schema, history);

    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('[AI Form Assistant Controller Error]:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process AI Form Assistant chat.'
    });
  }
};
