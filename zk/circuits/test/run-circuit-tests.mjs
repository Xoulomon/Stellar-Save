#!/usr/bin/env node
/* eslint-disable no-console -- this is a CLI test runner; its output IS the result. */
/**
 * Constraint-satisfaction tests for the circuits in this directory.
 *
 * The circuits here guard attributes that must never be revealed on-chain
 * (see CIRCUIT_AUDIT.md), so "does it compile" is not the question worth
 * asking. The questions are:
 *
 *   1. Does a *valid* witness satisfy every constraint?  (positive)
 *   2. Is there any input that should be rejected but is accepted?
 *      (negative, driven through the witness calculator)
 *   3. If a witness is altered after the fact, does the R1CS still accept it?
 *      (negative, driven through `snarkjs wtns check`)
 *
 * A suite that only proves (1) is close to worthless for a ZK subsystem: a
 * circuit with its comparison inverted compiles, proves, and verifies — it
 * just proves the wrong thing. Cases 2 and 3 exist to catch exactly that.
 *
 * Usage:  npm test          (from zk/circuits)
 *         node test/run-circuit-tests.mjs
 *
 * Requires `circom` and `snarkjs`; see ../README.md for install instructions.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPoseidon } from 'circomlibjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CIRCUIT_DIR = path.resolve(HERE, '..');
const CIRCUIT_NAME = 'membership_proof';

// ── process helpers ───────────────────────────────────────────────────────────

/** Run a command, returning success plus captured output instead of throwing. */
function run(cmd, args) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: stdout };
  } catch (err) {
    return {
      ok: false,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}${err.message ?? ''}`,
    };
  }
}

function requireTool(cmd, hint) {
  const probe = run(cmd, ['--version']);
  if (!probe.ok) {
    console.error(`\n  Missing required tool: ${cmd}\n  ${hint}\n`);
    process.exit(1);
  }
  return probe.output.trim().split('\n')[0];
}

// ── .wtns binary layout ───────────────────────────────────────────────────────
//
// Modifying a witness in place is what makes the tamper case a real test of
// constraint satisfaction rather than just another input-validation test. The
// container is small and fixed-layout, so we can locate a signal's bytes and
// overwrite them without a full re-serialiser.
//
//   magic "wtns" | version | nSections
//   section 1 (header): id=1 | n8 | prime | nWitness
//   section 2 (data):   id=2 | n8 | witness[nWitness]   (field elements, LE)

function readWtnsLayout(buf) {
  if (buf.length < 32 || buf.toString('utf8', 0, 4) !== 'wtns') {
    throw new Error('not a .wtns container (bad magic)');
  }

  let off = 12; // past magic, version, nSections

  const headerId = buf.readUInt32LE(off);
  off += 4;
  if (headerId !== 1) {
    throw new Error(`expected witness header section 1, found ${headerId}`);
  }

  const n8 = buf.readUInt32LE(off);
  off += 4;
  off += n8; // skip the field prime; we never need to reduce modulo it

  const nWitness = buf.readUInt32LE(off);
  off += 4;

  const dataId = buf.readUInt32LE(off);
  off += 4;
  if (dataId !== 2) {
    throw new Error(`expected witness data section 2, found ${dataId}`);
  }

  const dataN8 = buf.readUInt32LE(off);
  off += 4;
  if (dataN8 !== n8) {
    throw new Error(`witness field width mismatch: header ${n8}, data ${dataN8}`);
  }

  return { n8, nWitness, dataOffset: off };
}

function readFieldLE(buf, offset, n8) {
  let value = 0n;
  for (let i = n8 - 1; i >= 0; i--) {
    value = (value << 8n) | BigInt(buf[offset + i]);
  }
  return value;
}

function writeFieldLE(buf, offset, n8, value) {
  let remaining = BigInt(value);
  for (let i = 0; i < n8; i++) {
    buf[offset + i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

/** Index of the single witness entry equal to `value`, ignoring the constant slot. */
function findWitnessIndex(buf, layout, value) {
  const target = BigInt(value);
  const matches = [];
  for (let i = 1; i < layout.nWitness; i++) {
    const at = layout.dataOffset + i * layout.n8;
    if (readFieldLE(buf, at, layout.n8) === target) {
      matches.push(i);
    }
  }
  return matches;
}

// ── assertions ────────────────────────────────────────────────────────────────

const results = [];

function record(name, passed, detail) {
  results.push({ name, passed, detail });
  const mark = passed ? '  ok  ' : ' FAIL ';
  console.log(`[${mark}] ${name}`);
  if (!passed && detail) {
    console.log(
      detail
        .trim()
        .split('\n')
        .slice(0, 12)
        .map((line) => `         ${line}`)
        .join('\n'),
    );
  }
}

// ── circuit-level checks ──────────────────────────────────────────────────────
//
// Both rejection paths are accepted for an unsatisfiable case. Circom asserts
// `===` constraints while building the witness, so most bad inputs fail there;
// a circuit that instead only records the constraint would generate a witness
// and be caught by `wtns check`. Accepting either is deliberate — the property
// under test is "no satisfying assignment exists", not which stage noticed.

function expectSatisfiable(ctx, label, input) {
  const inputPath = ctx.writeInput(label, input);
  const witnessPath = path.join(ctx.tmp, `${label}.wtns`);

  const generated = run('snarkjs', [
    'wtns',
    'calculate',
    ctx.wasmPath,
    inputPath,
    witnessPath,
  ]);
  if (!generated.ok) {
    record(label, false, `witness generation failed for a valid input:\n${generated.output}`);
    return null;
  }

  const checked = run('snarkjs', ['wtns', 'check', ctx.r1csPath, witnessPath]);
  record(
    label,
    checked.ok,
    checked.ok ? '' : `witness generated but failed constraint checking:\n${checked.output}`,
  );
  return checked.ok ? witnessPath : null;
}

function expectUnsatisfiable(ctx, label, input) {
  const inputPath = ctx.writeInput(label, input);
  const witnessPath = path.join(ctx.tmp, `${label}.wtns`);

  const generated = run('snarkjs', [
    'wtns',
    'calculate',
    ctx.wasmPath,
    inputPath,
    witnessPath,
  ]);

  if (!generated.ok) {
    // Rejected while building the witness — the common circom behaviour.
    record(label, true);
    return;
  }

  // Generated anyway, so the constraint has to be what stops it.
  const checked = run('snarkjs', ['wtns', 'check', ctx.r1csPath, witnessPath]);
  if (!checked.ok) {
    record(label, true);
    return;
  }

  record(
    label,
    false,
    'input should have been rejected but produced a satisfying witness',
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const circomVersion = requireTool(
    'circom',
    'Install with `cargo install --git https://github.com/iden3/circom circom`,\n' +
      '  or `npm i -g circom2`, then re-run.',
  );
  requireTool(
    'snarkjs',
    'Install with `npm install` inside zk/circuits, or `npm i -g snarkjs`.',
  );
  console.log(`circom ${circomVersion}\n`);

  if (!existsSync(path.join(CIRCUIT_DIR, 'node_modules', 'circomlib'))) {
    console.error(
      '\n  circomlib is not installed at zk/circuits/node_modules/circomlib.\n' +
        '  The circuit includes it by relative path; run `npm install` in zk/circuits.\n',
    );
    process.exit(1);
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'zk-circuits-'));
  const poseidon = await buildPoseidon();

  const commit = (value, salt) => poseidon.F.toString(poseidon([value, salt]));

  const ctx = {
    tmp,
    r1csPath: path.join(tmp, `${CIRCUIT_NAME}.r1cs`),
    wasmPath: path.join(tmp, `${CIRCUIT_NAME}_js`, `${CIRCUIT_NAME}.wasm`),
    writeInput(label, input) {
      const p = path.join(tmp, `${label}.input.json`);
      writeFileSync(p, `${JSON.stringify(input, null, 2)}\n`, 'utf8');
      return p;
    },
  };

  try {
    const compiled = run('circom', [
      `${CIRCUIT_NAME}.circom`,
      '--r1cs',
      '--wasm',
      '--sym',
      '-o',
      tmp,
    ]);
    if (!compiled.ok) {
      console.error('\n  Circuit failed to compile:\n');
      console.error(compiled.output);
      process.exit(1);
    }

    // ── positive ────────────────────────────────────────────────────────────

    // 700 comfortably over a 500 threshold, with a real Poseidon commitment.
    expectSatisfiable(ctx, 'valid witness satisfies every constraint', {
      value: '700',
      salt: '12345',
      threshold: '500',
      commitment: commit(700n, 12345n),
    });

    // The comparator is GreaterEqThan, so exactly-at-threshold is legal. An
    // off-by-one that turned this into a strict comparison would be invisible
    // in every other case here.
    expectSatisfiable(ctx, 'value exactly at the threshold is accepted', {
      value: '500',
      salt: '999',
      threshold: '500',
      commitment: commit(500n, 999n),
    });

    // A large value must not overflow the 252-bit comparator.
    expectSatisfiable(ctx, 'value far above the threshold is accepted', {
      value: '1000000000000',
      salt: '42',
      threshold: '1',
      commitment: commit(1000000000000n, 42n),
    });

    // ── negative: rejected through the witness calculator ───────────────────

    expectUnsatisfiable(ctx, 'value below the threshold is rejected', {
      value: '499',
      salt: '12345',
      threshold: '500',
      commitment: commit(499n, 12345n),
    });

    // Same, on the other side of the boundary.
    expectUnsatisfiable(ctx, 'threshold one above the value is rejected', {
      value: '499',
      salt: '7',
      threshold: '500',
      commitment: commit(499n, 7n),
    });

    // Commitment is bound to (value, salt) by Poseidon, so a commitment that
    // does not match the revealed value must not verify — otherwise the
    // attribute could be swapped for someone else's.
    expectUnsatisfiable(ctx, 'mismatched commitment is rejected', {
      value: '700',
      salt: '12345',
      threshold: '500',
      commitment: commit(701n, 12345n),
    });

    expectUnsatisfiable(ctx, 'commitment from a different salt is rejected', {
      value: '700',
      salt: '12345',
      threshold: '500',
      commitment: commit(700n, 54321n),
    });

    // ── negative: tampered witness ──────────────────────────────────────────

    const salt = 31337n;
    const threshold = 500n;
    const value = 900n;

    const goodWitness = ctx.writeInput('tamper-source', {
      value: value.toString(),
      salt: salt.toString(),
      threshold: threshold.toString(),
      commitment: commit(value, salt),
    });
    const srcWitness = path.join(tmp, 'tamper-source.wtns');

    const generated = run('snarkjs', [
      'wtns',
      'calculate',
      ctx.wasmPath,
      goodWitness,
      srcWitness,
    ]);
    if (!generated.ok) {
      record(
        'tampered witness fails constraint checking',
        false,
        `could not build the source witness to tamper with:\n${generated.output}`,
      );
    } else {
      const buf = readFileSync(srcWitness);
      const layout = readWtnsLayout(buf);

      // `threshold` is public, so it occupies a dedicated witness slot. Find it
      // by value rather than by hard-coding an index: the witness layout grows
      // whenever circom changes how it orders signals, and a stale index would
      // silently patch the wrong signal and make this test meaningless.
      const matches = findWitnessIndex(buf, layout, threshold);
      if (matches.length !== 1) {
        record(
          'tampered witness fails constraint checking',
          false,
          `expected exactly one witness slot holding ${threshold}, found ${matches.length}`,
        );
      } else {
        const index = matches[0];

        // Raise the threshold above the committed value. The witness still
        // says value=900, but now claims a requirement of 901.
        writeFieldLE(
          buf,
          layout.dataOffset + index * layout.n8,
          layout.n8,
          value + 1n,
        );

        const tampered = path.join(tmp, 'tampered.wtns');
        writeFileSync(tampered, buf);

        const checked = run('snarkjs', ['wtns', 'check', ctx.r1csPath, tampered]);
        record(
          'tampered witness fails constraint checking',
          !checked.ok,
          checked.ok
            ? `witness slot ${index} was raised to ${value + 1n} and the R1CS still accepted it`
            : '',
        );
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${results.length - failed.length}/${results.length} circuit tests passed\n`,
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
