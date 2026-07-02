import {
  TransactionBuilder,
  BASE_FEE,
  Operation,
  Networks,
  SorobanRpc,
  Contract,
  Asset,
} from '@stellar/stellar-sdk';
import type {
  TransactionBuilderStep,
  SimulationResult,
  TransactionTemplate,
} from '../types/transactionBuilder';

const RPC_URL =
  (import.meta.env['VITE_STELLAR_RPC_URL'] as string | undefined) ??
  'https://soroban-testnet.stellar.org';

const NETWORK_PASSPHRASE =
  (import.meta.env['VITE_STELLAR_NETWORK'] as string | undefined) === 'mainnet'
    ? Networks.PUBLIC
    : Networks.TESTNET;

const TEMPLATES_STORAGE_KEY = 'stellar-save:tx-templates';
const DUMMY_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';

function buildOperations(steps: TransactionBuilderStep[]) {
  const ops: ReturnType<typeof Operation.payment>[] = [];
  for (const step of steps) {
    if (!step.enabled) continue;
    const p = step.params as Record<string, string>;

    switch (step.type) {
      case 'payment':
        ops.push(
          Operation.payment({
            destination: p.destination || DUMMY_ADDRESS,
            amount: p.amount || '0',
          }),
        );
        break;

      case 'manage_data':
        ops.push(
          Operation.manageData({
            name: p.key || '',
            value: p.value || null,
          }),
        );
        break;

      case 'manage_sell_offer':
        ops.push(
          Operation.manageSellOffer({
            selling: new Asset(p.selling || 'XLM', p.sellingIssuer || ''),
            buying: new Asset(p.buying || 'XLM', p.buyingIssuer || ''),
            amount: p.amount || '0',
            price: p.price || '1.0',
          }),
        );
        break;

      case 'contract_call':
      case 'create_group':
      case 'join_group':
      case 'contribute':
      case 'execute_payout':
        if (p.contractId) {
          const contract = new Contract(p.contractId);
          ops.push(contract.call(p.method || 'default'));
        }
        break;
    }
  }
  return ops;
}

export async function simulateTransaction(
  steps: TransactionBuilderStep[],
  sourceAddress?: string,
): Promise<SimulationResult> {
  try {
    const ops = buildOperations(steps);
    if (ops.length === 0) {
      return {
        success: false,
        feeEstimate: '0',
        feeInXlm: 0,
        operationsCount: 0,
        footprintBytes: 0,
        warnings: ['No enabled operations to simulate'],
      };
    }

    const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
    const address = sourceAddress || DUMMY_ADDRESS;
    const account = await server.getAccount(address).catch(() => ({
      accountId: () => address,
      sequenceNumber: () => '0',
      incrementSequenceNumber: () => undefined,
    }));

    const builder = new TransactionBuilder(
      account as Parameters<typeof TransactionBuilder>[0],
      { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE },
    );

    for (const op of ops) {
      builder.addOperation(op);
    }

    const built = builder.setTimeout(30).build();
    const simResult = await server.simulateTransaction(built);

    if (SorobanRpc.Api.isSimulationError(simResult)) {
      const errStr = simResult.error instanceof Error
        ? simResult.error.message
        : String(simResult.error || 'Simulation failed');
      return {
        success: false,
        feeEstimate: '0',
        feeInXlm: 0,
        operationsCount: ops.length,
        footprintBytes: 0,
        warnings: [],
        error: errStr,
      };
    }

    let feeInXlm = 0.00001 * ops.length;
    let footprintBytes = 0;
    const warnings: string[] = [];

    if (SorobanRpc.Api.isSimulationSuccess(simResult)) {
      const minFee = simResult.minResourceFee
        ? Number(simResult.minResourceFee) / 1e7
        : 0;
      feeInXlm = Math.max(feeInXlm, minFee);

      if (simResult.footprint) {
        const rwData = simResult.footprint.readWrite ? simResult.footprint.readWrite().length() : 0;
        const roData = simResult.footprint.readOnly ? simResult.footprint.readOnly().length() : 0;
        footprintBytes = (rwData + roData) * 64;
      }

      if (feeInXlm > 0.1) warnings.push(`High estimated fee: ${feeInXlm.toFixed(6)} XLM`);
      if (ops.length > 5) warnings.push(`${ops.length} operations may delay confirmation`);
    }

    return {
      success: true,
      feeEstimate: `${feeInXlm.toFixed(6)} XLM`,
      feeInXlm,
      operationsCount: ops.length,
      footprintBytes,
      warnings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown simulation error';
    return {
      success: false,
      feeEstimate: '0',
      feeInXlm: 0,
      operationsCount: 0,
      footprintBytes: 0,
      warnings: [],
      error: msg,
    };
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createStep(type: TransactionBuilderStep['type'], index: number): TransactionBuilderStep {
  const labels: Record<string, string> = {
    payment: 'Payment',
    contract_call: 'Contract Call',
    manage_data: 'Manage Data',
    manage_sell_offer: 'Sell Offer',
    create_group: 'Create Group',
    join_group: 'Join Group',
    contribute: 'Contribute',
    execute_payout: 'Execute Payout',
  };

  return {
    id: generateId(),
    type,
    label: `${labels[type] || type} #${index + 1}`,
    params: {},
    enabled: true,
  };
}

export function saveTemplate(template: TransactionTemplate): void {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    const templates: TransactionTemplate[] = raw ? JSON.parse(raw) : [];
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      templates[idx] = { ...template, updatedAt: Date.now() };
    } else {
      templates.push({ ...template, id: generateId(), createdAt: Date.now(), updatedAt: Date.now() });
    }
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    console.warn('Failed to save template');
  }
}

export function loadTemplates(): TransactionTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function deleteTemplate(id: string): void {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    const templates: TransactionTemplate[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      TEMPLATES_STORAGE_KEY,
      JSON.stringify(templates.filter(t => t.id !== id)),
    );
  } catch {
    console.warn('Failed to delete template');
  }
}

export function generateShareCode(template: TransactionTemplate): string {
  const data = btoa(
    JSON.stringify({
      n: template.name,
      d: template.description,
      s: template.steps.map(({ id: _id, ...rest }) => rest),
    }),
  );
  return data;
}

export function decodeShareCode(code: string): Omit<TransactionTemplate, 'id' | 'createdAt' | 'updatedAt'> | null {
  try {
    const data = JSON.parse(atob(code));
    return {
      name: data.n || 'Shared Template',
      description: data.d || '',
      steps: (data.s || []).map((s: Record<string, unknown>) => ({
        ...s,
        id: generateId(),
        enabled: true,
      })),
    };
  } catch {
    return null;
  }
}
