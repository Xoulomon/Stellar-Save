import { useState } from 'react';
import { GroupList, Group } from './GroupList';

// Sample data
const sampleGroups: Group[] = [
  {
    id: '1',
    name: 'Stellar Developers',
    description: 'Community of Stellar blockchain developers',
    memberCount: 142,
    createdAt: new Date('2024-01-15'),
    avatar: 'https://via.placeholder.com/56',
  },
  {
    id: '2',
    name: 'DeFi Enthusiasts',
    description: 'Discussing decentralized finance on Stellar',
    memberCount: 89,
    createdAt: new Date('2024-02-01'),
  },
  {
    id: '3',
    name: 'Smart Contract Builders',
    description: 'Building and sharing smart contracts',
    memberCount: 56,
    createdAt: new Date('2024-02-15'),
  },
  {
    id: '4',
    name: 'NFT Creators',
    description: 'Creating and trading NFTs on Stellar',
    memberCount: 234,
    createdAt: new Date('2024-01-20'),
  },
  {
    id: '5',
    name: 'Stellar Savers',
    description: 'Group savings and investment strategies',
    memberCount: 178,
    createdAt: new Date('2024-03-01'),
  },
];

export function GroupListExample() {
  const [groups] = useState<Group[]>(sampleGroups);
  const [loading, setLoading] = useState(false);

  const handleGroupClick = (group: Group) => {
    console.log('Group clicked:', group);
    alert(`You clicked on: ${group.name}`);
  };

  const handleCreateGroup = () => {
    console.log('Create new group');
    alert('Navigate to create group page');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>GroupList Component Examples</h1>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Basic Usage</h2>
        <GroupList
          groups={groups}
          onGroupClick={handleGroupClick}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Loading State</h2>
        <GroupList
          groups={[]}
          loading={true}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Empty State with Action</h2>
        <GroupList
          groups={[]}
          emptyTitle="No groups yet"
          emptyDescription="Create your first group to start collaborating"
          emptyActionLabel="Create Group"
          onEmptyAction={handleCreateGroup}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Without Search and Sort</h2>
        <GroupList
          groups={groups.slice(0, 3)}
          showSearch={false}
          showSort={false}
          onGroupClick={handleGroupClick}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Custom Page Size</h2>
        <GroupList
          groups={groups}
          pageSize={2}
          pageSizeOptions={[2, 5, 10]}
          onGroupClick={handleGroupClick}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Custom Rendering</h2>
        <GroupList
          groups={groups.slice(0, 3)}
          renderGroupItem={(group) => (
            <div
              key={group.id}
              style={{
                padding: '1rem',
                border: '2px solid #667eea',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
              }}
            >
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#667eea' }}>
                {group.name}
              </h3>
              <p style={{ margin: '0', color: '#666' }}>{group.description}</p>
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#999' }}>
                {group.memberCount} members
              </div>
            </div>
          )}
        />
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2>Sorted by Member Count (Descending)</h2>
        <GroupList
          groups={groups}
          defaultSortField="memberCount"
          defaultSortOrder="desc"
          onGroupClick={handleGroupClick}
        />
      </section>
    </div>
  );
}

export default GroupListExample;
