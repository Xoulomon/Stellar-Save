import { describe, it, expect } from 'vitest';

function formatAmount(amount: number): string {
  return `${amount} XLM`;
}

describe('Utils', () => {
  it('formats amount correctly', () => {
    expect(formatAmount(100)).toBe('100 XLM');
    expect(formatAmount(0)).toBe('0 XLM');
  });
});
