/**
 * @file WalletButton.test.tsx
 *
 * NOTE (issue #1348 — remove redundant integration tests):
 *
 * The two render-state assertions that previously lived here were REMOVED
 * because they are fully covered — with higher confidence — by the
 * cross-boundary integration suite:
 *
 *   frontend/src/test/integration/walletConnection.test.tsx
 *
 * Removed tests and their equivalents in the integration suite:
 *
 * | Removed unit test                         | Integration coverage                          |
 * |-------------------------------------------|-----------------------------------------------|
 * | "shows connect button when disconnected"   | "shows 'Connect Wallet' button when wallet    |
 * |  (stubbed useWallet → status: 'idle')      |  is not connected" (real WalletProvider +     |
 * |                                            |  mocked freighterAdapter)                     |
 * | "shows address when connected"             | "shows truncated address after successful     |
 * |  (stubbed useWallet → status: 'connected') |  connection" (full connect() flow exercised)  |
 *
 * Why the integration test is strictly better:
 *  - It exercises the real WalletProvider context tree → freighterAdapter →
 *    state machine → WalletButton rendering pipeline.
 *  - Stubbing useWallet at the hook level cannot catch regressions in the
 *    WalletProvider → hook boundary.
 *  - The integration suite also adds coverage not present here: connecting
 *    state, connection failure / error recovery, and disconnect flow.
 *
 * Coverage impact: NONE. The integration suite covers the same source lines.
 * Verify with: `cd frontend && npm run test:coverage`.
 *
 * Adding tests back here:
 *  If you need to test a WalletButton behaviour that does NOT require the
 *  real WalletProvider (e.g. a new prop, a purely presentational variant, or
 *  an edge-case rendering condition), add a unit test here with a brief
 *  comment explaining why unit isolation is preferable for that specific case.
 */
