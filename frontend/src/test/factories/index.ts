/**
 * Shared test factories for Stellar-Save frontend tests.
 *
 * All factories accept an optional `overrides` partial so callers only need
 * to specify the fields that differ from the defaults.
 *
 * @example
 * import { makeGroup, makeMember, makeTransaction } from '../factories';
 *
 * const group = makeGroup({ name: 'My Circle', memberCount: 8 });
 * const member = makeMember({ hasReceivedPayout: true });
 * const tx = makeTransaction({ status: 'pending' });
 */

export { makeGroup, makePublicGroup } from './groupFactory';
export { makeMember, makeContributionCycleMember } from './memberFactory';
export { makeContribution, makeContributionCycle } from './contributionFactory';
export { makeTransaction } from './transactionFactory';
