import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { resolvers } from '../graphql/resolvers';
import { typeDefs } from '../graphql/schema';

describe('GraphQL schema', () => {
  const server = new ApolloServer({
    schema: makeExecutableSchema({ typeDefs, resolvers }),
  });

  it('resolves the health query', async () => {
    const result = await server.executeOperation({ query: '{ health }' });
    expect(result.body.kind).toBe('single');
    if (result.body.kind === 'single') {
      expect(result.body.singleResult.errors).toBeUndefined();
      expect(result.body.singleResult.data).toEqual({ health: 'ok' });
    }
  });

  it('returns groups and members', async () => {
    const result = await server.executeOperation({
      query: '{ groups { id name } members { id name } }',
    });
    expect(result.body.kind).toBe('single');
    if (result.body.kind === 'single') {
      expect(result.body.singleResult.errors).toBeUndefined();
      expect((result.body.singleResult.data as any).groups.length).toBeGreaterThan(0);
      expect((result.body.singleResult.data as any).members.length).toBeGreaterThan(0);
    }
  });

  it('resolves nested transaction relations and search', async () => {
    const result = await server.executeOperation({
      query:
        '{ transaction(id: "t1") { id group { id name } member { id name } } search(query: "Monthly") { groups { id } members { id } } }',
    });
    expect(result.body.kind).toBe('single');
    if (result.body.kind === 'single') {
      expect(result.body.singleResult.errors).toBeUndefined();
      const data = result.body.singleResult.data as any;
      expect(data.transaction.group).not.toBeNull();
      expect(data.transaction.member).not.toBeNull();
      expect(data.search.groups.length).toBeGreaterThan(0);
    }
  });

  afterAll(async () => {
    await server.stop();
  });
});
