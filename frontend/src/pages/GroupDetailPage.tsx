/**
 * GroupDetail page — Issue #770
 *
 * Dedicated page for a single group at route /groups/:groupId showing:
 * - Group overview (name, status, description, progress)
 * - Member list with contribution status indicators (paid/unpaid) per cycle
 * - Payout rotation timeline with past and future recipients
 * - Contribution flow for active members
 *
 * The page is a composition layer only; the body, widgets and derivations live
 * in `components/group-detail/`.
 */
import { GroupDetailContent } from '../components/group-detail';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';

export default function GroupDetailPage() {
  return (
    <ErrorBoundary>
      <GroupDetailContent />
    </ErrorBoundary>
  );
}
