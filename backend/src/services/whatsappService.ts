import { ENV } from '../config/env.js';

interface SendWhatsAppParams {
  toPhone: string;
  messageText: string;
}

interface WhatsAppResult {
  success: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppMessage({
  toPhone,
  messageText,
}: SendWhatsAppParams): Promise<WhatsAppResult> {
  // Format phone number: remove spaces, dashes, parentheses
  const cleanedPhone = toPhone.replace(/[\s\-\(\)\+]/g, '');

  if (
    ENV.SIMULATION_MODE ||
    !ENV.WHATSAPP_PHONE_NUMBER_ID ||
    !ENV.WHATSAPP_ACCESS_TOKEN
  ) {
    console.log('📱 [WHATSAPP SIMULATION] Outgoing Message:');
    console.log(`   To: +${cleanedPhone}`);
    console.log(`   Message: ${messageText.substring(0, 150)}...`);

    return {
      success: true,
      simulated: true,
      messageId: `wamid.simulated.${Date.now()}.${Math.random().toString(36).substring(7)}`,
    };
  }

  try {
    const url = `${ENV.WHATSAPP_API_URL}/${ENV.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ENV.WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanedPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: messageText,
        },
      }),
    });

    const data: any = await response.json();

    if (!response.ok) {
      console.error('❌ WhatsApp API Error:', data);
      return {
        success: false,
        simulated: false,
        error: data.error?.message || 'Meta Cloud API call failed',
      };
    }

    const messageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
    return {
      success: true,
      simulated: false,
      messageId,
    };
  } catch (err: any) {
    console.error('❌ WhatsApp request failed:', err.message);
    return {
      success: false,
      simulated: false,
      error: err.message,
    };
  }
}

