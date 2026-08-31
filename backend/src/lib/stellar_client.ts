/**
 * Stellar/Soroban RPC Client Implementation
 * Enables dependency injection and unit testing without live network calls.
 */

export interface IStellarClient {
  executePayoutsBatch(groupIds: string[], contractId: string): Promise<void>;
}

export class StellarClient implements IStellarClient {
  private rpcUrl: string;

  constructor(rpcUrl: string) {
    this.rpcUrl = rpcUrl;
  }

  async executePayoutsBatch(groupIds: string[], contractId: string): Promise<void> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'simulateTransaction',
      params: {
        transaction: JSON.stringify({ contract: contractId, function: 'execute_payouts_batch', args: { group_ids: groupIds } }),
      },
    };

    const res = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Soroban RPC error: ${res.status}`);
    const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
    if (body.error) throw new Error(`Soroban RPC returned error: ${body.error.message}`);
  }
}
