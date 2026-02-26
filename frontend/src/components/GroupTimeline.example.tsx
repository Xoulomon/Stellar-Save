import { GroupTimeline, TimelineEvent } from './GroupTimeline';

/**
 * Example component demonstrating the GroupTimeline component
 * with various event types and states
 */
export function GroupTimelineExample() {
  // Mock timeline events
  const mockEvents: TimelineEvent[] = [
    {
      id: 'evt-001',
      type: 'contribution',
      memberAddress: 'GBRPYHIL2CI3WHOSTIQC4VEHZSOP2YUQMWEA7LHSY5RMQRDFE5GQOSM',
      memberName: 'Alice Johnson',
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      amount: 10000, // in stroops (100 XLM)
      transactionHash: '5e0c61d08fcb09ba2a67b7ad...',
      status: 'completed',
    },
    {
      id: 'evt-002',
      type: 'contribution',
      memberAddress: 'GBTRPUHFLVXRQ2XRFVQJQHWQ6YDTZXZOJG4BKGQP4IOJWMRG3W2YTNC',
      memberName: 'Bob Smith',
      timestamp: new Date(Date.now() - 600000), // 10 minutes ago
      amount: 10000,
      transactionHash: '7a3b1d2c8e9f5a6b...',
      status: 'completed',
    },
    {
      id: 'evt-003',
      type: 'payout',
      memberAddress: 'GBRPYHIL2CI3WHOSTIQC4VEHZSOP2YUQMWEA7LHSY5RMQRDFE5GQOSM',
      memberName: 'Alice Johnson',
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      amount: 50000, // 500 XLM
      transactionHash: '3c2f8e1a4d7b9c6f...',
      status: 'completed',
      description: 'Monthly payout - Cycle #2',
    },
    {
      id: 'evt-004',
      type: 'member_join',
      memberAddress: 'GCX4LVFRYEB7GXYUIBH5ZQVJJKGKZFZFWGZQSXZ7PBHXVW7XQ6LYQSX',
      memberName: 'Charlie Brown',
      timestamp: new Date(Date.now() - 172800000), // 2 days ago
    },
    {
      id: 'evt-005',
      type: 'contribution',
      memberAddress: 'GBTRPUHFLVXRQ2XRFVQJQHWQ6YDTZXZOJG4BKGQP4IOJWMRG3W2YTNC',
      memberName: 'Bob Smith',
      timestamp: new Date(Date.now() - 259200000), // 3 days ago
      amount: 10000,
      transactionHash: '9f4e2a5c1b8d3g7h...',
      status: 'completed',
    },
    {
      id: 'evt-006',
      type: 'member_join',
      memberAddress: 'GBTRPUHFLVXRQ2XRFVQJQHWQ6YDTZXZOJG4BKGQP4IOJWMRG3W2YTNC',
      memberName: 'Bob Smith',
      timestamp: new Date(Date.now() - 345600000), // 4 days ago
    },
    {
      id: 'evt-007',
      type: 'contribution',
      memberAddress: 'GCX4LVFRYEB7GXYUIBH5ZQVJJKGKZFZFWGZQSXZ7PBHXVW7XQ6LYQSX',
      memberName: 'Charlie Brown',
      timestamp: new Date(Date.now() - 432000000), // 5 days ago
      amount: 10000,
      transactionHash: '5d1f3e8a9c2b4g6h...',
      status: 'pending',
    },
    {
      id: 'evt-008',
      type: 'payout',
      memberAddress: 'GBTRPUHFLVXRQ2XRFVQJQHWQ6YDTZXZOJG4BKGQP4IOJWMRG3W2YTNC',
      memberName: 'Bob Smith',
      timestamp: new Date(Date.now() - 604800000), // 7 days ago
      amount: 50000,
      transactionHash: '2e5g8h1j3k5l7m9n...',
      status: 'completed',
      description: 'First payout - Cycle #1',
    },
    {
      id: 'evt-009',
      type: 'member_join',
      memberAddress: 'GBRPYHIL2CI3WHOSTIQC4VEHZSOP2YUQMWEA7LHSY5RMQRDFE5GQOSM',
      memberName: 'Alice Johnson',
      timestamp: new Date(Date.now() - 691200000), // 8 days ago
    },
    {
      id: 'evt-010',
      type: 'contribution',
      memberAddress: 'GBXY7ZQVJJKGKZFZFWGZQSXZ7PBHXVW7XQ6LYQSXABCDEFGHIJKLMNO',
      memberName: 'Diana',
      timestamp: new Date(Date.now() - 777600000), // 9 days ago
      amount: 10000,
      transactionHash: '1a9b2c3d4e5f6g7h...',
      status: 'failed',
      description: 'Failed to process - insufficient balance',
    },
  ];

  const handleEventClick = (event: TimelineEvent) => {
    console.log('Event clicked:', event);
    alert(`Clicked event: ${event.type}\nMember: ${event.memberName || event.memberAddress}`);
  };

  return (
    <div style={{ padding: '2rem', backgroundColor: '#0a0e27', minHeight: '100vh' }}>
      <h1 style={{ color: 'rgba(255,255,255,0.87)', marginBottom: '2rem' }}>
        Group Timeline Example
      </h1>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <GroupTimeline
          events={mockEvents}
          maxHeight="800px"
          onEventClick={handleEventClick}
          emptyStateMessage="No activity in this group yet"
        />
      </div>

      <div
        style={{
          marginTop: '3rem',
          padding: '1.5rem',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.9rem',
        }}
      >
        <h3 style={{ color: 'rgba(255,255,255,0.87)', marginTop: 0 }}>
          Legend
        </h3>
        <ul>
          <li>
            <strong style={{ color: '#4caf50' }}>Green (Contribution)</strong>: Member contributed funds to the group
          </li>
          <li>
            <strong style={{ color: '#ffc107' }}>Yellow (Payout)</strong>: Member received their payout
          </li>
          <li>
            <strong style={{ color: '#2196f3' }}>Blue (Member Join)</strong>: New member joined the group
          </li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.9rem',
        }}
      >
        <h3 style={{ color: 'rgba(255,255,255,0.87)', marginTop: 0 }}>
          Features Demonstrated
        </h3>
        <ul>
          <li>Chronological sorting (newest first)</li>
          <li>Relative time formatting (e.g., "5 minutes ago")</li>
          <li>Event type color coding</li>
          <li>Transaction hash display</li>
          <li>Pending and failed status badges</li>
          <li>Scrollable container with custom height</li>
          <li>Click handler for events</li>
          <li>Member names with wallet address fallback</li>
        </ul>
      </div>
    </div>
  );
}

export default GroupTimelineExample;
