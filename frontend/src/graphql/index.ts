/**
 * GraphQL module barrel.
 *
 * Exports the shared GraphQL client and all code-generated hooks and types.
 * Import from here rather than reaching into sub-paths:
 *
 *   import { graphqlClient, useGetGroupsQuery, type Group } from '../graphql';
 */
export { graphqlClient, fetcher } from './client';
export * from '../generated';
