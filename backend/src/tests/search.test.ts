import { SearchService } from '../search';
import { Group, Member, Transaction } from '../models';

// Mock Elasticsearch Client
class MockClient {
  indices = {
    exists: async () => true,
    create: async () => ({})
  };
  ping = async () => true;
  index = async () => ({});
  search = async (params: any) => {
    if (params.index === 'groups') {
      return {
        hits: {
          hits: [
            { _source: { id: '1', name: 'Weekly Savers' } }
          ]
        }
      };
    }
    return { hits: { hits: [] } };
  };
}

async function runTests() {
  console.log('🧪 Running Search Service Tests...');

  const searchService = new SearchService();
  // @ts-ignore - Injecting mock client
  searchService['client'] = new MockClient();
  // @ts-ignore
  searchService['isConnected'] = true;

  // Test searchGroups
  console.log('Testing group search...');
  const groups = await searchService.searchGroups('Weekly');
  if (groups.length > 0 && (groups[0] as any).name === 'Weekly Savers') {
    console.log('✅ Group search passed');
  } else {
    console.error('❌ Group search failed');
    process.exit(1);
  }

  // Test globalSearch
  console.log('Testing global search...');
  const globalResult = await searchService.globalSearch('Weekly');
  if (globalResult.groups.length > 0) {
    console.log('✅ Global search passed');
  } else {
    console.error('❌ Global search failed');
    process.exit(1);
  }

  console.log('SEARCH TESTS PASSED! 🎉');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
