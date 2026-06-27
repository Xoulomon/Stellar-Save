#!/usr/bin/env node
/**
 * Chaos Experiment Runner  (#1042)
 *
 * Executes one or all chaos experiments defined in experiments.json against a
 * target environment.  Designed to run in CI (GitHub Actions) or manually.
 *
 * Usage:
 *   node chaos/runner.js [experiment-id|all] [--dry-run]
 *
 * Environment variables:
 *   BACKEND_URL       – Base URL of the backend (e.g. https://staging.stellar-save.app)
 *   STELLAR_RPC_URL   – Soroban RPC endpoint (used by soroban-rpc-outage experiment)
 *   REDIS_URL         – Redis connection URL  (used by redis-eviction experiment)
 *   CHAOS_DRY_RUN     – Set to "true" to print steps without executing them
 *
 * Exit codes:
 *   0  – all experiments passed
 *   1  – one or more experiments failed
 *   2  – usage error
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const BACKEND_URL    = process.env.BACKEND_URL || 'http://localhost:3001';
const STELLAR_RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
const REDIS_URL      = process.env.REDIS_URL || 'redis://localhost:6379';
const DRY_RUN        = process.env.CHAOS_DRY_RUN === 'true' || process.argv.includes('--dry-run');

const EXPERIMENTS_FILE = path.join(__dirname, 'experiments.json');

// ── Load experiment definitions ───────────────────────────────────────────────

/** @type {{ version: string; experiments: any[] }} */
const manifest = JSON.parse(fs.readFileSync(EXPERIMENTS_FILE, 'utf8'));

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function httpGet(url, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return { status: res.status, ok: res.ok };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function interpolate(str) {
  return str
    .replace(/\$\{BACKEND_URL\}/g,     BACKEND_URL)
    .replace(/\$\{STELLAR_RPC_URL\}/g, STELLAR_RPC_URL)
    .replace(/\$\{REDIS_URL\}/g,        REDIS_URL);
}

function log(tag, msg, ...rest) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${tag}] ${msg}`, ...rest);
}

// ── Step executors ────────────────────────────────────────────────────────────

async function executeStep(step, experimentId) {
  const action = step.action;
  log(experimentId, `Step: ${action}`);

  if (DRY_RUN) {
    log(experimentId, `  [DRY-RUN] Would execute: ${JSON.stringify(step)}`);
    return;
  }

  switch (action) {
    case 'block_url': {
      // Extract hostname from URL and drop packets via iptables
      const hostname = new URL(interpolate(step.target)).hostname;
      log(experimentId, `  Blocking traffic to ${hostname} for ${step.durationSeconds}s`);
      try {
        execSync(`sudo iptables -A OUTPUT -d ${hostname} -j DROP 2>/dev/null || true`);
        await sleep(step.durationSeconds * 1000);
      } finally {
        execSync(`sudo iptables -D OUTPUT -d ${hostname} -j DROP 2>/dev/null || true`);
      }
      break;
    }

    case 'restore_network': {
      const hostname = new URL(interpolate(step.target)).hostname;
      execSync(`sudo iptables -D OUTPUT -d ${hostname} -j DROP 2>/dev/null || true`);
      log(experimentId, `  Network restored to ${hostname}`);
      break;
    }

    case 'tc_netem_add_latency': {
      log(experimentId, `  Adding ${step.latencyMs}ms latency on port ${step.dstPort} for ${step.durationSeconds}s`);
      // Add tc qdisc — requires iproute2 + root
      execSync(
        `sudo tc qdisc add dev ${step.interface} root handle 1: prio 2>/dev/null || true && ` +
        `sudo tc qdisc add dev ${step.interface} parent 1:3 handle 30: netem delay ${step.latencyMs}ms ${step.jitterMs}ms && ` +
        `sudo tc filter add dev ${step.interface} protocol ip parent 1:0 prio 3 u32 match ip dport ${step.dstPort} 0xffff flowid 1:3`
      );
      await sleep(step.durationSeconds * 1000);
      break;
    }

    case 'tc_netem_remove': {
      log(experimentId, `  Removing latency injection on port ${step.dstPort}`);
      execSync(`sudo tc qdisc del dev ${step.interface} root 2>/dev/null || true`);
      break;
    }

    case 'redis_flushdb': {
      const redisUrl = interpolate(step.target);
      log(experimentId, `  Flushing Redis at ${redisUrl}`);
      // Use redis-cli if available, otherwise skip gracefully
      const result = spawnSync('redis-cli', ['-u', redisUrl, 'FLUSHDB'], { encoding: 'utf8' });
      if (result.error) {
        log(experimentId, `  redis-cli not available, skipping flush: ${result.error.message}`);
      } else {
        log(experimentId, `  Redis flush result: ${result.stdout.trim()}`);
      }
      break;
    }

    case 'kill_process': {
      log(experimentId, `  Killing process matching "${step.target}" with ${step.signal}`);
      const result = spawnSync('pkill', ['-f', step.target], { encoding: 'utf8' });
      log(experimentId, `  pkill exit: ${result.status}`);
      break;
    }

    case 'assert_health': {
      const url = interpolate(step.endpoint);
      const allowed = step.expectedStatusCodes || [step.expectedStatusCode];
      const timeout = (step.timeoutSeconds || 30) * 1000;
      const poll = (step.pollIntervalSeconds || 5) * 1000;
      const deadline = Date.now() + timeout;
      let last;
      while (Date.now() < deadline) {
        last = await httpGet(url, 10_000);
        if (allowed.includes(last.status)) {
          log(experimentId, `  Health check passed: ${url} → ${last.status}`);
          return;
        }
        log(experimentId, `  Health check ${url} returned ${last.status}, retrying…`);
        await sleep(poll);
      }
      throw new Error(`Health check failed after ${step.timeoutSeconds}s: ${url} last status ${last?.status}`);
    }

    case 'assert_recovery': {
      const url = interpolate(step.endpoint);
      const deadline = Date.now() + (step.withinSeconds || 30) * 1000;
      while (Date.now() < deadline) {
        const r = await httpGet(url, 10_000);
        if (r.status === (step.expectedStatusCode || 200)) {
          log(experimentId, `  Recovery confirmed: ${url} → ${r.status}`);
          return;
        }
        await sleep(3000);
      }
      throw new Error(`Recovery not confirmed within ${step.withinSeconds}s for ${url}`);
    }

    case 'assert_data_integrity': {
      const url = interpolate(step.endpoint);
      const r = await httpGet(url, 10_000);
      if (!r.ok) throw new Error(`Data integrity check failed: ${url} returned ${r.status}`);
      log(experimentId, `  Data integrity check passed: ${url} → ${r.status}`);
      break;
    }

    case 'load_test': {
      // Simple sequential load test — avoids external dependencies
      const url = interpolate(step.endpoint);
      const total = step.requests || 20;
      let passed = 0;
      for (let i = 0; i < total; i++) {
        const r = await httpGet(url, 10_000);
        if (r.ok) passed++;
      }
      const rate = (passed / total) * 100;
      log(experimentId, `  Load test: ${passed}/${total} (${rate.toFixed(1)}%) passed`);
      if (rate < (step.assertSuccessRate || 99)) {
        throw new Error(`Success rate ${rate.toFixed(1)}% below threshold ${step.assertSuccessRate}%`);
      }
      break;
    }

    case 'benchmark': {
      const url = interpolate(step.endpoint);
      const rps = step.rps || 5;
      const duration = step.durationSeconds || 30;
      const totalReqs = rps * duration;
      const intervalMs = 1000 / rps;
      const latencies = [];
      for (let i = 0; i < totalReqs; i++) {
        const start = Date.now();
        await httpGet(url, 15_000);
        latencies.push(Date.now() - start);
        await sleep(Math.max(0, intervalMs - (Date.now() - start)));
      }
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)];
      log(experimentId, `  Benchmark p95=${p95}ms (threshold ${step.assertP95Ms}ms)`);
      if (p95 > step.assertP95Ms) {
        throw new Error(`p95 latency ${p95}ms exceeds threshold ${step.assertP95Ms}ms`);
      }
      break;
    }

    default:
      log(experimentId, `  Unknown step action: ${action} — skipping`);
  }
}

// ── Run one experiment ────────────────────────────────────────────────────────

async function runExperiment(exp) {
  log(exp.id, `Starting experiment: "${exp.name}"`);
  log(exp.id, `Category: ${exp.category} | Duration: ${exp.durationSeconds}s`);
  log(exp.id, `Expected: ${exp.expectedBehavior}`);

  const startMs = Date.now();
  let passed = true;
  let error = null;

  try {
    for (const step of exp.steps) {
      const interpolatedStep = JSON.parse(JSON.stringify(step), (k, v) =>
        typeof v === 'string' ? interpolate(v) : v
      );
      await executeStep(interpolatedStep, exp.id);
    }
  } catch (err) {
    passed = false;
    error = err.message;
    log(exp.id, `❌ Experiment FAILED: ${error}`);
  }

  const durationMs = Date.now() - startMs;

  if (exp.cooldownSeconds > 0 && !DRY_RUN) {
    log(exp.id, `Cooldown: ${exp.cooldownSeconds}s`);
    await sleep(exp.cooldownSeconds * 1000);
  }

  const result = {
    id: exp.id,
    name: exp.name,
    passed,
    error,
    durationMs,
    timestamp: new Date().toISOString(),
  };

  log(exp.id, passed ? `✅ PASSED (${durationMs}ms)` : `❌ FAILED (${durationMs}ms): ${error}`);
  return result;
}

// ── Entry point ───────────────────────────────────────────────────────────────

async function main() {
  const target = process.argv[2] || 'all';
  const experiments = target === 'all'
    ? manifest.experiments
    : manifest.experiments.filter(e => e.id === target);

  if (experiments.length === 0) {
    console.error(`No experiments found for target: ${target}`);
    console.error('Available:', manifest.experiments.map(e => e.id).join(', '));
    process.exit(2);
  }

  log('runner', `Running ${experiments.length} experiment(s)${DRY_RUN ? ' [DRY-RUN]' : ''}`);

  const results = [];
  for (const exp of experiments) {
    results.push(await runExperiment(exp));
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n═══ Chaos Experiment Summary ═══');
  for (const r of results) {
    console.log(`${r.passed ? '✅' : '❌'}  ${r.id.padEnd(30)} ${r.passed ? 'PASS' : 'FAIL'} (${r.durationMs}ms)${r.error ? ' — ' + r.error : ''}`);
  }

  // Write GITHUB_STEP_SUMMARY if running in Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      '## Chaos Experiment Results',
      '',
      '| Experiment | Result | Duration | Error |',
      '|-----------|--------|----------|-------|',
      ...results.map(r =>
        `| ${r.name} | ${r.passed ? '✅ PASS' : '❌ FAIL'} | ${r.durationMs}ms | ${r.error || '-'} |`
      ),
    ];
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n');
  }

  const anyFailed = results.some(r => !r.passed);
  process.exit(anyFailed ? 1 : 0);
}

main().catch(err => {
  console.error('Runner error:', err);
  process.exit(1);
});
