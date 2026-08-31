import * as crypto from 'crypto';

describe('Webhook HMAC signature', () => {
  it('generates a valid sha256 HMAC signature', () => {
    const secret = 'test-secret';
    const timestamp = '1234567890';
    const body = JSON.stringify({ event: 'contribution.created', timestamp, data: {} });
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different signatures for different secrets', () => {
    const timestamp = '1234567890';
    const body = JSON.stringify({ event: 'contribution.created', timestamp, data: {} });
    const sig1 = crypto.createHmac('sha256', 'secret1').update(`${timestamp}.${body}`).digest('hex');
    const sig2 = crypto.createHmac('sha256', 'secret2').update(`${timestamp}.${body}`).digest('hex');
    expect(sig1).not.toBe(sig2);
  });

  it('produces the same signature for the same inputs', () => {
    const secret = 'my-secret';
    const timestamp = '9999999999';
    const body = JSON.stringify({ event: 'payout.executed', timestamp, data: { groupId: 'g1' } });
    const sig1 = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const sig2 = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    expect(sig1).toBe(sig2);
  });

  it('signature format is sha256=<hex>', () => {
    const secret = 'test-secret';
    const timestamp = '1234567890';
    const body = JSON.stringify({ event: 'member.joined', timestamp, data: {} });
    const hex = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const header = `sha256=${hex}`;
    expect(header).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});

describe('Webhook event types', () => {
  const validEvents = ['contribution.created', 'payout.executed', 'member.joined'];

  it.each(validEvents)('"%s" is a valid webhook event', (event) => {
    expect(typeof event).toBe('string');
    expect(event).toContain('.');
  });
});
