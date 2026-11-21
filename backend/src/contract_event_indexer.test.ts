import { ContractEventIndexer } from './contract_event_indexer';

describe('ContractEventIndexer (integration)', () => {
  let indexer: ContractEventIndexer;

  beforeEach(() => {
    indexer = new ContractEventIndexer();
  });

  it('indexes a single event and exposes it via getEvents', () => {
    indexer.indexEvent({
      contractId: 'CABC',
      eventName: 'contribute',
      ledger: 100,
      txHash: 'tx1',
      data: { amount: 10 },
    });

    const events = indexer.getEvents('CABC');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      contractId: 'CABC',
      eventName: 'contribute',
      ledger: 100,
      txHash: 'tx1',
    });
  });

  it('keeps events ordered by ledger across multiple contracts', () => {
    indexer.indexEvent({ contractId: 'A', eventName: 'e1', ledger: 5, txHash: 't1', data: {} });
    indexer.indexEvent({ contractId: 'A', eventName: 'e2', ledger: 2, txHash: 't2', data: {} });
    indexer.indexEvent({ contractId: 'B', eventName: 'e3', ledger: 9, txHash: 't3', data: {} });

    const aEvents = indexer.getEvents('A');
    expect(aEvents.map((e) => e.ledger)).toEqual([2, 5]);
    expect(indexer.getEvents('B')).toHaveLength(1);
  });

  it('returns an empty array for an unknown contract', () => {
    expect(indexer.getEvents('UNKNOWN')).toEqual([]);
  });

  it('is idempotent for duplicate txHash events', () => {
    const event = { contractId: 'C', eventName: 'e', ledger: 1, txHash: 'dup', data: {} };
    indexer.indexEvent(event);
    indexer.indexEvent(event);

    expect(indexer.getEvents('C')).toHaveLength(1);
  });

  it('rejects events with a missing txHash', () => {
    expect(() =>
      indexer.indexEvent({ contractId: 'C', eventName: 'e', ledger: 1, txHash: '', data: {} }),
    ).toThrow();
  });

  it('clears indexed events on reset', () => {
    indexer.indexEvent({ contractId: 'C', eventName: 'e', ledger: 1, txHash: 't', data: {} });
    indexer.reset();
    expect(indexer.getEvents('C')).toEqual([]);
  });
});
