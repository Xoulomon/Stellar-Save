/**
 * graphql/client.ts
 *
 * Lightweight graphql-request client used by the generated React Query hooks.
 *
 * The `fetcher` export matches the signature expected by
 * `typescript-react-query` when configured with:
 *   fetcher: { func: '../graphql/client#fetcher' }
 *
 * Usage example (generated hook calls this internally):
 *   useGetGroupsQuery(variables?, options?)
 *
 * The VITE_GRAPHQL_URL env variable overrides the default backend endpoint,
 * making it easy to point at a staging or local server without code changes.
 */

import { GraphQLClient } from 'graphql-request';

const GRAPHQL_ENDPOINT =
  (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env
    ?.VITE_GRAPHQL_URL ?? 'http://localhost:4000/graphql';

/** Shared client singleton — reuse the connection pool across all queries. */
export const graphqlClient = new GraphQLClient(GRAPHQL_ENDPOINT, {
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Fetcher function expected by the generated typescript-react-query hooks.
 *
 * The codegen config binds this via:
 *   fetcher: { func: '../graphql/client#fetcher' }
 *
 * The optional `headers` parameter is used by the generated `.fetcher` static
 * helpers (e.g. `useGetGroupsQuery.fetcher(vars, headers)`) so that callers
 * can pass per-request headers such as Authorization tokens.
 *
 * @param query     - GraphQL document string
 * @param variables - Operation variables
 * @param headers   - Optional per-request HTTP headers (merged over defaults)
 * @returns         - Thunk that resolves to typed data
 */
export function fetcher<TData, TVariables>(
  query: string,
  variables?: TVariables,
  headers?: RequestInit['headers'],
): () => Promise<TData> {
  return async () => {
    const client = headers
      ? new GraphQLClient(GRAPHQL_ENDPOINT, {
          headers: {
            'Content-Type': 'application/json',
            ...(headers as Record<string, string>),
          },
        })
      : graphqlClient;
    return client.request<TData>(query, variables as Record<string, unknown>);
  };
}
