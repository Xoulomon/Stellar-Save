/** Display helpers shared by the recovery panels. */

/** Abbreviate a Stellar address for display: `GABCDE…WXYZ`. */
export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
