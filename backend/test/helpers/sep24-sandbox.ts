/**
 * Mock SEP-24 Anchor Sandbox
 * 
 * This module simulates a SEP-24 compliant anchor for testing deposit/withdraw flows.
 * It implements the minimum required endpoints from the SEP-24 specification:
 * - GET /.well-known/stellar.toml
 * - GET /auth (SEP-10)
 * - POST /transactions/deposit/interactive
 * - POST /transactions/withdraw/interactive
 * - GET /transaction/:id
 */

import express, { Express, Request, Response } from 'express';
import * as crypto from 'crypto';
import { Keypair } from '@stellar/stellar-sdk';

export interface Sep24Transaction {
  id: string;
  kind: 'deposit' | 'withdrawal';
  status: 'incomplete' | 'pending_user_transfer_start' | 'pending_anchor' | 'pending_stellar' | 'pending_external' | 'completed' | 'refunded' | 'expired' | 'error';
  status_eta?: number;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  started_at: string;
  completed_at?: string;
  stellar_transaction_id?: string;
  external_transaction_id?: string;
  refunded?: boolean;
  refund_memo?: string;
  message?: string;
  from?: string;
  to?: string;
}

export class Sep24Sandbox {
  private app: Express;
  private transactions: Map<string, Sep24Transaction> = new Map();
  private anchorKeypair: Keypair;
  private challenges: Map<string, { challenge: string; expiresAt: Date }> = new Map();
  
  constructor() {
    this.app = express();
    this.app.use(express.json());
    this.anchorKeypair = Keypair.random();
    this.setupRoutes();
  }

  private setupRoutes() {
    // SEP-1: stellar.toml
    this.app.get('/.well-known/stellar.toml', (req: Request, res: Response) => {
      const toml = `
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
TRANSFER_SERVER="http://localhost:${this.getPort()}"
WEB_AUTH_ENDPOINT="http://localhost:${this.getPort()}/auth"
SIGNING_KEY="${this.anchorKeypair.publicKey()}"
CURRENCIES=["USDC"]
      `.trim();
      res.setHeader('Content-Type', 'text/plain');
      res.send(toml);
    });

    // SEP-10: Web Authentication
    this.app.get('/auth', (req: Request, res: Response) => {
      const account = req.query.account as string;
      
      if (!account) {
        return res.status(400).json({ error: 'account parameter is required' });
      }

      // Generate challenge transaction
      const challenge = this.generateChallenge(account);
      const challengeId = crypto.randomBytes(16).toString('hex');
      
      this.challenges.set(challengeId, {
        challenge,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      });

      res.json({
        transaction: challenge,
        network_passphrase: 'Test SDF Network ; September 2015',
      });
    });

    this.app.post('/auth', (req: Request, res: Response) => {
      const { transaction } = req.body;
      
      if (!transaction) {
        return res.status(400).json({ error: 'transaction is required' });
      }

      // In a real implementation, verify the signed challenge
      // For testing, we'll just return a mock JWT
      const token = this.generateJWT();
      
      res.json({
        token,
        expires_in: 3600,
      });
    });

    // SEP-24: Deposit
    this.app.post('/transactions/deposit/interactive', (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { asset_code, account, amount } = req.body;
      
      if (!asset_code || !account) {
        return res.status(400).json({ error: 'asset_code and account are required' });
      }

      const txId = crypto.randomBytes(16).toString('hex');
      const transaction: Sep24Transaction = {
        id: txId,
        kind: 'deposit',
        status: 'incomplete',
        started_at: new Date().toISOString(),
        amount_in: amount,
        from: account,
      };

      this.transactions.set(txId, transaction);

      res.json({
        type: 'interactive_customer_info_needed',
        url: `http://localhost:${this.getPort()}/deposit/${txId}`,
        id: txId,
      });
    });

    // SEP-24: Withdraw
    this.app.post('/transactions/withdraw/interactive', (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { asset_code, account, amount } = req.body;
      
      if (!asset_code || !account) {
        return res.status(400).json({ error: 'asset_code and account are required' });
      }

      const txId = crypto.randomBytes(16).toString('hex');
      const transaction: Sep24Transaction = {
        id: txId,
        kind: 'withdrawal',
        status: 'incomplete',
        started_at: new Date().toISOString(),
        amount_in: amount,
        to: account,
      };

      this.transactions.set(txId, transaction);

      res.json({
        type: 'interactive_customer_info_needed',
        url: `http://localhost:${this.getPort()}/withdraw/${txId}`,
        id: txId,
      });
    });

    // SEP-24: Get Transaction Status
    this.app.get('/transaction', (req: Request, res: Response) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const txId = req.query.id as string;
      
      if (!txId) {
        return res.status(400).json({ error: 'id parameter is required' });
      }

      const transaction = this.transactions.get(txId);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      res.json({ transaction });
    });

    // Helper endpoint to simulate transaction progression
    this.app.post('/test/advance-transaction', (req: Request, res: Response) => {
      const { id, status, stellar_transaction_id, error_message } = req.body;
      
      const transaction = this.transactions.get(id);
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      transaction.status = status;
      
      if (status === 'completed') {
        transaction.completed_at = new Date().toISOString();
        transaction.stellar_transaction_id = stellar_transaction_id || crypto.randomBytes(32).toString('hex');
      }
      
      if (status === 'refunded') {
        transaction.refunded = true;
        transaction.refund_memo = 'Test refund';
        transaction.completed_at = new Date().toISOString();
      }
      
      if (status === 'error') {
        transaction.message = error_message || 'Transaction failed';
      }

      this.transactions.set(id, transaction);
      
      res.json({ success: true, transaction });
    });
  }

  private generateChallenge(account: string): string {
    // In production, this would be a valid Stellar transaction
    // For testing, return a base64-encoded mock challenge
    const challenge = {
      account,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(32).toString('hex'),
    };
    return Buffer.from(JSON.stringify(challenge)).toString('base64');
  }

  private generateJWT(): string {
    // Mock JWT for testing
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({
      sub: this.anchorKeypair.publicKey(),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64');
    const signature = crypto.randomBytes(32).toString('base64');
    
    return `${header}.${payload}.${signature}`;
  }

  private getPort(): number {
    return 8545; // Default test port
  }

  public getApp(): Express {
    return this.app;
  }

  public getAnchorPublicKey(): string {
    return this.anchorKeypair.publicKey();
  }

  public reset() {
    this.transactions.clear();
    this.challenges.clear();
  }
}
