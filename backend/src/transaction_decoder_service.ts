/**
 * Transaction Decoder Service for Stellar/Soroban (Issue #1102)
 * 
 * Provides human-readable transaction decoding, phishing protection,
 * and educational prompts for transaction signing.
 */

import { Transaction, Networks, xdr, Operation } from '@stellar/stellar-sdk';
import { logger } from './logger';
import { config } from './config';

export interface DecodedOperation {
  type: string;
  description: string;
  details: Record<string, unknown>;
  riskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
}

export interface DecodedTransaction {
  network: string;
  networkPassphrase: string;
  sourceAccount: string;
  fee: string;
  sequenceNumber: string;
  operations: DecodedOperation[];
  memo?: string;
  timeBounds?: {
    minTime: string;
    maxTime: string;
  };
  overallRiskLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  educationalPrompts: string[];
}

export interface TransactionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  riskFactors: string[];
}

// Known contract addresses and their purposes
const KNOWN_CONTRACTS: Record<string, { name: string; trusted: boolean }> = {
  // Add your known contract addresses here
  // Example: 'CXXXXXXX...': { name: 'Stellar Save Contract', trusted: true }
};

// Suspicious amount thresholds (in stroops)
const SUSPICIOUS_AMOUNT_STROOPS = 100_000_000_000; // 10,000 XLM
const UNUSUAL_AMOUNT_STROOPS = 10_000_000_000; // 1,000 XLM

export class TransactionDecoderService {
  /**
   * Decode a Stellar transaction into human-readable format
   */
  decodeTransaction(transactionXdr: string): DecodedTransaction {
    try {
      const tx = new Transaction(transactionXdr, this.getNetworkPassphrase());
      
      const operations = tx.operations.map((op, idx) => this.decodeOperation(op, idx));
      const overallRiskLevel = this.calculateOverallRisk(operations);
      const warnings = this.collectWarnings(tx, operations);
      const educationalPrompts = this.generateEducationalPrompts(operations, overallRiskLevel);

      return {
        network: config.stellar.network,
        networkPassphrase: this.getNetworkPassphrase(),
        sourceAccount: tx.source,
        fee: `${tx.fee} stroops (${this.stroopsToXlm(tx.fee)} XLM)`,
        sequenceNumber: tx.sequence,
        operations,
        memo: tx.memo?.value?.toString(),
        timeBounds: tx.timeBounds ? {
          minTime: new Date(parseInt(tx.timeBounds.minTime) * 1000).toISOString(),
          maxTime: new Date(parseInt(tx.timeBounds.maxTime) * 1000).toISOString(),
        } : undefined,
        overallRiskLevel,
        warnings,
        educationalPrompts,
      };
    } catch (error) {
      logger.error('Failed to decode transaction', { error, transactionXdr });
      throw new Error(`Transaction decoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decode a single operation
   */
  private decodeOperation(operation: xdr.Operation, index: number): DecodedOperation {
    const type = operation.body().switch().name;
    const warnings: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    let description = '';
    const details: Record<string, unknown> = {};

    switch (type) {
      case 'payment': {
        const paymentOp = operation.body().paymentOp();
        const amount = paymentOp.amount().toString();
        const destination = paymentOp.destination().ed25519();
        
        description = `Send ${this.stroopsToXlm(amount)} XLM to ${this.formatAddress(destination)}`;
        details.destination = this.formatAddress(destination);
        details.amount = amount;
        details.amountXlm = this.stroopsToXlm(amount);

        // Risk analysis
        const amountNum = parseInt(amount);
        if (amountNum > SUSPICIOUS_AMOUNT_STROOPS) {
          warnings.push(`⚠️ Very large amount: ${this.stroopsToXlm(amount)} XLM`);
          riskLevel = 'high';
        } else if (amountNum > UNUSUAL_AMOUNT_STROOPS) {
          warnings.push(`⚠️ Unusual amount: ${this.stroopsToXlm(amount)} XLM`);
          riskLevel = 'medium';
        }

        if (!this.isKnownAddress(this.formatAddress(destination))) {
          warnings.push('⚠️ Destination address is not recognized');
          riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        }
        break;
      }

      case 'createAccount': {
        const createOp = operation.body().createAccountOp();
        const destination = createOp.destination().ed25519();
        const startingBalance = createOp.startingBalance().toString();
        
        description = `Create account ${this.formatAddress(destination)} with ${this.stroopsToXlm(startingBalance)} XLM`;
        details.destination = this.formatAddress(destination);
        details.startingBalance = this.stroopsToXlm(startingBalance);
        riskLevel = 'low';
        break;
      }

      case 'invokeHostFunction': {
        const invokeOp = operation.body().invokeHostFunctionOp();
        const hostFunction = invokeOp.hostFunction();
        
        description = 'Execute smart contract function';
        details.functionType = hostFunction.switch().name;
        
        // Extract contract address if available
        if (hostFunction.switch().name === 'hostFunctionTypeInvokeContract') {
          const contractAddress = invokeOp.auth();
          if (contractAddress && contractAddress.length > 0) {
            const addr = contractAddress[0].toString();
            details.contractAddress = addr;
            
            if (this.isKnownContract(addr)) {
              const contract = KNOWN_CONTRACTS[addr];
              description = `Execute function on ${contract.name}`;
              riskLevel = contract.trusted ? 'low' : 'medium';
            } else {
              warnings.push('⚠️ Unrecognized contract address');
              riskLevel = 'high';
            }
          }
        }
        break;
      }

      case 'changeTrust': {
        const trustOp = operation.body().changeTrustOp();
        const asset = trustOp.line();
        
        description = `Modify trustline for asset`;
        details.asset = asset.switch().name;
        warnings.push('⚠️ This grants permission to hold a new asset');
        riskLevel = 'medium';
        break;
      }

      case 'setOptions': {
        description = 'Modify account settings (signers, thresholds, or flags)';
        warnings.push('⚠️ This modifies critical account security settings');
        riskLevel = 'high';
        break;
      }

      case 'manageData': {
        const dataOp = operation.body().manageDataOp();
        const dataName = dataOp.dataName().toString();
        
        description = `Manage account data: ${dataName}`;
        details.dataName = dataName;
        riskLevel = 'low';
        break;
      }

      default:
        description = `Operation: ${type}`;
        warnings.push(`⚠️ Uncommon operation type: ${type}`);
        riskLevel = 'medium';
    }

    return {
      type,
      description,
      details,
      riskLevel,
      warnings,
    };
  }

  /**
   * Validate transaction for unusual patterns and security issues
   */
  validateTransaction(transactionXdr: string, expectedOrigin?: string): TransactionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const riskFactors: string[] = [];

    try {
      const decoded = this.decodeTransaction(transactionXdr);

      // Validate network
      if (decoded.networkPassphrase !== this.getNetworkPassphrase()) {
        errors.push(`Network mismatch: expected ${this.getNetworkPassphrase()}, got ${decoded.networkPassphrase}`);
      }

      // Check time bounds
      if (!decoded.timeBounds) {
        warnings.push('Transaction has no time bounds - it can be submitted at any time');
        riskFactors.push('no_time_bounds');
      }

      // Validate operations
      for (const op of decoded.operations) {
        if (op.riskLevel === 'high') {
          riskFactors.push(`high_risk_operation_${op.type}`);
        }
        warnings.push(...op.warnings);
      }

      // Check overall risk
      if (decoded.overallRiskLevel === 'high') {
        warnings.push('⚠️ This transaction has been flagged as high-risk');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        riskFactors,
      };
    } catch (error) {
      errors.push(`Transaction validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        isValid: false,
        errors,
        warnings,
        riskFactors: ['decode_failure'],
      };
    }
  }

  /**
   * Verify the origin/domain making the transaction request
   */
  validateOrigin(origin: string, allowedOrigins?: string[]): { valid: boolean; reason?: string } {
    const allowed = allowedOrigins || this.getAllowedOrigins();

    // Check exact match
    if (allowed.includes(origin)) {
      return { valid: true };
    }

    // Check if origin is localhost (for development)
    if (config.nodeEnv === 'development' && 
        (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Origin '${origin}' is not in the allowed list. This may be a phishing attempt.`,
    };
  }

  /**
   * Generate educational prompts based on transaction risk
   */
  private generateEducationalPrompts(operations: DecodedOperation[], riskLevel: string): string[] {
    const prompts: string[] = [];

    if (riskLevel === 'high') {
      prompts.push(
        '🛡️ HIGH RISK: Please carefully review all transaction details before signing.',
        '🔍 Verify the recipient address matches your intended destination.',
        '💡 Never sign transactions from untrusted websites or applications.',
      );
    }

    if (operations.some(op => op.type === 'setOptions')) {
      prompts.push(
        '⚙️ This transaction modifies your account security settings.',
        '🔑 Changing signers or thresholds can affect how your account is controlled.',
        '⚠️ Only proceed if you initiated this change.',
      );
    }

    if (operations.some(op => op.type === 'invokeHostFunction')) {
      prompts.push(
        '📜 This transaction executes a smart contract function.',
        '🔍 Verify the contract address is from a trusted source.',
        '💡 Malicious contracts can drain your funds or compromise your account.',
      );
    }

    if (operations.some(op => op.type === 'changeTrust')) {
      prompts.push(
        '🤝 This transaction modifies your asset trustlines.',
        '⚠️ Only trust assets from verified issuers.',
        '💡 Fraudulent assets can be used in phishing attacks.',
      );
    }

    // Default educational content
    if (prompts.length === 0) {
      prompts.push(
        '✅ Always verify transaction details before signing.',
        '🔍 Check the recipient address and amounts carefully.',
        '🛡️ Only sign transactions you initiated.',
      );
    }

    return prompts;
  }

  private calculateOverallRisk(operations: DecodedOperation[]): 'low' | 'medium' | 'high' {
    const hasHigh = operations.some(op => op.riskLevel === 'high');
    const hasMedium = operations.some(op => op.riskLevel === 'medium');

    if (hasHigh) return 'high';
    if (hasMedium) return 'medium';
    return 'low';
  }

  private collectWarnings(tx: Transaction, operations: DecodedOperation[]): string[] {
    const warnings: string[] = [];

    // Collect operation warnings
    for (const op of operations) {
      warnings.push(...op.warnings);
    }

    // Check fee
    const feeNum = parseInt(tx.fee);
    if (feeNum > 100000) { // 0.01 XLM
      warnings.push(`⚠️ Unusually high fee: ${this.stroopsToXlm(tx.fee)} XLM`);
    }

    return warnings;
  }

  private stroopsToXlm(stroops: string | number): string {
    const num = typeof stroops === 'string' ? parseInt(stroops) : stroops;
    return (num / 10_000_000).toFixed(7);
  }

  private formatAddress(buffer: Buffer): string {
    // Convert buffer to Stellar address format
    return buffer.toString('base64').substring(0, 8) + '...' + buffer.toString('base64').slice(-8);
  }

  private isKnownAddress(address: string): boolean {
    // In production, check against a whitelist of known addresses
    return KNOWN_CONTRACTS[address] !== undefined;
  }

  private isKnownContract(address: string): boolean {
    return KNOWN_CONTRACTS[address] !== undefined;
  }

  private getNetworkPassphrase(): string {
    return config.stellar.networkPassphrase;
  }

  private getAllowedOrigins(): string[] {
    const corsOrigins = process.env.CORS_ALLOWED_ORIGINS || '';
    return corsOrigins.split(',').map(o => o.trim()).filter(Boolean);
  }
}

export const transactionDecoderService = new TransactionDecoderService();
