# zk/circuits

Circom circuit definitions, plus a constraint-satisfaction test suite for each.

- `membership_proof.circom` — proves a user attribute (KYC tier, credit score)
  clears a threshold without revealing the raw value. Public inputs are
  `threshold` and `commitment`; `value` and `salt` stay private.

`circomlib` is included by **relative path** (`node_modules/circomlib/circuits/…`),
so it has to be installed into this directory rather than hoisted to a workspace
root. `zk/` is outside the pnpm workspace, so `npm install` here is local and
does not touch the monorepo lockfile.

## Running the tests

```bash
cd zk/circuits
npm install          # circomlib, circomlibjs, snarkjs
npm test
```

`npm test` compiles the circuit, then runs every case and exits non-zero if any
of them fail. Expected output:

```
circom 2.1.6

[  ok  ] valid witness satisfies every constraint
[  ok  ] value exactly at the threshold is accepted
[  ok  ] value far above the threshold is accepted
[  ok  ] value below the threshold is rejected
[  ok  ] threshold one above the value is rejected
[  ok  ] mismatched commitment is rejected
[  ok  ] commitment from a different salt is rejected
[  ok  ] tampered witness fails constraint checking

8/8 circuit tests passed
```

### Toolchain

`circom` is a separate binary and is not an npm dependency:

```bash
cargo install --git https://github.com/iden3/circom circom
# or
npm install -g circom2
```

`snarkjs` and `circomlibjs` come from `package.json`. `circomlibjs` is used to
compute the Poseidon commitments the test inputs need — the suite derives them
at runtime rather than hard-coding digests, so the positive cases cannot drift
away from the circuit's own hashing.

Both tools are checked at startup; a missing one exits with the install command
rather than a stack trace.

## What the tests cover, and why

A circuit that compiles is not a circuit that is correct. The interesting
failure modes for this kind of circuit are all *semantic*: an inverted
comparison, a commitment that fails to bind the value, a comparator that
saturates. Each of those still compiles, still generates a proof, and still
verifies — it just proves something false. So the suite is built around three
questions:

**Positive — does a valid witness satisfy every constraint?**
`expectSatisfiable` generates a witness and then runs `snarkjs wtns check`
against the generated R1CS. Generating alone is not enough: a witness can be
produced and still not satisfy the constraint system.

The `value exactly at the threshold` case is load-bearing. The circuit uses
`GreaterEqThan(252)`, so `value == threshold` must be accepted; a drift to a
strict comparison would pass every other case in this file.

**Negative — is a witness that should not exist actually rejected?**
`expectUnsatisfiable` covers both ways a circuit can refuse an input:

- Circom asserts `===` constraints while building the witness, so most bad
  inputs abort there with an assert failure.
- A circuit that only *records* such a constraint would produce a witness
  anyway and be caught by `snarkjs wtns check`.

The helper accepts either outcome, because the property under test is "no
satisfying assignment exists" rather than which stage noticed.

**Negative — does a tampered witness get caught?**
The last case is the one that cannot be reached through the input API. It
generates a valid witness, then edits the `threshold` signal **inside the
`.wtns` container** to sit one above the committed value, and requires
`snarkjs wtns check` to reject the result. The witness therefore still claims
`value = 900` while asserting a 901 requirement — a witness no honest prover
would produce, and the case a user of the verifier is actually exposed to.

The signal is located by **value** rather than by a hard-coded witness index.
Indices shift whenever circom changes its signal ordering, and a stale index
would silently patch an unrelated signal and turn this into a test that always
passes. The helper requires exactly one match and fails loudly otherwise.

## Adding a circuit

1. Add `<name>.circom` here.
2. Add a `describe`-equivalent block of cases to
   `test/run-circuit-tests.mjs`, and set `CIRCUIT_NAME` (or parameterise the
   runner per circuit).
3. Add `"test:<name>"` / `"compile:<name>"` scripts if the circuit needs
   different flags.

Keep at least one positive, one boundary case, and one tampered-witness case
per circuit. A circuit with only positive cases is untested for the failure that
matters.
