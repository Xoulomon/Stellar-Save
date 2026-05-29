import { useEffect } from 'react';
import { useEventService } from './useEventService';
import { useEventTrigger } from './useEventTrigger';
import { AppEvent, ContributionMadeEvent, PayoutExecutedEvent, GroupPausedEvent } from '../types/events';
import { useToast } from '../components/Toast';

/**
 * Custom hook to subscribe to Soroban contract events and trigger
 * cache invalidation for group-related data, and show toast notifications.
 *
 * It uses the global EventService for event subscription and the EventTriggerContext
 * to notify other hooks to refresh their data.
 */
export function useGroupEvents() {
  const { on } = useEventService();
  const { triggerRefresh } = useEventTrigger();
  const { showToast } = useToast(); // Assuming useToast hook from ToastProvider

  useEffect(() => {
    // Subscribe to ContributionMade events
    const unsubscribeContribution = on('ContributionMade', (event: AppEvent) => {
      const contributionEvent = event as ContributionMadeEvent;
      const groupId = String(contributionEvent.groupId); // Convert bigint to string
      triggerRefresh(groupId);
      showToast({
        message: `New contribution made in group ${groupId} by ${contributionEvent.contributor}!`,
        type: 'success',
      });
    });

    // Subscribe to PayoutExecuted events
    const unsubscribePayout = on('PayoutExecuted', (event: AppEvent) => {
      const payoutEvent = event as PayoutExecutedEvent;
      const groupId = String(payoutEvent.groupId); // Convert bigint to string
      triggerRefresh(groupId);
      showToast({
        message: `Payout executed for group ${groupId} to ${payoutEvent.recipient}!`,
        type: 'info',
      });
    });

    // Subscribe to GroupPaused events
    const unsubscribeGroupPaused = on('GroupPaused', (event: AppEvent) => {
      const groupPausedEvent = event as GroupPausedEvent;
      const groupId = String(groupPausedEvent.groupId); // Convert bigint to string
      triggerRefresh(groupId);
      showToast({
        message: `Group ${groupId} has been paused!`,
        type: 'warning',
      });
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeContribution();
      unsubscribePayout();
      unsubscribeGroupPaused();
    };
  }, [on, triggerRefresh, showToast]);
}