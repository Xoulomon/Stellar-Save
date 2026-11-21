import {
  screenTransaction,
  flagTransaction,
  getFlaggedTransactions,
  reviewFlag,
  getAuditLog,
  RiskLevel,
  MOCK_SANCTIONED_ADDRESSES,
  HIGH_VALUE_THRESHOLD,
} from '../aml_service';

const [SANCTIONED_ADDRESS] = MOCK_SANCTIONED_ADDRESSES;
const CLEAN_ADDRESS = 'GCLEANADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

describe('aml_service', () => {
  describe('screenTransaction', () => {
    it('does not flag a clean, low-value transaction', () => {
      const result = screenTransaction(CLEAN_ADDRESS, 'tx-1', 10);
      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.reasons).toEqual([]);
    });

    it('flags a sanctioned address as CRITICAL', () => {
      const result = screenTransaction(SANCTIONED_ADDRESS, 'tx-2', 10);
      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.reasons).toContain('sanctioned_address');
    });

    it('flags a high-value transaction as MEDIUM', () => {
      const result = screenTransaction(CLEAN_ADDRESS, 'tx-3', HIGH_VALUE_THRESHOLD + 1);
      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(result.reasons).toContain('high_value');
    });

    it('flags rapid succession once three transactions occur within the window', () => {
      const address = 'GRAPIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      screenTransaction(address, 'tx-a', 1);
      screenTransaction(address, 'tx-b', 1);
      const result = screenTransaction(address, 'tx-c', 1);
      expect(result.reasons).toContain('rapid_succession');
    });

    it('escalates to HIGH risk when both high_value and rapid_succession apply', () => {
      const address = 'GCOMBOXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
      screenTransaction(address, 'tx-a', HIGH_VALUE_THRESHOLD + 1);
      screenTransaction(address, 'tx-b', HIGH_VALUE_THRESHOLD + 1);
      const result = screenTransaction(address, 'tx-c', HIGH_VALUE_THRESHOLD + 1);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });
  });

  describe('flagTransaction / getFlaggedTransactions / reviewFlag / getAuditLog', () => {
    it('stores a flag and surfaces it as unreviewed', () => {
      const result = screenTransaction(SANCTIONED_ADDRESS, 'tx-flagged', 1);
      const flag = flagTransaction(SANCTIONED_ADDRESS, 'tx-flagged', result);

      expect(flag.reviewed).toBe(false);
      expect(getFlaggedTransactions().some((f) => f.id === flag.id)).toBe(true);
    });

    it('removes a flag from the unreviewed list once reviewed', () => {
      const result = screenTransaction(SANCTIONED_ADDRESS, 'tx-review', 1);
      const flag = flagTransaction(SANCTIONED_ADDRESS, 'tx-review', result);

      reviewFlag(flag.id, 'compliance-officer', 'approved', 'looks fine');

      expect(getFlaggedTransactions().some((f) => f.id === flag.id)).toBe(false);
      const audited = getAuditLog().find((f) => f.id === flag.id);
      expect(audited?.reviewed).toBe(true);
      expect(audited?.reviewedBy).toBe('compliance-officer');
      expect(audited?.decision).toBe('approved');
      expect(audited?.notes).toBe('looks fine');
    });

    it('throws when reviewing a flag that does not exist', () => {
      expect(() => reviewFlag('does-not-exist', 'someone', 'rejected')).toThrow(
        'Flag does-not-exist not found'
      );
    });
  });
});
