import {
  evaluateAmbassadorStatus,
  getAmbassadorProfile,
  getAmbassadorLeaderboard,
  distributeRewards,
  saveAmbassadorProfile,
  AmbassadorTier,
} from '../ambassador_service';

describe('ambassador_service', () => {
  describe('evaluateAmbassadorStatus', () => {
    it('returns Gold when all Gold thresholds are met', () => {
      expect(evaluateAmbassadorStatus('addr', 0.95, 30, 10)).toBe(AmbassadorTier.Gold);
    });

    it('returns Silver when Silver thresholds are met but not Gold', () => {
      expect(evaluateAmbassadorStatus('addr', 0.85, 15, 3)).toBe(AmbassadorTier.Silver);
    });

    it('returns Bronze when Bronze thresholds are met but not Silver', () => {
      expect(evaluateAmbassadorStatus('addr', 0.7, 5, 0)).toBe(AmbassadorTier.Bronze);
    });

    it('returns null when no tier threshold is met', () => {
      expect(evaluateAmbassadorStatus('addr', 0.5, 1, 0)).toBeNull();
    });
  });

  describe('saveAmbassadorProfile / getAmbassadorProfile', () => {
    it('returns null for an address with no saved profile', () => {
      expect(getAmbassadorProfile('GUNKNOWNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')).toBeNull();
    });

    it('creates a new profile with zero rewards earned', () => {
      const profile = saveAmbassadorProfile('addr-1', AmbassadorTier.Bronze, 0.7, 5, 0);

      expect(profile.rewardsEarned).toBe(0);
      expect(getAmbassadorProfile('addr-1')).toEqual(profile);
    });

    it('preserves rewardsEarned and awardedAt when re-saving an existing profile', () => {
      const first = saveAmbassadorProfile('addr-2', AmbassadorTier.Bronze, 0.7, 5, 0);
      distributeRewards('addr-2', 100);

      const updated = saveAmbassadorProfile('addr-2', AmbassadorTier.Silver, 0.85, 15, 3);

      expect(updated.rewardsEarned).toBe(100);
      expect(updated.awardedAt).toEqual(first.awardedAt);
      expect(updated.tier).toBe(AmbassadorTier.Silver);
    });
  });

  describe('distributeRewards', () => {
    it('adds the amount to the existing rewardsEarned total', () => {
      saveAmbassadorProfile('addr-3', AmbassadorTier.Bronze, 0.7, 5, 0);

      distributeRewards('addr-3', 50);
      distributeRewards('addr-3', 25);

      expect(getAmbassadorProfile('addr-3')?.rewardsEarned).toBe(75);
    });

    it('throws when no profile exists for the address', () => {
      expect(() => distributeRewards('GNOPROFILEXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 10)).toThrow(
        /No ambassador profile found/
      );
    });
  });

  describe('getAmbassadorLeaderboard', () => {
    it('sorts profiles by reputationScore descending', () => {
      saveAmbassadorProfile('addr-low', AmbassadorTier.Bronze, 0.71, 5, 0);
      saveAmbassadorProfile('addr-high', AmbassadorTier.Gold, 0.96, 30, 10);

      const leaderboard = getAmbassadorLeaderboard();
      const lowIndex = leaderboard.findIndex((p) => p.address === 'addr-low');
      const highIndex = leaderboard.findIndex((p) => p.address === 'addr-high');

      expect(highIndex).toBeLessThan(lowIndex);
    });
  });
});
