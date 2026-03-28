# Get Group Members - API Examples

## Frontend Integration Examples

### JavaScript/TypeScript Examples

#### Basic Usage
```typescript
import { Contract } from '@stellar/stellar-sdk';

// Initialize contract
const contract = new Contract(contractId);

// Get first 20 members
const members = await contract.get_group_members({
  group_id: 1,
  offset: 0,
  limit: 20
});

console.log(`Found ${members.length} members`);
members.forEach(member => {
  console.log(`Member: ${member}`);
});
```

#### Pagination Component
```typescript
interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalMembers: number;
}

async function loadMembersPage(
  groupId: number,
  page: number,
  pageSize: number
): Promise<string[]> {
  const offset = page * pageSize;
  
  const members = await contract.get_group_members({
    group_id: groupId,
    offset: offset,
    limit: pageSize
  });
  
  return members;
}

// Usage in React component
function MembersList({ groupId }: { groupId: number }) {
  const [members, setMembers] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  useEffect(() => {
    loadMembersPage(groupId, page, pageSize)
      .then(setMembers)
      .catch(console.error);
  }, [groupId, page]);
  
  return (
    <div>
      <ul>
        {members.map(member => (
          <li key={member}>{member}</li>
        ))}
      </ul>
      <button onClick={() => setPage(p => p - 1)} disabled={page === 0}>
        Previous
      </button>
      <button onClick={() => setPage(p => p + 1)} disabled={members.length < pageSize}>
        Next
      </button>
    </div>
  );
}
```

#### Load All Members
```typescript
async function loadAllMembers(groupId: number): Promise<string[]> {
  const allMembers: string[] = [];
  const pageSize = 50;
  let offset = 0;
  
  while (true) {
    const page = await contract.get_group_members({
      group_id: groupId,
      offset: offset,
      limit: pageSize
    });
    
    if (page.length === 0) {
      break;
    }
    
    allMembers.push(...page);
    offset += pageSize;
    
    // Safety check to prevent infinite loops
    if (offset > 10000) {
      console.warn('Too many members, stopping at 10000');
      break;
    }
  }
  
  return allMembers;
}
```

#### Infinite Scroll
```typescript
function InfiniteScrollMembers({ groupId }: { groupId: number }) {
  const [members, setMembers] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;
  
  const loadMore = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    try {
      const newMembers = await contract.get_group_members({
        group_id: groupId,
        offset: offset,
        limit: pageSize
      });
      
      if (newMembers.length === 0) {
        setHasMore(false);
      } else {
        setMembers(prev => [...prev, ...newMembers]);
        setOffset(prev => prev + pageSize);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      <ul>
        {members.map(member => (
          <li key={member}>{member}</li>
        ))}
      </ul>
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
```

#### Search Members
```typescript
async function searchMember(
  groupId: number,
  searchAddress: string
): Promise<boolean> {
  const pageSize = 100;
  let offset = 0;
  
  while (true) {
    const members = await contract.get_group_members({
      group_id: groupId,
      offset: offset,
      limit: pageSize
    });
    
    if (members.length === 0) {
      return false; // Not found
    }
    
    if (members.includes(searchAddress)) {
      return true; // Found!
    }
    
    offset += pageSize;
  }
}
```

#### Member Count with Pagination Info
```typescript
interface MemberListInfo {
  members: string[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

async function getMemberListInfo(
  groupId: number,
  page: number,
  pageSize: number
): Promise<MemberListInfo> {
  // Get total count
  const totalCount = await contract.get_member_count({ group_id: groupId });
  
  // Get current page
  const offset = page * pageSize;
  const members = await contract.get_group_members({
    group_id: groupId,
    offset: offset,
    limit: pageSize
  });
  
  const totalPages = Math.ceil(totalCount / pageSize);
  
  return {
    members,
    totalCount,
    currentPage: page,
    totalPages,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0
  };
}
```

### Python Examples

#### Basic Usage
```python
from stellar_sdk import Contract

# Initialize contract
contract = Contract(contract_id)

# Get first 20 members
members = contract.get_group_members(
    group_id=1,
    offset=0,
    limit=20
)

print(f"Found {len(members)} members")
for member in members:
    print(f"Member: {member}")
```

#### Pagination Iterator
```python
def iter_members(contract, group_id: int, page_size: int = 50):
    """Generator that yields all members in pages"""
    offset = 0
    
    while True:
        members = contract.get_group_members(
            group_id=group_id,
            offset=offset,
            limit=page_size
        )
        
        if not members:
            break
            
        for member in members:
            yield member
            
        offset += page_size

# Usage
for member in iter_members(contract, group_id=1):
    process_member(member)
```

#### Load All Members
```python
def load_all_members(contract, group_id: int) -> list[str]:
    """Load all members from a group"""
    all_members = []
    page_size = 50
    offset = 0
    
    while True:
        page = contract.get_group_members(
            group_id=group_id,
            offset=offset,
            limit=page_size
        )
        
        if not page:
            break
            
        all_members.extend(page)
        offset += page_size
        
        # Safety check
        if offset > 10000:
            print("Warning: Too many members, stopping at 10000")
            break
    
    return all_members
```

### Rust Examples

#### Basic Usage
```rust
use stellar_save_contract::StellarSaveContractClient;

// Get first 20 members
let members = client.get_group_members(&1, &0, &20);

println!("Found {} members", members.len());
for member in members.iter() {
    println!("Member: {:?}", member);
}
```

#### Pagination
```rust
fn load_members_page(
    client: &StellarSaveContractClient,
    group_id: u64,
    page: u32,
    page_size: u32,
) -> Vec<Address> {
    let offset = page * page_size;
    client.get_group_members(&group_id, &offset, &page_size)
}

// Usage
let page1 = load_members_page(&client, 1, 0, 20);
let page2 = load_members_page(&client, 1, 1, 20);
```

#### Load All Members
```rust
fn load_all_members(
    client: &StellarSaveContractClient,
    group_id: u64,
) -> Vec<Address> {
    let mut all_members = Vec::new();
    let page_size = 50;
    let mut offset = 0;
    
    loop {
        let page = client.get_group_members(&group_id, &offset, &page_size);
        
        if page.is_empty() {
            break;
        }
        
        all_members.extend(page);
        offset += page_size;
        
        // Safety check
        if offset > 10000 {
            eprintln!("Warning: Too many members, stopping at 10000");
            break;
        }
    }
    
    all_members
}
```

## Error Handling Examples

### TypeScript
```typescript
async function getMembersWithErrorHandling(
  groupId: number,
  offset: number,
  limit: number
): Promise<string[] | null> {
  try {
    const members = await contract.get_group_members({
      group_id: groupId,
      offset: offset,
      limit: limit
    });
    return members;
  } catch (error) {
    if (error.code === 1001) {
      console.error('Group not found');
      return null;
    } else if (error.code === 1002) {
      console.error('Overflow error in pagination');
      return null;
    } else {
      console.error('Unknown error:', error);
      throw error;
    }
  }
}
```

### Python
```python
def get_members_safe(contract, group_id: int, offset: int, limit: int):
    """Get members with error handling"""
    try:
        return contract.get_group_members(
            group_id=group_id,
            offset=offset,
            limit=limit
        )
    except ContractError as e:
        if e.code == 1001:
            print("Group not found")
            return []
        elif e.code == 1002:
            print("Overflow error")
            return []
        else:
            raise
```

## UI Component Examples

### React Table Component
```typescript
function MembersTable({ groupId }: { groupId: number }) {
  const [members, setMembers] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = 10;
  
  useEffect(() => {
    setLoading(true);
    contract.get_group_members({
      group_id: groupId,
      offset: page * pageSize,
      limit: pageSize
    })
      .then(setMembers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [groupId, page]);
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Address</th>
            <th>Position</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member, index) => (
            <tr key={member}>
              <td>{page * pageSize + index + 1}</td>
              <td>{member}</td>
              <td>{page * pageSize + index}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <button onClick={() => setPage(p => Math.max(0, p - 1))}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
```

### Vue Component
```vue
<template>
  <div>
    <ul>
      <li v-for="(member, index) in members" :key="member">
        {{ index + 1 }}. {{ member }}
      </li>
    </ul>
    <button @click="prevPage" :disabled="page === 0">Previous</button>
    <span>Page {{ page + 1 }}</span>
    <button @click="nextPage" :disabled="members.length < pageSize">Next</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ groupId: number }>();
const members = ref<string[]>([]);
const page = ref(0);
const pageSize = 20;

async function loadMembers() {
  const result = await contract.get_group_members({
    group_id: props.groupId,
    offset: page.value * pageSize,
    limit: pageSize
  });
  members.value = result;
}

function prevPage() {
  if (page.value > 0) {
    page.value--;
  }
}

function nextPage() {
  page.value++;
}

watch([() => props.groupId, page], loadMembers, { immediate: true });
</script>
```

## Performance Optimization Examples

### Caching
```typescript
class MemberCache {
  private cache = new Map<string, { members: string[], timestamp: number }>();
  private ttl = 60000; // 1 minute
  
  async getMembers(
    groupId: number,
    offset: number,
    limit: number
  ): Promise<string[]> {
    const key = `${groupId}-${offset}-${limit}`;
    const cached = this.cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.members;
    }
    
    const members = await contract.get_group_members({
      group_id: groupId,
      offset: offset,
      limit: limit
    });
    
    this.cache.set(key, { members, timestamp: Date.now() });
    return members;
  }
  
  invalidate(groupId: number) {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${groupId}-`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Prefetching
```typescript
async function prefetchNextPage(
  groupId: number,
  currentPage: number,
  pageSize: number
) {
  // Prefetch next page in background
  const nextOffset = (currentPage + 1) * pageSize;
  
  contract.get_group_members({
    group_id: groupId,
    offset: nextOffset,
    limit: pageSize
  }).catch(() => {
    // Silently fail, it's just prefetching
  });
}
```

## Testing Examples

### Jest Tests
```typescript
describe('get_group_members', () => {
  it('should return empty array for empty group', async () => {
    const members = await contract.get_group_members({
      group_id: 1,
      offset: 0,
      limit: 10
    });
    
    expect(members).toEqual([]);
  });
  
  it('should return paginated members', async () => {
    const page1 = await contract.get_group_members({
      group_id: 1,
      offset: 0,
      limit: 10
    });
    
    const page2 = await contract.get_group_members({
      group_id: 1,
      offset: 10,
      limit: 10
    });
    
    expect(page1.length).toBeLessThanOrEqual(10);
    expect(page2.length).toBeLessThanOrEqual(10);
    
    // Ensure no overlap
    const overlap = page1.filter(m => page2.includes(m));
    expect(overlap).toEqual([]);
  });
  
  it('should throw error for non-existent group', async () => {
    await expect(
      contract.get_group_members({
        group_id: 999,
        offset: 0,
        limit: 10
      })
    ).rejects.toThrow('Group not found');
  });
});
```

## Summary

These examples demonstrate how to integrate the `get_group_members` function into various frontend frameworks and languages. Key patterns include:

- ✅ Basic pagination
- ✅ Infinite scroll
- ✅ Load all members
- ✅ Search functionality
- ✅ Error handling
- ✅ Caching strategies
- ✅ UI components
- ✅ Testing

Choose the pattern that best fits your application's needs!
