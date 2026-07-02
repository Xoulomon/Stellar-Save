import React from 'react';

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type FlagReason = 'sanctioned_address' | 'high_value' | 'rapid_succession' | 'blacklist_match';

interface ComplianceFlag {
  id: string;
  address: string;
  txHash: string;
  riskLevel: RiskLevel;
  reasons: FlagReason[];
  timestamp: string;
  reviewed: boolean;
}

const MOCK_FLAGS: ComplianceFlag[] = [
  {
    id: '1',
    address: 'GBADsanctioned1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    txHash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
    riskLevel: 'CRITICAL',
    reasons: ['sanctioned_address'],
    timestamp: '2026-06-27T10:00:00.000Z',
    reviewed: false,
  },
  {
    id: '2',
    address: 'GBUSER2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    txHash: 'def456abc123def456abc123def456abc123def456abc123def456abc123def4',
    riskLevel: 'HIGH',
    reasons: ['high_value', 'rapid_succession'],
    timestamp: '2026-06-27T11:30:00.000Z',
    reviewed: false,
  },
  {
    id: '3',
    address: 'GBUSER3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    txHash: 'fff999aaa111fff999aaa111fff999aaa111fff999aaa111fff999aaa111fff9',
    riskLevel: 'MEDIUM',
    reasons: ['high_value'],
    timestamp: '2026-06-27T12:45:00.000Z',
    reviewed: true,
  },
];

function riskColor(level: RiskLevel): string {
  if (level === 'CRITICAL' || level === 'HIGH') return '#c0392b';
  if (level === 'MEDIUM') return '#e67e22';
  return '#27ae60';
}

function truncate(str: string, len = 16): string {
  return str.length > len ? `${str.slice(0, len)}…` : str;
}

const ComplianceQueue: React.FC = () => {
  return (
    <div style={{ padding: '24px', fontFamily: 'sans-serif' }}>
      <p style={{ color: '#7f8c8d', fontSize: '13px', marginBottom: '8px' }}>
        Admin only - Compliance Review Queue
      </p>
      <h2 style={{ marginTop: 0 }}>Compliance Review Queue</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
        <thead>
          <tr style={{ background: '#f2f2f2' }}>
            {['Tx Hash', 'Address', 'Risk', 'Reasons', 'Timestamp', 'Status', 'Actions'].map((h) => (
              <th key={h} style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MOCK_FLAGS.map((flag) => (
            <tr key={flag.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '10px', fontFamily: 'monospace' }}>{truncate(flag.txHash, 12)}</td>
              <td style={{ padding: '10px', fontFamily: 'monospace' }}>{truncate(flag.address, 12)}</td>
              <td style={{ padding: '10px', fontWeight: 'bold', color: riskColor(flag.riskLevel) }}>
                {flag.riskLevel}
              </td>
              <td style={{ padding: '10px' }}>{flag.reasons.join(', ')}</td>
              <td style={{ padding: '10px' }}>{new Date(flag.timestamp).toLocaleString()}</td>
              <td style={{ padding: '10px', color: flag.reviewed ? '#27ae60' : '#e67e22' }}>
                {flag.reviewed ? 'Reviewed' : 'Pending'}
              </td>
              <td style={{ padding: '10px' }}>
                {!flag.reviewed && (
                  <>
                    <button
                      onClick={() => console.log('approve', flag.id)}
                      style={{
                        marginRight: '6px', padding: '4px 10px', background: '#27ae60',
                        color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => console.log('reject', flag.id)}
                      style={{
                        padding: '4px 10px', background: '#c0392b',
                        color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer',
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComplianceQueue;
