import { ContractEventIndexer } from '../contract_event_indexer';

describe('ContractEventIndexer', () => {
  it('should be a class', () => {
    expect(typeof ContractEventIndexer).toBe('function');
    expect(ContractEventIndexer.prototype).toBeDefined();
  });

  it('should have required methods', () => {
    const methods = ['start', 'stop', 'getEvents'];
    methods.forEach(method => {
      expect(typeof (ContractEventIndexer.prototype as any)[method]).toBe('function');
    });
  });
});