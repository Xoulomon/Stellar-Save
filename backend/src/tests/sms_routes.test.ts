/**
 * Tests for SMS/WhatsApp reminder endpoints:
 *   POST   /api/v1/sms/opt-in
 *   POST   /api/v1/sms/verify
 *   DELETE /api/v1/sms/opt-out/:userId
 *   POST   /api/v1/sms/webhook
 *   GET    /api/v1/sms/preferences/:userId
 *   PUT    /api/v1/sms/preferences/:userId
 *
 * Acceptance criteria:
 *   - OTP verification required before number is active
 *   - STOP keyword opt-out honored immediately
 */

import express from 'express';
import request from 'supertest';
import crypto from 'crypto';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSmsReminder = {
  userId: 'u-1',
  phone: '+14155551234',
  channel: 'sms',
  verified: false,
  optedOut: false,
  otpCode: '123456',
  otpExpiresAt: new Date(Date.now() + 600_000),
  leadTimeHours: 24,
};

jest.mock('../prisma_client', () => ({
  prisma: {
    smsReminder: {
      upsert: jest.fn().mockResolvedValue(mockSmsReminder),
      findUnique: jest.fn().mockResolvedValue(mockSmsReminder),
      update: jest.fn().mockImplementation(({ data }: { data: object }) =>
        Promise.resolve({ ...mockSmsReminder, ...data })
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock('../sms_service', () => ({
  sendOtp: jest.fn().mockResolvedValue(true),
  sendReminder: jest.fn().mockResolvedValue(true),
}));

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { createSmsRouter } from '../routes/sms';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use('/api/v1/sms', createSmsRouter());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/sms/opt-in', () => {
  it('sends OTP and returns 200', async () => {
    const res = await request(app)
      .post('/api/v1/sms/opt-in')
      .send({ userId: 'u-1', phone: '+14155551234', channel: 'sms' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/OTP sent/i);
  });

  it('rejects missing userId', async () => {
    const res = await request(app)
      .post('/api/v1/sms/opt-in')
      .send({ phone: '+14155551234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('rejects invalid phone format', async () => {
    const res = await request(app)
      .post('/api/v1/sms/opt-in')
      .send({ userId: 'u-1', phone: '555-1234' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/E\.164/i);
  });

  it('rejects invalid channel', async () => {
    const res = await request(app)
      .post('/api/v1/sms/opt-in')
      .send({ userId: 'u-1', phone: '+14155551234', channel: 'telegram' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/sms/verify', () => {
  it('verifies correct OTP', async () => {
    const res = await request(app)
      .post('/api/v1/sms/verify')
      .send({ userId: 'u-1', code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/verified/i);
  });

  it('rejects wrong OTP', async () => {
    const res = await request(app)
      .post('/api/v1/sms/verify')
      .send({ userId: 'u-1', code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid otp/i);
  });

  it('rejects missing code', async () => {
    const res = await request(app)
      .post('/api/v1/sms/verify')
      .send({ userId: 'u-1' });
    expect(res.status).toBe(400);
  });

  it('rejects expired OTP', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.findUnique.mockResolvedValueOnce({
      ...mockSmsReminder,
      otpExpiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .post('/api/v1/sms/verify')
      .send({ userId: 'u-1', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  it('rejects opted-out user', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.findUnique.mockResolvedValueOnce({
      ...mockSmsReminder,
      optedOut: true,
    });

    const res = await request(app)
      .post('/api/v1/sms/verify')
      .send({ userId: 'u-1', code: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/opted out/i);
  });
});

describe('DELETE /api/v1/sms/opt-out/:userId', () => {
  it('opts out the user', async () => {
    const res = await request(app).delete('/api/v1/sms/opt-out/u-1');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/opted out/i);
  });

  it('returns 404 when user not found', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).delete('/api/v1/sms/opt-out/unknown');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/sms/webhook (STOP keyword)', () => {
  it('honors STOP and opts out the number', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.updateMany.mockClear();

    const res = await request(app)
      .post('/api/v1/sms/webhook')
      .type('form')
      .send({ Body: 'STOP', From: '+14155551234' });

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/xml/);
    expect(prisma.smsReminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '+14155551234' }, data: { optedOut: true, verified: false } })
    );
  });

  it('honors UNSUBSCRIBE keyword', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.updateMany.mockClear();

    await request(app)
      .post('/api/v1/sms/webhook')
      .type('form')
      .send({ Body: 'UNSUBSCRIBE', From: '+14155551234' });

    expect(prisma.smsReminder.updateMany).toHaveBeenCalled();
  });

  it('strips whatsapp: prefix from From number', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.updateMany.mockClear();

    await request(app)
      .post('/api/v1/sms/webhook')
      .type('form')
      .send({ Body: 'STOP', From: 'whatsapp:+14155551234' });

    expect(prisma.smsReminder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: '+14155551234' } })
    );
  });

  it('ignores non-opt-out keywords', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.updateMany.mockClear();

    await request(app)
      .post('/api/v1/sms/webhook')
      .type('form')
      .send({ Body: 'Hello', From: '+14155551234' });

    expect(prisma.smsReminder.updateMany).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/sms/preferences/:userId', () => {
  it('returns preferences for a known user', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.findUnique.mockResolvedValueOnce({
      ...mockSmsReminder,
      verified: true,
    });

    const res = await request(app).get('/api/v1/sms/preferences/u-1');
    expect(res.status).toBe(200);
    expect(res.body.phone).toBe('+14155551234');
    expect(res.body.verified).toBe(true);
  });

  it('returns 404 for unknown user', async () => {
    const { prisma } = jest.requireMock('../prisma_client');
    prisma.smsReminder.findUnique.mockResolvedValueOnce(null);

    const res = await request(app).get('/api/v1/sms/preferences/unknown');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/v1/sms/preferences/:userId', () => {
  it('updates lead time', async () => {
    const res = await request(app)
      .put('/api/v1/sms/preferences/u-1')
      .send({ leadTimeHours: 12 });
    expect(res.status).toBe(200);
  });

  it('rejects invalid leadTimeHours', async () => {
    const res = await request(app)
      .put('/api/v1/sms/preferences/u-1')
      .send({ leadTimeHours: -1 });
    expect(res.status).toBe(400);
  });
});
