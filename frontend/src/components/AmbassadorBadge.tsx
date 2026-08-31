import React from 'react';

interface AmbassadorBadgeProps {
  tier: 'Bronze' | 'Silver' | 'Gold' | null;
  address: string;
}

const TIER_STYLES: Record<'Bronze' | 'Silver' | 'Gold', React.CSSProperties> = {
  Bronze: { background: '#d97706', color: '#fff' },
  Silver: { background: '#6b7280', color: '#fff' },
  Gold:   { background: '#eab308', color: '#fff' },
};

const BASE: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: '12px',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.03em',
};

export const AmbassadorBadge: React.FC<AmbassadorBadgeProps> = ({ tier }) => {
  if (!tier) return null;
  return <span style={{ ...BASE, ...TIER_STYLES[tier] }}>{tier}</span>;
};

export default AmbassadorBadge;
