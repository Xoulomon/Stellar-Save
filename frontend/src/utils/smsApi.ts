/**
 * smsApi.ts
 *
 * Frontend API calls for SMS/WhatsApp reminder opt-in and OTP verification.
 */

const BASE = '/api/v1/sms';

export interface SmsPreferences {
  phone: string;
  channel: 'sms' | 'whatsapp';
  verified: boolean;
  optedOut: boolean;
  leadTimeHours: number;
}

async function post(path: string, body: object): Promise<Response> {
  return fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function smsOptIn(
  userId: string,
  phone: string,
  channel: 'sms' | 'whatsapp',
): Promise<{ message?: string; error?: string }> {
  const res = await post('/opt-in', { userId, phone, channel });
  return res.json();
}

export async function smsVerifyOtp(
  userId: string,
  code: string,
): Promise<{ message?: string; error?: string }> {
  const res = await post('/verify', { userId, code });
  return res.json();
}

export async function getSmsPreferences(userId: string): Promise<SmsPreferences | null> {
  const res = await fetch(`${BASE}/preferences/${userId}`);
  if (res.status === 404) return null;
  return res.json();
}

export async function updateSmsPreferences(
  userId: string,
  updates: Partial<Pick<SmsPreferences, 'leadTimeHours' | 'channel'>>,
): Promise<SmsPreferences> {
  const res = await fetch(`${BASE}/preferences/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function smsOptOut(userId: string): Promise<{ message?: string; error?: string }> {
  const res = await fetch(`${BASE}/opt-out/${userId}`, { method: 'DELETE' });
  return res.json();
}
