/**
 * sms_service.ts
 *
 * Thin wrapper around the Twilio SDK.
 * Sends OTP codes and reminder messages via SMS or WhatsApp.
 * When TWILIO_ENABLED=false (default) all methods are no-ops that return true
 * so the server starts cleanly without credentials.
 */

import { config } from './config';
import { logger } from './logger';

let twilioClient: import('twilio').Twilio | null = null;

function getClient() {
  if (!config.twilio.enabled) return null;
  if (!twilioClient) {
    // Lazy-import so the module loads even when Twilio is disabled
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Twilio = require('twilio');
    twilioClient = new Twilio(config.twilio.accountSid, config.twilio.authToken) as import('twilio').Twilio;
  }
  return twilioClient;
}

function toAddress(phone: string, channel: 'sms' | 'whatsapp'): string {
  return channel === 'whatsapp' ? `whatsapp:${phone}` : phone;
}

function fromAddress(channel: 'sms' | 'whatsapp'): string {
  return channel === 'whatsapp' ? config.twilio.whatsappFrom : config.twilio.fromNumber;
}

export async function sendOtp(
  phone: string,
  channel: 'sms' | 'whatsapp',
  code: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.info('[sms] Twilio disabled — OTP not sent', { phone });
    return true; // treat as success in dev
  }
  try {
    await client.messages.create({
      to: toAddress(phone, channel),
      from: fromAddress(channel),
      body: `Your Stellar Save verification code is: ${code}. It expires in 10 minutes.`,
    });
    logger.info('[sms] OTP sent', { phone, channel });
    return true;
  } catch (err) {
    logger.error('[sms] Failed to send OTP', { phone, channel, error: String(err) });
    return false;
  }
}

export async function sendReminder(
  phone: string,
  channel: 'sms' | 'whatsapp',
  body: string,
): Promise<boolean> {
  const client = getClient();
  if (!client) {
    logger.info('[sms] Twilio disabled — reminder not sent', { phone });
    return true;
  }
  try {
    await client.messages.create({
      to: toAddress(phone, channel),
      from: fromAddress(channel),
      body,
    });
    logger.info('[sms] Reminder sent', { phone, channel });
    return true;
  } catch (err) {
    logger.error('[sms] Failed to send reminder', { phone, channel, error: String(err) });
    return false;
  }
}
