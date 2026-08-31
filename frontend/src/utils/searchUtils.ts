export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function filterSuggestions(suggestions: string[], query: string): string[] {
  if (!normalizeQuery(query)) return [];

  const lowerQuery = query.toLowerCase();
  return suggestions.filter(
    (suggestion) => suggestion.toLowerCase().includes(lowerQuery) && suggestion !== query
  );
}
