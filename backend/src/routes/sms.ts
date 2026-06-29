/**
 * routes/sms.ts
 *
 * SMS/WhatsApp reminder endpoints:
 *   POST /api/v1/sms/opt-in          – save phone + send OTP
 *   POST /api/v1/sms/verify          – verify OTP → activate number
 *   DELETE /api/v1/sms/opt-out/:userId – explicit opt-out from app
 *   POST /api/v1/sms/webhook         – Twilio inbound STOP handler
 *   GET  /api/v1/sms/preferences/:userId – fetch current SMS preferences
 *   PUT  /api/v1/sms/preferences/:userId – update lead time / channel
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma_client';
import { sendOtp } from '../sms_service';
import { logger } from '../logger';

export function createSmsRouter(): Router {
  const router = Router();

  // ── POST /opt-in ──────────────────────────────────────────────────────────
  router.post('/opt-in', async (req: Request, res: Response) => {
    const { userId, phone, channel = 'sms' } = req.body as {
      userId?: string;
      phone?: string;
      channel?: string;
    };

    if (!userId || !phone) {
      return res.status(400).json({ error: 'userId and phone are required' });
    }
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      return res.status(400).json({ error: 'phone must be in E.164 format, e.g. +14155551234' });
    }
    if (!['sms', 'whatsapp'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be "sms" or "whatsapp"' });
    }

    const code = String(Math.floor(100_000 + Math.random() * 900_000));
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.smsReminder.upsert({
      where: { userId },
      create: { userId, phone, channel, otpCode: code, otpExpiresAt, verified: false, optedOut: false },
      update: { phone, channel, otpCode: code, otpExpiresAt, verified: false, optedOut: false },
    });

    const sent = await sendOtp(phone, channel as 'sms' | 'whatsapp', code);
    if (!sent) {
      return res.status(502).json({ error: 'Failed to send OTP. Please try again.' });
    }

    return res.status(200).json({ message: 'OTP sent. Verify to activate SMS reminders.' });
  });

  // ── POST /verify ──────────────────────────────────────────────────────────
  router.post('/verify', async (req: Request, res: Response) => {
    const { userId, code } = req.body as { userId?: string; code?: string };

    if (!userId || !code) {
      return res.status(400).json({ error: 'userId and code are required' });
    }

    const record = await prisma.smsReminder.findUnique({ where: { userId } });
    if (!record) {
      return res.status(404).json({ error: 'No pending OTP for this user' });
    }
    if (record.optedOut) {
      return res.status(400).json({ error: 'User has opted out of SMS reminders' });
    }
    if (!record.otpCode || !record.otpExpiresAt) {
      return res.status(400).json({ error: 'No OTP pending' });
    }
    if (record.otpExpiresAt < new Date()) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }
    // Constant-time comparison to prevent timing attacks
    const expected = Buffer.from(record.otpCode.padEnd(6));
    const actual = Buffer.from(code.slice(0, 6).padEnd(6));
    if (!crypto.timingSafeEqual(expected, actual)) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    await prisma.smsReminder.update({
      where: { userId },
      data: { verified: true, optedOut: false, otpCode: null, otpExpiresAt: null },
    });

    return res.status(200).json({ message: 'Phone verified. SMS reminders are now active.' });
  });

  // ── GET /preferences/:userId ──────────────────────────────────────────────
  router.get('/preferences/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const record = await prisma.smsReminder.findUnique({ where: { userId } });
    if (!record) {
      return res.status(404).json({ error: 'No SMS preferences found' });
    }
    return res.json({
      phone: record.phone,
      channel: record.channel,
      verified: record.verified,
      optedOut: record.optedOut,
      leadTimeHours: record.leadTimeHours,
    });
  });

  // ── PUT /preferences/:userId ──────────────────────────────────────────────
  router.put('/preferences/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { leadTimeHours, channel } = req.body as { leadTimeHours?: number; channel?: string };

    if (leadTimeHours !== undefined && (!Number.isInteger(leadTimeHours) || leadTimeHours < 1)) {
      return res.status(400).json({ error: 'leadTimeHours must be a positive integer' });
    }
    if (channel !== undefined && !['sms', 'whatsapp'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be "sms" or "whatsapp"' });
    }

    const record = await prisma.smsReminder.findUnique({ where: { userId } });
    if (!record) return res.status(404).json({ error: 'No SMS preferences found' });

    const updated = await prisma.smsReminder.update({
      where: { userId },
      data: {
        ...(leadTimeHours !== undefined ? { leadTimeHours } : {}),
        ...(channel !== undefined ? { channel } : {}),
      },
    });

    return res.json({
      phone: updated.phone,
      channel: updated.channel,
      verified: updated.verified,
      optedOut: updated.optedOut,
      leadTimeHours: updated.leadTimeHours,
    });
  });

  // ── DELETE /opt-out/:userId ───────────────────────────────────────────────
  router.delete('/opt-out/:userId', async (req: Request, res: Response) => {
    const { userId } = req.params;
    const record = await prisma.smsReminder.findUnique({ where: { userId } });
    if (!record) return res.status(404).json({ error: 'No SMS preferences found' });

    await prisma.smsReminder.update({
      where: { userId },
      data: { optedOut: true, verified: false },
    });

    return res.json({ message: 'Opted out of SMS reminders' });
  });

  // ── POST /webhook  (Twilio inbound — STOP keyword) ─────────────────────────
  // Carrier policy: must honor STOP within one cycle. Twilio sends inbound
  // message bodies here; we match STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT.
  router.post('/webhook', async (req: Request, res: Response) => {
    const body: string = (req.body?.Body ?? '').toString().trim().toUpperCase();
    const from: string = (req.body?.From ?? '').toString();

    // Normalize: whatsapp:+1... → +1...
    const normalizedPhone = from.replace(/^whatsapp:/, '');

    const OPT_OUT_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];

    if (OPT_OUT_KEYWORDS.includes(body)) {
      // Opt out all records matching this phone number
      const result = await prisma.smsReminder.updateMany({
        where: { phone: normalizedPhone },
        data: { optedOut: true, verified: false },
      });
      logger.info('[sms] STOP received', { phone: normalizedPhone, updated: result.count });
    }

    // Twilio expects a TwiML response (empty is fine for opt-out)
    res.set('Content-Type', 'text/xml');
    return res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  return router;
}
