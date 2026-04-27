export interface FormatAddressOptions {
  prefixChars?: number;
  suffixChars?: number;
}

export function formatAddress(
  address: string,
  { prefixChars = 6, suffixChars = 4 }: FormatAddressOptions = {}
): string {
  if (!address || address.length <= prefixChars + suffixChars) return address;
  return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}
