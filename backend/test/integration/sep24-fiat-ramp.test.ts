/**
 * SEP-24 Fiat Ramp Integration Tests
 * 
 * These tests validate the full deposit/withdraw flow against a mock SEP-24 anchor sandbox.
 * 
 * Test Coverage:
 * - SEP-10 authentication flow
 * - Deposit initiation and status polling
 * - Withdraw initiation and status polling
 * - Transaction completion
 * - Failure and refund scenarios
 * - Edge cases and error handling
 */

import request from 'supertest';
import { Sep24Sandbox } from '../helpers/sep24-sandbox';
import { Server } from 'http';

describe('SEP-24 Fiat Ramp Integration Tests', () => {
  let sandbox: Sep24Sandbox;
  let sandboxApp: any;
  let sandboxServer: Server;
  const SANDBOX_URL = 'http://localhost:8545';
  const TEST_ACCOUNT = 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3';
  let authToken: string;

  beforeAll((done) => {
    sandbox = new Sep24Sandbox();
    sandboxApp = sandbox.getApp();
    sandboxServer = sandboxApp.listen(8545, () => {
      console.log('SEP-24 sandbox listening on port 8545');
      done();
    });
  });

  afterAll((done) => {
    sandboxServer.close(() => {
      console.log('SEP-24 sandbox closed');
      done();
    });
  });

  beforeEach(() => {
    sandbox.reset();
  });

  describe('SEP-1: stellar.toml Discovery', () => {
    it('should return valid stellar.toml file', async () => {
      const res = await request(sandboxApp).get('/.well-known/stellar.toml');
      
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('TRANSFER_SERVER');
      expect(res.text).toContain('WEB_AUTH_ENDPOINT');
      expect(res.text).toContain('SIGNING_KEY');
    });

    it('should include required SEP-24 endpoints', async () => {
      const res = await request(sandboxApp).get('/.well-known/stellar.toml');
      
      expect(res.text).toContain('TRANSFER_SERVER');
      expect(res.text).toContain(SANDBOX_URL);
    });
  });

  describe('SEP-10: Web Authentication', () => {
    it('should return challenge transaction for valid account', async () => {
      const res = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('transaction');
      expect(res.body).toHaveProperty('network_passphrase');
      expect(res.body.network_passphrase).toBe('Test SDF Network ; September 2015');
    });

    it('should return 400 when account parameter is missing', async () => {
      const res = await request(sandboxApp).get('/auth');
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toContain('account');
    });

    it('should return JWT token after submitting signed challenge', async () => {
      // First, get the challenge
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      expect(challengeRes.status).toBe(200);
      const challengeTx = challengeRes.body.transaction;
      
      // Submit signed challenge (mocked for testing)
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeTx });
      
      expect(authRes.status).toBe(200);
      expect(authRes.body).toHaveProperty('token');
      expect(authRes.body).toHaveProperty('expires_in');
      expect(authRes.body.expires_in).toBe(3600);
      
      authToken = authRes.body.token;
    });

    it('should return 400 when transaction is missing in auth POST', async () => {
      const res = await request(sandboxApp)
        .post('/auth')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('SEP-24: Deposit Flow (Happy Path)', () => {
    beforeEach(async () => {
      // Authenticate before each deposit test
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      authToken = authRes.body.token;
    });

    it('should initiate deposit and return interactive URL', async () => {
      const res = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '100.00',
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('type', 'interactive_customer_info_needed');
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('id');
      expect(res.body.url).toContain('/deposit/');
    });

    it('should track deposit transaction status from incomplete to completed', async () => {
      // Initiate deposit
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '250.00',
        });
      
      const txId = depositRes.body.id;
      
      // Check initial status
      const status1 = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(status1.status).toBe(200);
      expect(status1.body.transaction.status).toBe('incomplete');
      expect(status1.body.transaction.kind).toBe('deposit');
      
      // Advance to pending_anchor
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'pending_anchor' });
      
      const status2 = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(status2.body.transaction.status).toBe('pending_anchor');
      
      // Advance to completed
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ 
          id: txId, 
          status: 'completed',
          stellar_transaction_id: 'abc123def456',
        });
      
      const status3 = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(status3.body.transaction.status).toBe('completed');
      expect(status3.body.transaction).toHaveProperty('completed_at');
      expect(status3.body.transaction).toHaveProperty('stellar_transaction_id');
    });

    it('should handle deposit with all status transitions', async () => {
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '500.00',
        });
      
      const txId = depositRes.body.id;
      const statusSequence = [
        'incomplete',
        'pending_user_transfer_start',
        'pending_anchor',
        'pending_stellar',
        'completed',
      ];
      
      for (const expectedStatus of statusSequence) {
        if (expectedStatus !== 'incomplete') {
          await request(sandboxApp)
            .post('/test/advance-transaction')
            .send({ id: txId, status: expectedStatus });
        }
        
        const statusRes = await request(sandboxApp)
          .get('/transaction')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ id: txId });
        
        expect(statusRes.body.transaction.status).toBe(expectedStatus);
      }
    });
  });

  describe('SEP-24: Withdraw Flow (Happy Path)', () => {
    beforeEach(async () => {
      // Authenticate before each withdraw test
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      authToken = authRes.body.token;
    });

    it('should initiate withdraw and return interactive URL', async () => {
      const res = await request(sandboxApp)
        .post('/transactions/withdraw/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '75.00',
        });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('type', 'interactive_customer_info_needed');
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('id');
      expect(res.body.url).toContain('/withdraw/');
    });

    it('should track withdraw transaction status to completion', async () => {
      // Initiate withdraw
      const withdrawRes = await request(sandboxApp)
        .post('/transactions/withdraw/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '150.00',
        });
      
      const txId = withdrawRes.body.id;
      
      // Check initial status
      const status1 = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(status1.status).toBe(200);
      expect(status1.body.transaction.status).toBe('incomplete');
      expect(status1.body.transaction.kind).toBe('withdrawal');
      
      // Complete the withdrawal
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ 
          id: txId, 
          status: 'completed',
          stellar_transaction_id: 'withdraw789xyz',
        });
      
      const status2 = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(status2.body.transaction.status).toBe('completed');
      expect(status2.body.transaction).toHaveProperty('completed_at');
      expect(status2.body.transaction.stellar_transaction_id).toBe('withdraw789xyz');
    });
  });

  describe('SEP-24: Failure and Refund Paths', () => {
    beforeEach(async () => {
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      authToken = authRes.body.token;
    });

    it('should handle deposit failure with error status', async () => {
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '1000.00',
        });
      
      const txId = depositRes.body.id;
      
      // Simulate failure
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ 
          id: txId, 
          status: 'error',
          error_message: 'Insufficient funds in source account',
        });
      
      const statusRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(statusRes.body.transaction.status).toBe('error');
      expect(statusRes.body.transaction.message).toBe('Insufficient funds in source account');
    });

    it('should handle deposit refund scenario', async () => {
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '300.00',
        });
      
      const txId = depositRes.body.id;
      
      // Process to pending_anchor first
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'pending_anchor' });
      
      // Simulate refund
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'refunded' });
      
      const statusRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(statusRes.body.transaction.status).toBe('refunded');
      expect(statusRes.body.transaction.refunded).toBe(true);
      expect(statusRes.body.transaction).toHaveProperty('refund_memo');
      expect(statusRes.body.transaction).toHaveProperty('completed_at');
    });

    it('should handle withdraw failure', async () => {
      const withdrawRes = await request(sandboxApp)
        .post('/transactions/withdraw/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '200.00',
        });
      
      const txId = withdrawRes.body.id;
      
      // Simulate failure
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ 
          id: txId, 
          status: 'error',
          error_message: 'Bank account verification failed',
        });
      
      const statusRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(statusRes.body.transaction.status).toBe('error');
      expect(statusRes.body.transaction.message).toContain('Bank account verification failed');
    });

    it('should handle transaction expiration', async () => {
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '50.00',
        });
      
      const txId = depositRes.body.id;
      
      // Simulate expiration
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'expired' });
      
      const statusRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ id: txId });
      
      expect(statusRes.body.transaction.status).toBe('expired');
    });
  });

  describe('SEP-24: Authorization and Error Handling', () => {
    it('should reject deposit without authorization header', async () => {
      const res = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '100.00',
        });
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should reject withdraw without authorization header', async () => {
      const res = await request(sandboxApp)
        .post('/transactions/withdraw/interactive')
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '100.00',
        });
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should reject transaction status query without authorization', async () => {
      const res = await request(sandboxApp)
        .get('/transaction')
        .query({ id: 'some-tx-id' });
      
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 400 when asset_code is missing in deposit', async () => {
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      const res = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${authRes.body.token}`)
        .send({
          account: TEST_ACCOUNT,
          amount: '100.00',
        });
      
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('asset_code');
    });

    it('should return 404 for non-existent transaction', async () => {
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      const res = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${authRes.body.token}`)
        .query({ id: 'non-existent-tx-id' });
      
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'Transaction not found');
    });
  });

  describe('SEP-24: End-to-End Scenarios', () => {
    it('should complete full deposit flow from auth to completion', async () => {
      // Step 1: Authenticate
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      expect(challengeRes.status).toBe(200);
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      expect(authRes.status).toBe(200);
      const token = authRes.body.token;
      
      // Step 2: Initiate deposit
      const depositRes = await request(sandboxApp)
        .post('/transactions/deposit/interactive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '1000.00',
        });
      
      expect(depositRes.status).toBe(200);
      const txId = depositRes.body.id;
      
      // Step 3: Poll transaction status
      const statuses = ['pending_user_transfer_start', 'pending_anchor', 'pending_stellar', 'completed'];
      
      for (const status of statuses) {
        await request(sandboxApp)
          .post('/test/advance-transaction')
          .send({ id: txId, status });
        
        const pollRes = await request(sandboxApp)
          .get('/transaction')
          .set('Authorization', `Bearer ${token}`)
          .query({ id: txId });
        
        expect(pollRes.status).toBe(200);
        expect(pollRes.body.transaction.status).toBe(status);
      }
      
      // Step 4: Verify completion
      const finalRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${token}`)
        .query({ id: txId });
      
      expect(finalRes.body.transaction.status).toBe('completed');
      expect(finalRes.body.transaction).toHaveProperty('stellar_transaction_id');
      expect(finalRes.body.transaction).toHaveProperty('completed_at');
    });

    it('should complete full withdraw flow from auth to completion', async () => {
      // Step 1: Authenticate
      const challengeRes = await request(sandboxApp)
        .get('/auth')
        .query({ account: TEST_ACCOUNT });
      
      const authRes = await request(sandboxApp)
        .post('/auth')
        .send({ transaction: challengeRes.body.transaction });
      
      const token = authRes.body.token;
      
      // Step 2: Initiate withdraw
      const withdrawRes = await request(sandboxApp)
        .post('/transactions/withdraw/interactive')
        .set('Authorization', `Bearer ${token}`)
        .send({
          asset_code: 'USDC',
          account: TEST_ACCOUNT,
          amount: '500.00',
        });
      
      expect(withdrawRes.status).toBe(200);
      const txId = withdrawRes.body.id;
      
      // Step 3: Advance through states and verify
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'pending_anchor' });
      
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'pending_external' });
      
      await request(sandboxApp)
        .post('/test/advance-transaction')
        .send({ id: txId, status: 'completed' });
      
      // Step 4: Verify final state
      const finalRes = await request(sandboxApp)
        .get('/transaction')
        .set('Authorization', `Bearer ${token}`)
        .query({ id: txId });
      
      expect(finalRes.body.transaction.status).toBe('completed');
      expect(finalRes.body.transaction.kind).toBe('withdrawal');
    });
  });
});
