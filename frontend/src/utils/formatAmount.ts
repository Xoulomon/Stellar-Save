export interface FormatAmountOptions {
  decimals?: number;
  symbol?: string;
  showSymbol?: boolean;
}

export function formatAmount(
  amount: number | string,
  { decimals = 7, symbol = 'XLM', showSymbol = true }: FormatAmountOptions = {}
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) return showSymbol ? `0 ${symbol}` : '0';

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `${formatted} ${symbol}` : formatted;
}
