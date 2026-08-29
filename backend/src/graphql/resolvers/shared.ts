export const paginateResults = (items: any[], limit?: number, offset?: number): any[] => {
  if (!limit && !offset) return items;
  const pageParams = { limit: limit ?? 20, offset: offset ?? 0 };
  const safeOffset = Math.min(pageParams.offset, items.length);
  return items.slice(safeOffset, safeOffset + pageParams.limit);
};
