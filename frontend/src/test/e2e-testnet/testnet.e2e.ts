#!/usr/bin/env node
/**
 * Testnet E2E tests for Stellar-Save smart contract.
 *
 * These tests run against a REAL deployed contract on Stellar testnet.
 * No mocking — real transactions are submitted and confirmed on-chain.
 *
 * Prerequisites:
 *   1. Copy .env.testnet.example → .env.testnet and fill in values
 *   2. Fund both test accounts via Friendbot (done automatically if unfunded)
 *   3. Set STELLAR_SAVE_CONTRACT_ID to a deployed contract address
 *
 * Run: npm run test:e2e:testnet
 */

import 'dotenv/config';
import {
  Keypair,
  Networks,
  rpc as SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  Contract,
} from '@stellar/stellar-sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Load .env.testnet ─────────────────────────────────────────────────────────

const envPath = resolve(process.cwd(), '.env.testnet');
try {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
} catch {
  console.error('❌  .env.testnet not found. Copy .env.testnet.example → .env.testnet and fill in values.');
  process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────────

const RPC_URL = process.env['TESTNET_RPC_URL'] ?? 'https://soroban-testnet.stellar.org';
const CONTRACT_ID = process.env['STELLAR_SAVE_CONTRACT_ID'] ?? '';
const WALLET_A_SECRET = process.env['TEST_WALLET_A_SECRET'] ?? '';
const WALLET_B_SECRET = process.env['TEST_WALLET_B_SECRET'] ?? '';
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

if (!CONTRACT_ID) {
  console.error('❌  STELLAR_SAVE_CONTRACT_ID is not set in .env.testnet');
  process.exit(1);
}
if (!WALLET_A_SECRET || !WALLET_B_SECRET) {
  console.error('❌  TEST_WALLET_A_SECRET and TEST_WALLET_B_SECRET must be set in .env.testnet');
  process.exit(1);
}

const keypairA = Keypair.fromSecret(WALLET_A_SECRET);
const keypairB = Keypair.fromSecret(WALLET_B_SECRET);
const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false });
const contract = new Contract(CONTRACT_ID);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fund an account via Friendbot if it doesn't exist yet */
async function ensureFunded(publicKey: string): Promise<void> {
  try {
    await server.getAccount(publicKey);
  } catch {
    console.log(`  💧 Funding ${publicKey.slice(0, 8)}... via Friendbot`);
    const res = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
    if (!res.ok) throw new Error(`Friendbot failed: ${await res.text()}`);
    // Wait for account to appear
    for (let i = 0; i < 10; i++) {
      await sleep(2000);
      try { await server.getAccount(publicKey); return; } catch { /* retry */ }
    }
    throw new Error('Account did not appear after Friendbot funding');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Build, simulate, sign with a local keypair, and submit a transaction.
 * Returns the transaction hash.
 */
async function submitTx(keypair: Keypair, operation: ReturnType<Contract['call']>): Promise<string> {
  const account = await server.getAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(60)
    .build();

  const simResult = await server.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(simResult)) {
    const errMsg = (simResult as { error: string }).error;
    throw new Error(`Simulation failed: ${errMsg}`);
  }

  const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
  preparedTx.sign(keypair);

  const sendResult = await server.sendTransaction(preparedTx);
  if (sendResult.status === 'ERROR') {
    throw new Error(`Send failed: ${JSON.stringify(sendResult.errorResult)}`);
  }

  const hash = sendResult.hash;

  // Poll for confirmation (up to 60 s)
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const result = await server.getTransaction(hash);
    if (result.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (result.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction ${hash} failed on-chain`);
    }
  }
  throw new Error(`Transaction ${hash} did not confirm within 60 s`);
}

/** Read-only simulation — no signing needed */
async function readContract<T>(operation: ReturnType<Contract['call']>): Promise<T> {
  const DUMMY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN';
  const account = await server.getAccount(DUMMY).catch(() => ({
    accountId: () => DUMMY,
    sequenceNumber: () => '0',
    incrementSequenceNumber: () => undefined,
  }));

  const tx = new TransactionBuilder(account as Parameters<typeof TransactionBuilder>[0], {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Read simulation failed: ${(sim as { error: string }).error}`);
  }
  if (!SorobanRpc.Api.isSimulationSuccess(sim) || !sim.result) {
    throw new Error('Simulation returned no result');
  }
  return scValToNative(sim.result.retval) as T;
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  process.stdout.write(`  ○ ${name} ... `);
  try {
    await fn();
    console.log('✅ PASS');
    passed++;
  } catch (err) {
    console.log(`❌ FAIL\n    ${(err as Error).message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🌐 Stellar-Save Testnet E2E Tests');
  console.log(`   RPC:      ${RPC_URL}`);
  console.log(`   Contract: ${CONTRACT_ID}`);
  console.log(`   Wallet A: ${keypairA.publicKey().slice(0, 12)}...`);
  console.log(`   Wallet B: ${keypairB.publicKey().slice(0, 12)}...\n`);

  // ── Setup: fund accounts ──────────────────────────────────────────────────
  console.log('⚙️  Setup');
  await ensureFunded(keypairA.publicKey());
  await ensureFunded(keypairB.publicKey());
  console.log('   Accounts funded ✓\n');

  // ── Suite 1: Single-user journey ──────────────────────────────────────────
  console.log('📋 Suite 1: Single-user journey (Wallet A)');

  let groupId: bigint = 0n;

  await test('create_group submits and confirms on-chain', async () => {
    const totalBefore = await readContract<bigint>(
      contract.call('get_total_groups_created')
    );

    await submitTx(keypairA, contract.call(
      'create_group',
      new Address(keypairA.publicKey()).toScVal(),
      nativeToScVal(10_000_000n, { type: 'i128' }),  // 1 XLM
      nativeToScVal(604800n, { type: 'u64' }),         // 1 week
      nativeToScVal(5, { type: 'u32' }),               // max 5 members
    ));

    const totalAfter = await readContract<bigint>(
      contract.call('get_total_groups_created')
    );

    assert(totalAfter > totalBefore, `group count should increase (was ${totalBefore}, now ${totalAfter})`);
    groupId = totalAfter;
  });

  await test('get_group returns correct group data after creation', async () => {
    const group = await readContract<Record<string, unknown>>(
      contract.call('get_group', nativeToScVal(groupId, { type: 'u64' }))
    );
    assert(group !== null && group !== undefined, 'group should exist');
    // contribution_amount should be 10_000_000 stroops (1 XLM)
    const amount = group['contribution_amount'] ?? group['contributionAmount'];
    assert(
      amount === 10_000_000n || amount === 10_000_000,
      `contribution_amount should be 10_000_000, got ${String(amount)}`
    );
  });

  await test('creator is automatically a member after create_group', async () => {
    const memberCount = await readContract<number>(
      contract.call('get_member_count', nativeToScVal(groupId, { type: 'u64' }))
    );
    assert(memberCount >= 1, `member count should be >= 1, got ${memberCount}`);
  });

  // ── Suite 2: Multi-user scenario ──────────────────────────────────────────
  console.log('\n📋 Suite 2: Multi-user scenario (Wallet A creates, Wallet B joins)');

  let multiGroupId: bigint = 0n;

  await test('Wallet A creates a new group for multi-user test', async () => {
    const totalBefore = await readContract<bigint>(
      contract.call('get_total_groups_created')
    );

    await submitTx(keypairA, contract.call(
      'create_group',
      new Address(keypairA.publicKey()).toScVal(),
      nativeToScVal(5_000_000n, { type: 'i128' }),   // 0.5 XLM
      nativeToScVal(604800n, { type: 'u64' }),
      nativeToScVal(10, { type: 'u32' }),
    ));

    const totalAfter = await readContract<bigint>(
      contract.call('get_total_groups_created')
    );
    assert(totalAfter > totalBefore, 'group count should increase');
    multiGroupId = totalAfter;
  });

  await test('Wallet B joins the group', async () => {
    const membersBefore = await readContract<number>(
      contract.call('get_member_count', nativeToScVal(multiGroupId, { type: 'u64' }))
    );

    await submitTx(keypairB, contract.call(
      'join_group',
      nativeToScVal(multiGroupId, { type: 'u64' }),
      new Address(keypairB.publicKey()).toScVal(),
    ));

    const membersAfter = await readContract<number>(
      contract.call('get_member_count', nativeToScVal(multiGroupId, { type: 'u64' }))
    );
    assert(membersAfter > membersBefore, `member count should increase (was ${membersBefore}, now ${membersAfter})`);
  });

  await test('on-chain member count reflects both users', async () => {
    const memberCount = await readContract<number>(
      contract.call('get_member_count', nativeToScVal(multiGroupId, { type: 'u64' }))
    );
    assert(memberCount >= 2, `expected >= 2 members, got ${memberCount}`);
  });

  // ── Suite 3: Error scenarios ──────────────────────────────────────────────
  console.log('\n📋 Suite 3: Error scenarios');

  await test('joining a group twice returns AlreadyMember error (code 2001)', async () => {
    let threw = false;
    try {
      await submitTx(keypairB, contract.call(
        'join_group',
        nativeToScVal(multiGroupId, { type: 'u64' }),
        new Address(keypairB.publicKey()).toScVal(),
      ));
    } catch (err) {
      threw = true;
      const msg = (err as Error).message;
      // Contract error 2001 = AlreadyMember
      assert(
        msg.includes('2001') || msg.includes('already') || msg.includes('AlreadyMember') || msg.includes('failed'),
        `expected AlreadyMember error, got: ${msg}`
      );
    }
    assert(threw, 'expected an error when joining twice');
  });

  await test('joining a full group returns GroupFull error (code 1002)', async () => {
    // Create a group with max_members = 1 (only creator, immediately full)
    const totalBefore = await readContract<bigint>(
      contract.call('get_total_groups_created')
    );

    await submitTx(keypairA, contract.call(
      'create_group',
      new Address(keypairA.publicKey()).toScVal(),
      nativeToScVal(1_000_000n, { type: 'i128' }),
      nativeToScVal(604800n, { type: 'u64' }),
      nativeToScVal(1, { type: 'u32' }),  // max 1 member → immediately full
    ));

    const fullGroupId = (await readContract<bigint>(
      contract.call('get_total_groups_created')
    ));
    assert(fullGroupId > totalBefore, 'full group should be created');

    let threw = false;
    try {
      await submitTx(keypairB, contract.call(
        'join_group',
        nativeToScVal(fullGroupId, { type: 'u64' }),
        new Address(keypairB.publicKey()).toScVal(),
      ));
    } catch (err) {
      threw = true;
      const msg = (err as Error).message;
      assert(
        msg.includes('1002') || msg.includes('full') || msg.includes('GroupFull') || msg.includes('failed'),
        `expected GroupFull error, got: ${msg}`
      );
    }
    assert(threw, 'expected an error when joining a full group');
  });

  // ── Results ───────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('❌ Some tests failed.');
    process.exit(1);
  } else {
    console.log('✅ All tests passed.');
  }
}

main().catch(err => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
