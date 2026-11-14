import nodemailer from 'nodemailer';
import { ENV } from '../config/env.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  simulated: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<EmailResult> {
  // If simulation mode or SMTP is not fully configured, simulate sending
  if (ENV.SIMULATION_MODE || !ENV.SMTP_USER || !ENV.SMTP_PASS) {
    console.log('📧 [EMAIL SIMULATION] Outgoing Email:');
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${text || html.substring(0, 150)}...`);

    return {
      success: true,
      simulated: true,
      messageId: `simulated-email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: ENV.SMTP_HOST,
      port: ENV.SMTP_PORT,
      secure: ENV.SMTP_SECURE,
      auth: {
        user: ENV.SMTP_USER,
        pass: ENV.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: ENV.EMAIL_FROM,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, ''),
    });

    return {
      success: true,
      simulated: false,
      messageId: info.messageId,
    };
  } catch (err: any) {
    console.error('❌ Email sending failed:', err.message);
    return {
      success: false,
      simulated: false,
      error: err.message,
    };
  }
}

export function renderTemplate(template: string, variables: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{${key}}`, 'g');
    result = result.replace(regex, String(value));
  }
  return result;
}

