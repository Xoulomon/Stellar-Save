/**
 * @deprecated Use paginateArray from lib/pagination instead.
 * This helper is kept for backward compatibility only.
 */
export const paginateResults = (items: unknown[], limit?: number, offset?: number): unknown[] => {
  if (!limit && !offset) return items;
  const pageParams = { limit: limit ?? 20, offset: offset ?? 0 };
  const safeOffset = Math.min(pageParams.offset, items.length);
  return items.slice(safeOffset, safeOffset + pageParams.limit);
};
