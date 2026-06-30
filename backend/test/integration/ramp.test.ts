import request from 'supertest';
import express from 'express';
import { createRampRouter } from '../../src/routes/ramp';
import { issueJwt } from '../../src/auth_service';

const TEST_WALLET = 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3';

function buildApp() {
  const app = express();
  app.use(express.json());
  return app.use('/api/ramp', createRampRouter());
}

describe('Ramp routes (integration)', () => {
  const token = issueJwt(TEST_WALLET);

  it('rejects deposit when KYC is not approved', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/ramp/deposit')
      .set('Authorization', `Bearer ${token}`)
      .send({ anchorDomain: 'testanchor.stellar.org', assetCode: 'USDC', stellarAccount: 'GABC...' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('KYC approval required');
  });

  it('rejects withdraw when KYC is not approved', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/ramp/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ anchorDomain: 'testanchor.stellar.org', assetCode: 'USDC', stellarAccount: 'GABC...' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('KYC approval required');
  });

  it('returns 404 for missing transaction', async () => {
    const app = buildApp();
    const res = await request(app)
      .get('/api/ramp/nonexistent-id')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});
