import React from 'react';
import { AmbassadorBadge } from './AmbassadorBadge';

interface AmbassadorEntry {
  address: string;
  tier: 'Bronze' | 'Silver' | 'Gold';
  reputationScore: number;
  rewardsEarned: number;
}

const MOCK_DATA: AmbassadorEntry[] = [
  { address: 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37', tier: 'Gold',   reputationScore: 0.97, rewardsEarned: 500 },
  { address: 'GBVNNPOFVV2BTEGXFNM3KQJT3ZQG5FMHAKZ4QQ5Z3ZQVV6KQNBPZMQW', tier: 'Gold',   reputationScore: 0.96, rewardsEarned: 420 },
  { address: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGLIWDZVEN4RK7STCHNW7H3', tier: 'Silver', reputationScore: 0.88, rewardsEarned: 210 },
  { address: 'GDHV7FL73QXEHSFNBMPD4TTAOSGZBTPJ5OAUIWQNLSAPKXEEBKM5LVF4', tier: 'Silver', reputationScore: 0.86, rewardsEarned: 175 },
  { address: 'GBHV2XMZFSDYF5VBTKEMQ2IETUBICQEJRJGZ5EAQOMQPHCRCJ2E2ZQJQ', tier: 'Bronze', reputationScore: 0.73, rewardsEarned:  80 },
];

const trunc = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontFamily: 'sans-serif',
  fontSize: '14px',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '2px solid #e5e7eb',
  color: '#6b7280',
  fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderBottom: '1px solid #f3f4f6',
};

export const AmbassadorLeaderboard: React.FC = () => (
  <div style={{ overflowX: 'auto' }}>
    <h3 style={{ fontFamily: 'sans-serif', marginBottom: '12px' }}>Ambassador Leaderboard</h3>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>#</th>
          <th style={thStyle}>Address</th>
          <th style={thStyle}>Tier</th>
          <th style={thStyle}>Reputation</th>
          <th style={thStyle}>Rewards (XLM)</th>
        </tr>
      </thead>
      <tbody>
        {MOCK_DATA.map((entry, i) => (
          <tr key={entry.address}>
            <td style={tdStyle}>{i + 1}</td>
            <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{trunc(entry.address)}</td>
            <td style={tdStyle}><AmbassadorBadge tier={entry.tier} address={entry.address} /></td>
            <td style={tdStyle}>{(entry.reputationScore * 100).toFixed(0)}%</td>
            <td style={tdStyle}>{entry.rewardsEarned}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default AmbassadorLeaderboard;
