/**
 * jobs/sms_reminder_job.ts
 *
 * Scheduled job that scans groups for upcoming contribution deadlines and
 * sends SMS/WhatsApp reminders to opted-in members based on their lead time.
 *
 * Runs on a configurable cron schedule (default: every hour).
 * Uses ContractEvent records to determine cycle deadlines.
 */

import { CronJob } from 'cron';
import { prisma } from '../prisma_client';
import { sendReminder } from '../sms_service';
import { logger } from '../logger';

/** Look ahead window in hours — covers the longest possible lead time. */
const LOOKAHEAD_HOURS = 48;

async function runSmsReminders(): Promise<void> {
  logger.info('[sms-job] Starting SMS reminder scan');

  // Find all verified, opted-in users with SMS preferences
  const reminders = await (prisma as any).smsReminder.findMany({
    where: { verified: true, optedOut: false },
  }) as Array<{
    userId: string;
    phone: string;
    channel: string;
    leadTimeHours: number;
  }>;

  if (!reminders.length) return;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  // Find group deadline events within the look-ahead window.
  // We look for CycleDeadline events stored by the contract indexer.
  const deadlineEvents = await (prisma as any).contractEvent.findMany({
    where: {
      eventType: 'CycleDeadline',
      timestamp: { gte: now, lte: windowEnd },
    },
    select: { data: true },
  }) as Array<{ data: { groupId?: string; groupName?: string; deadlineTs?: number; members?: string[] } }>;

  for (const reminder of reminders) {
    for (const event of deadlineEvents) {
      const { groupId, groupName, deadlineTs, members } = event.data;

      // Only notify if this user is a member of the group
      if (!members?.includes(reminder.userId)) continue;

      const deadline = deadlineTs ? new Date(deadlineTs * 1000) : null;
      if (!deadline) continue;

      const hoursUntil = (deadline.getTime() - now.getTime()) / (60 * 60 * 1000);
      // Fire when the remaining time is within ±30 min of the user's lead time
      if (Math.abs(hoursUntil - reminder.leadTimeHours) > 0.5) continue;

      const formattedDeadline = deadline.toUTCString();
      const msgBody =
        `Stellar Save reminder: Your contribution for group "${groupName ?? groupId}" ` +
        `is due ${reminder.leadTimeHours <= 1 ? 'in 1 hour' : `in ${reminder.leadTimeHours} hours`} ` +
        `(${formattedDeadline}). Reply STOP to unsubscribe.`;

      await sendReminder(reminder.phone, reminder.channel as 'sms' | 'whatsapp', msgBody);
    }
  }

  logger.info('[sms-job] SMS reminder scan complete', { users: reminders.length, deadlines: deadlineEvents.length });
}

let job: CronJob | null = null;

export function startSmsReminderJob(schedule = '0 * * * *'): void {
  if (job) return;
  job = new CronJob(schedule, () => {
    runSmsReminders().catch((err) =>
      logger.error('[sms-job] Unhandled error', { error: String(err) })
    );
  });
  job.start();
  logger.info('[sms-job] SMS reminder scheduler started', { schedule });
}

export function stopSmsReminderJob(): void {
  job?.stop();
  job = null;
}

/** Exported for tests */
export { runSmsReminders };
