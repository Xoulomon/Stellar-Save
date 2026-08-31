export type KycStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface KycStatusResult {
  userId: string;
  status: KycStatus;
  kycId?: string;
  submittedAt?: string;
}

export interface KycSubmitFields {
  fullName: string;
  dateOfBirth: string;
  country: string;
  documentImageBase64: string;
}

interface KycClientOptions {
  baseUrl: string;
  authToken: string;
}

/** Mirrors backend/src/routes/kyc.ts: POST /api/kyc/submit, GET /api/kyc/status */
export class KycClient {
  constructor(private opts: KycClientOptions) {}

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.opts.authToken}`,
    };
  }

  async submit(fields: KycSubmitFields): Promise<KycStatusResult> {
    const res = await fetch(`${this.opts.baseUrl}/api/kyc/submit`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `KYC submission failed (${res.status})`);
    }
    return res.json();
  }

  async getStatus(): Promise<KycStatusResult> {
    const res = await fetch(`${this.opts.baseUrl}/api/kyc/status`, {
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch KYC status (${res.status})`);
    }
    return res.json();
  }
}

/** Polls GET /api/kyc/status until a terminal state or timeout. */
export async function pollKycStatus(
  client: KycClient,
  { intervalMs = 5000, timeoutMs = 5 * 60 * 1000 } = {}
): Promise<KycStatusResult> {
  const terminal: KycStatus[] = ['approved', 'rejected', 'expired'];
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const result = await client.getStatus();
    if (terminal.includes(result.status)) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Timed out waiting for KYC status to resolve.');
}
