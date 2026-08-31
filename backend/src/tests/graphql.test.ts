import { ApolloServer } from '@apollo/server';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../graphql/schema';
import { resolvers } from '../graphql/resolvers';
import { validationRules, MAX_DEPTH, MAX_COMPLEXITY } from '../graphql/complexity';

const schema = makeExecutableSchema({ typeDefs, resolvers });

function makeServer() {
  return new ApolloServer({ schema, validationRules, introspection: true });
}

async function query(server: ApolloServer, body: string) {
  const res = await server.executeOperation({ query: body });
  // Apollo v4 returns a union; unwrap the single-result case
  if (res.body.kind !== 'single') throw new Error('Expected single result');
  return res.body.singleResult;
}

async function runTests() {
  console.log('🧪 Running GraphQL API Tests...\n');
  const server = makeServer();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else           { console.error(`  ❌ ${label}`); failed++; }
  }

  // ── health ──────────────────────────────────────────────────────────────────
  console.log('── health query');
  {
    const result = await query(server, '{ health }');
    assert(!result.errors, 'no errors');
    assert((result.data as any)?.health === 'ok', 'returns "ok"');
  }

  // ── groups ──────────────────────────────────────────────────────────────────
  console.log('── groups query');
  {
    const result = await query(server, '{ groups { id name contributionAmount status tags } }');
    assert(!result.errors, 'no errors');
    const groups = (result.data as any)?.groups;
    assert(Array.isArray(groups) && groups.length === 3, 'returns 3 groups');
    assert(groups[0].id === '1', 'first group id is 1');
  }

  // ── group by id ─────────────────────────────────────────────────────────────
  console.log('── group(id) query');
  {
    const result = await query(server, '{ group(id: "2") { id name } }');
    assert(!result.errors, 'no errors');
    assert((result.data as any)?.group?.name === 'Monthly Builders', 'correct group returned');
  }

  // ── group not found ─────────────────────────────────────────────────────────
  {
    const result = await query(server, '{ group(id: "999") { id } }');
    assert(!result.errors, 'no errors on missing group');
    assert((result.data as any)?.group === null, 'returns null for unknown id');
  }

  // ── members ─────────────────────────────────────────────────────────────────
  console.log('── members query');
  {
    const result = await query(server, '{ members { id name address groupIds } }');
    assert(!result.errors, 'no errors');
    const members = (result.data as any)?.members;
    assert(Array.isArray(members) && members.length === 3, 'returns 3 members');
  }

  // ── transactions filtered by groupId ────────────────────────────────────────
  console.log('── transactions(groupId) query');
  {
    const result = await query(server, '{ transactions(groupId: "1") { id amount type } }');
    assert(!result.errors, 'no errors');
    const txs = (result.data as any)?.transactions;
    assert(Array.isArray(txs) && txs.length === 2, 'returns 2 transactions for group 1');
    assert(txs[0].type === 'contribution', 'type is contribution');
  }

  // ── nested: group → members ──────────────────────────────────────────────────
  console.log('── nested group.members');
  {
    const result = await query(server, '{ group(id: "1") { id members { id name } } }');
    assert(!result.errors, 'no errors');
    const members = (result.data as any)?.group?.members;
    assert(Array.isArray(members) && members.length >= 1, 'group has members');
  }

  // ── nested: member → groups ──────────────────────────────────────────────────
  console.log('── nested member.groups');
  {
    const result = await query(server, '{ member(id: "m1") { id groups { id name } } }');
    assert(!result.errors, 'no errors');
    const groups = (result.data as any)?.member?.groups;
    assert(Array.isArray(groups) && groups.length === 2, 'member m1 belongs to 2 groups');
  }

  // ── search ───────────────────────────────────────────────────────────────────
  console.log('── search query');
  {
    const result = await query(server, '{ search(query: "weekly") { groups { id name } members { id } transactions { id } } }');
    assert(!result.errors, 'no errors');
    const groups = (result.data as any)?.search?.groups;
    assert(Array.isArray(groups) && groups.length >= 1, 'search returns matching groups');
  }

  // ── recommendations ──────────────────────────────────────────────────────────
  console.log('── recommendations query');
  {
    const result = await query(server, '{ recommendations(userId: "user1") { userId bucket algorithm recommendations { groupId score } } }');
    assert(!result.errors, 'no errors');
    const rec = (result.data as any)?.recommendations;
    assert(typeof rec?.userId === 'string', 'has userId');
    assert(['A', 'B'].includes(rec?.bucket), 'bucket is A or B');
  }

  // ── setPreferences mutation ───────────────────────────────────────────────────
  console.log('── setPreferences mutation');
  {
    const result = await query(server, `
      mutation {
        setPreferences(userId: "user1", minContribution: 50, maxContribution: 500, tags: ["weekly"])
      }
    `);
    assert(!result.errors, 'no errors');
    assert((result.data as any)?.setPreferences === true, 'returns true');
  }

  // ── depth limit ───────────────────────────────────────────────────────────────
  console.log('── depth limit enforcement');
  {
    // Build a query that exceeds MAX_DEPTH (5)
    const deepQuery = '{ groups { members { groups { members { groups { members { id } } } } } } }';
    const result = await query(server, deepQuery);
    assert(Array.isArray(result.errors) && result.errors.length > 0, `query exceeding depth ${MAX_DEPTH} is rejected`);
  }

  // ── complexity limit ──────────────────────────────────────────────────────────
  console.log('── complexity limit enforcement');
  {
    // search(20) + groups(10) + members(10) + transactions(10) + recommendations(15) = 65+scalars > 100
    const heavyQuery = `{
      search(query: "x") { groups { id name status tags currentMembers maxMembers contributionAmount cycleDuration } members { id name address joinedAt groupIds } transactions { id amount type timestamp stellarTxHash groupId memberAddress } }
      groups { id name status tags currentMembers maxMembers contributionAmount cycleDuration }
      members { id name address joinedAt groupIds }
      transactions { id amount type timestamp }
      recommendations(userId: "u") { userId bucket algorithm recommendations { groupId score algorithm } }
    }`;
    const result = await query(server, heavyQuery);
    assert(Array.isArray(result.errors) && result.errors.length > 0, `query exceeding complexity ${MAX_COMPLEXITY} is rejected`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n════════════════════════════════`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`════════════════════════════════`);
  if (failed > 0) process.exit(1);
  console.log('ALL TESTS PASSED! 🎉');
}

runTests().catch(err => { console.error(err); process.exit(1); });
