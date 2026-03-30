# Analytics Implementation Guide

Privacy-focused analytics tracking for Stellar-Save dApp.

## Overview

This document outlines the implementation plan for privacy-focused analytics in Stellar-Save, ensuring user privacy while gathering insights about dApp usage.

## Privacy-Focused Analytics Solution

### Recommended Solution: Plausible Analytics

**Why Plausible?**
- Privacy-first, GDPR compliant
- No cookies, no personal data collection
- Lightweight script (~1KB)
- Open-source and transparent
- Self-hostable option available
- Simple, actionable dashboard

**Alternative Options:**
- **Fathom Analytics:** Similar to Plausible, privacy-focused
- **Umami:** Self-hosted, open-source alternative
- **Simple Analytics:** Privacy-focused, GDPR compliant

## Implementation Steps

### Step 1: Setup Analytics Account

```bash
# Option A: Use Plausible Cloud
# 1. Sign up at https://plausible.io
# 2. Add your domain (e.g., stellar-save.app)
# 3. Get tracking script

# Option B: Self-host Plausible
docker-compose up -d
# Follow: https://plausible.io/docs/self-hosting
```

### Step 2: Add Tracking Code

#### Frontend Integration

Create `frontend/src/utils/analytics.ts`:

```typescript
/**
 * Privacy-focused analytics utility
 * Uses Plausible Analytics - no cookies, no personal data
 */

interface PlausibleEvent {
  (eventName: string, options?: { props?: Record<string, string | number> }): void;
}

declare global {
  interface Window {
    plausible?: PlausibleEvent;
  }
}

/**
 * Track custom event
 */
export function trackEvent(
  eventName: string,
  props?: Record<string, string | number>
): void {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible(eventName, { props });
  }
}

/**
 * Track page view (automatic with Plausible script)
 */
export function trackPageView(path: string): void {
  if (typeof window !== 'undefined' && window.plausible) {
    window.plausible('pageview', { props: { path } });
  }
}

// Event names constants
export const ANALYTICS_EVENTS = {
  // Wallet events
  WALLET_CONNECTED: 'Wallet Connected',
  WALLET_DISCONNECTED: 'Wallet Disconnected',
  
  // Group events
  GROUP_CREATED: 'Group Created',
  GROUP_JOINED: 'Group Joined',
  GROUP_LEFT: 'Group Left',
  GROUP_VIEWED: 'Group Viewed',
  
  // Contribution events
  CONTRIBUTION_MADE: 'Contribution Made',
  CONTRIBUTION_FAILED: 'Contribution Failed',
  
  // Payout events
  PAYOUT_CLAIMED: 'Payout Claimed',
  PAYOUT_FAILED: 'Payout Failed',
  
  // Cycle events
  CYCLE_ADVANCED: 'Cycle Advanced',
  
  // UI events
  DASHBOARD_VIEWED: 'Dashboard Viewed',
  HELP_VIEWED: 'Help Viewed',
  SETTINGS_CHANGED: 'Settings Changed',
} as const;
```

#### Add Script to HTML

Update `frontend/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stellar-Save</title>
    
    <!-- Plausible Analytics - Privacy-focused, no cookies -->
    <script defer data-domain="yourdomain.com" src="https://plausible.io/js/script.js"></script>
    <!-- For self-hosted: src="https://your-plausible-instance.com/js/script.js" -->
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### Environment Configuration

Add to `frontend/.env`:

```env
# Analytics Configuration
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_DOMAIN=stellar-save.app
VITE_PLAUSIBLE_HOST=https://plausible.io
# For self-hosted: VITE_PLAUSIBLE_HOST=https://your-plausible-instance.com
```

### Step 3: Track Key Events

#### Wallet Connection Tracking

```typescript
// In wallet connection component
import { trackEvent, ANALYTICS_EVENTS } from '@/utils/analytics';

async function connectWallet() {
  try {
    const wallet = await connectFreighter();
    trackEvent(ANALYTICS_EVENTS.WALLET_CONNECTED, {
      wallet_type: 'freighter',
    });
  } catch (error) {
    console.error('Wallet connection failed', error);
  }
}
```

#### Group Creation Tracking

```typescript
// In group creation component
import { trackEvent, ANALYTICS_EVENTS } from '@/utils/analytics';

async function createGroup(groupData: GroupData) {
  try {
    const result = await contractClient.createGroup(groupData);
    trackEvent(ANALYTICS_EVENTS.GROUP_CREATED, {
      member_count: groupData.memberCount,
      contribution_amount: groupData.contributionAmount,
    });
  } catch (error) {
    console.error('Group creation failed', error);
  }
}
```

#### Contribution Tracking

```typescript
// In contribution component
import { trackEvent, ANALYTICS_EVENTS } from '@/utils/analytics';

async function makeContribution(groupId: number, amount: number) {
  try {
    await contractClient.contribute(groupId, amount);
    trackEvent(ANALYTICS_EVENTS.CONTRIBUTION_MADE, {
      group_id: groupId,
      amount: amount,
    });
  } catch (error) {
    trackEvent(ANALYTICS_EVENTS.CONTRIBUTION_FAILED, {
      group_id: groupId,
      error: error.message,
    });
  }
}
```

#### Page View Tracking

```typescript
// In router or App.tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/utils/analytics';

function App() {
  const location = useLocation();
  
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location]);
  
  return <Router />;
}
```

### Step 4: Create Analytics Dashboard

#### Key Metrics to Track

1. **User Engagement**
   - Daily/Monthly Active Users
   - Session duration
   - Pages per session
   - Bounce rate

2. **Wallet Metrics**
   - Wallet connections
   - Wallet types used
   - Connection success rate

3. **Group Metrics**
   - Groups created
   - Groups joined
   - Average group size
   - Group completion rate

4. **Contribution Metrics**
   - Total contributions
   - Average contribution amount
   - Contribution frequency
   - Failed contributions

5. **Payout Metrics**
   - Payouts claimed
   - Payout success rate
   - Average payout amount

6. **Technical Metrics**
   - Page load time
   - Error rates
   - Browser/device distribution
   - Geographic distribution

#### Dashboard Configuration

In Plausible dashboard:

1. **Goals Setup:**
   - Wallet Connected
   - Group Created
   - Contribution Made
   - Payout Claimed

2. **Custom Properties:**
   - wallet_type
   - group_id
   - amount
   - error_type

3. **Funnels:**
   - Wallet Connect → Group Join → Contribution
   - Group Create → Member Invite → First Contribution

### Step 5: Privacy Compliance

#### Privacy Policy Update

Add to privacy policy:

```markdown
## Analytics

We use privacy-focused analytics (Plausible) to understand how users interact with our dApp. 

**What we collect:**
- Page views and navigation patterns
- Anonymized event data (group creation, contributions, etc.)
- Browser type and device information
- Geographic location (country level only)

**What we DON'T collect:**
- Personal information
- Wallet addresses
- IP addresses
- Cookies or tracking identifiers
- Cross-site tracking data

All analytics data is:
- Aggregated and anonymized
- Stored in EU (GDPR compliant)
- Not sold or shared with third parties
- Used solely to improve the dApp experience
```

#### Opt-out Mechanism

```typescript
// Add opt-out functionality
export function disableAnalytics(): void {
  localStorage.setItem('analytics_disabled', 'true');
  window.plausible = undefined;
}

export function enableAnalytics(): void {
  localStorage.removeItem('analytics_disabled');
  // Reload to reinitialize
  window.location.reload();
}

export function isAnalyticsEnabled(): boolean {
  return localStorage.getItem('analytics_disabled') !== 'true';
}
```

## Documentation

### Metrics Documentation

Create `docs/ANALYTICS_METRICS.md`:

```markdown
# Analytics Metrics

## Overview
This document describes all tracked metrics and events in Stellar-Save.

## Events

### Wallet Events
- **Wallet Connected**: User successfully connects wallet
- **Wallet Disconnected**: User disconnects wallet

### Group Events
- **Group Created**: New savings group created
- **Group Joined**: User joins existing group
- **Group Viewed**: User views group details

### Contribution Events
- **Contribution Made**: Successful contribution to group
- **Contribution Failed**: Failed contribution attempt

### Payout Events
- **Payout Claimed**: User successfully claims payout
- **Payout Failed**: Failed payout attempt

## Properties

Each event may include:
- `wallet_type`: Type of wallet used (freighter, albedo, etc.)
- `group_id`: Identifier for the group
- `amount`: Transaction amount
- `error`: Error message for failed events

## Privacy

All metrics are:
- Anonymized
- Aggregated
- GDPR compliant
- No personal data collected
```

## Testing

### Test Analytics Implementation

```typescript
// Test file: frontend/src/utils/analytics.test.ts
import { describe, it, expect, vi } from 'vitest';
import { trackEvent, ANALYTICS_EVENTS } from './analytics';

describe('Analytics', () => {
  it('should track events when plausible is available', () => {
    const mockPlausible = vi.fn();
    window.plausible = mockPlausible;
    
    trackEvent(ANALYTICS_EVENTS.WALLET_CONNECTED, { wallet_type: 'freighter' });
    
    expect(mockPlausible).toHaveBeenCalledWith('Wallet Connected', {
      props: { wallet_type: 'freighter' },
    });
  });
  
  it('should not throw when plausible is unavailable', () => {
    window.plausible = undefined;
    
    expect(() => {
      trackEvent(ANALYTICS_EVENTS.WALLET_CONNECTED);
    }).not.toThrow();
  });
});
```

## Monitoring

### Analytics Health Check

```typescript
// Check if analytics is working
export function checkAnalyticsHealth(): boolean {
  return typeof window !== 'undefined' && typeof window.plausible === 'function';
}

// Log analytics status on app load
console.log('Analytics enabled:', checkAnalyticsHealth());
```

## Cost Estimation

### Plausible Pricing (as of 2024)
- Up to 10k monthly pageviews: $9/month
- Up to 100k monthly pageviews: $19/month
- Up to 1M monthly pageviews: $69/month

### Self-Hosted Option
- Free (open-source)
- Requires server infrastructure (~$5-20/month)
- Full data ownership

## Rollout Plan

1. **Phase 1: Setup** (Week 1)
   - Create Plausible account
   - Add tracking script
   - Test in development

2. **Phase 2: Core Events** (Week 2)
   - Implement wallet tracking
   - Implement group tracking
   - Implement contribution tracking

3. **Phase 3: Advanced Events** (Week 3)
   - Add payout tracking
   - Add UI interaction tracking
   - Add error tracking

4. **Phase 4: Dashboard** (Week 4)
   - Configure goals and funnels
   - Set up alerts
   - Document metrics

5. **Phase 5: Optimization** (Ongoing)
   - Review metrics weekly
   - Adjust tracking as needed
   - Optimize based on insights

## Success Criteria

- [ ] Analytics script loaded successfully
- [ ] All key events tracked
- [ ] Dashboard configured with goals
- [ ] Privacy policy updated
- [ ] Opt-out mechanism implemented
- [ ] Documentation complete
- [ ] Team trained on dashboard usage

## Resources

- [Plausible Documentation](https://plausible.io/docs)
- [Plausible Events API](https://plausible.io/docs/custom-event-goals)
- [GDPR Compliance Guide](https://plausible.io/data-policy)
- [Self-Hosting Guide](https://plausible.io/docs/self-hosting)
