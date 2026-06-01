/**
 * Contribution Reminder Notification Service
 *
 * Sends email reminders to group members before contribution deadlines.
 * Integrates with SendGrid for transactional email delivery.
 * Schedules reminders at 48h and 24h before each cycle deadline.
 *
 * Issue #791
 */

import * as sgMail from '@sendgrid/mail';
import { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

const prisma = new PrismaClient();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Member {
  userId: string;
  email: string;
  name: string;
}

export interface ReminderResult {
  memberId: string;
  email: string;
  status: 'sent' | 'skipped' | 'failed';
  messageId?: string;
  reason?: string;
}

export interface ScheduledReminder {
  id: string;
  memberId: string;
  groupId: string;
  deadline: Date;
  hoursBeforeDeadline: 48 | 24;
  scheduledAt: Date;
  status: 'pending' | 'sent' | 'failed';
}

// ── Email templates ───────────────────────────────────────────────────────────

const REMINDER_TEMPLATES = {
  '48h': {
    subject: 'Reminder: Your contribution is due in 48 hours — {{groupName}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0A1F44;">Contribution Reminder</h2>
        <p>Hi {{memberName}},</p>
        <p>This is a friendly reminder that your contribution to <strong>{{groupName}}</strong> is due in <strong>48 hours</strong>.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666;">Group</td><td style="padding:8px;"><strong>{{groupName}}</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Amount Due</td><td style="padding:8px;"><strong>{{amount}} XLM</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Deadline</td><td style="padding:8px;"><strong>{{deadline}}</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Cycle</td><td style="padding:8px;">{{cycleNumber}}</td></tr>
        </table>
        <a href="{{appUrl}}/groups/{{groupId}}" style="display:inline-block; background:#00A8E8; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin-top:8px;">
          Make Contribution
        </a>
        <p style="margin-top:24px; color:#888; font-size:12px;">
          You're receiving this because you're a member of {{groupName}} on Stellar-Save.<br/>
          <a href="{{unsubscribeUrl}}">Unsubscribe from reminders</a>
        </p>
      </div>
    `,
    text: `Hi {{memberName}},\n\nYour contribution to {{groupName}} is due in 48 hours.\n\nAmount: {{amount}} XLM\nDeadline: {{deadline}}\nCycle: {{cycleNumber}}\n\nMake your contribution: {{appUrl}}/groups/{{groupId}}\n\nUnsubscribe: {{unsubscribeUrl}}`,
  },
  '24h': {
    subject: 'Action Required: Contribution due in 24 hours — {{groupName}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #e85c00;">⏰ Final Reminder</h2>
        <p>Hi {{memberName}},</p>
        <p>Your contribution to <strong>{{groupName}}</strong> is due in <strong>24 hours</strong>. Please contribute before the deadline to avoid any penalties.</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding:8px; color:#666;">Group</td><td style="padding:8px;"><strong>{{groupName}}</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Amount Due</td><td style="padding:8px;"><strong>{{amount}} XLM</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Deadline</td><td style="padding:8px;"><strong>{{deadline}}</strong></td></tr>
          <tr><td style="padding:8px; color:#666;">Cycle</td><td style="padding:8px;">{{cycleNumber}}</td></tr>
        </table>
        <a href="{{appUrl}}/groups/{{groupId}}" style="display:inline-block; background:#e85c00; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin-top:8px;">
          Contribute Now
        </a>
        <p style="margin-top:24px; color:#888; font-size:12px;">
          You're receiving this because you're a member of {{groupName}} on Stellar-Save.<br/>
          <a href="{{unsubscribeUrl}}">Unsubscribe from reminders</a>
        </p>
      </div>
    `,
    text: `Hi {{memberName}},\n\nFINAL REMINDER: Your contribution to {{groupName}} is due in 24 hours.\n\nAmount: {{amount}} XLM\nDeadline: {{deadline}}\nCycle: {{cycleNumber}}\n\nContribute now: {{appUrl}}/groups/{{groupId}}\n\nUnsubscribe: {{unsubscribeUrl}}`,
  },
} as const;

type ReminderWindow = keyof typeof REMINDER_TEMPLATES;

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (out, [key, val]) => out.replace(new RegExp(`{{${key}}}`, 'g'), val),
    template
  );
}

function formatDeadline(date: Date): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Send a contribution reminder email to a single member.
 *
 * @param member   - The recipient member (userId, email, name)
 * @param groupId  - The savings group identifier
 * @param deadline - The contribution deadline timestamp
 * @param window   - How far before the deadline this reminder is for ('48h' | '24h')
 * @returns        ReminderResult with delivery status and SendGrid message ID
 */
export async function sendContributionReminder(
  member: Member,
  groupId: string,
  deadline: Date,
  window: ReminderWindow = '24h'
): Promise<ReminderResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@stellar-save.com';
  const appUrl = process.env.APP_URL ?? 'https://stellar-save.app';

  // ── 1. Check user notification preferences ────────────────────────────────
  try {
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: member.userId },
    });

    if (prefs && (!prefs.emailNotifications || !prefs.contributionReminders)) {
      logger.info('Skipping reminder — user opted out', { userId: member.userId, groupId });
      return { memberId: member.userId, email: member.email, status: 'skipped', reason: 'opted_out' };
    }

    const unsubscribeUrl = prefs
      ? `${appUrl}/notifications/unsubscribe/${prefs.unsubscribeToken}`
      : `${appUrl}/notifications/unsubscribe`;

    // ── 2. Fetch group metadata ───────────────────────────────────────────────
    // Group data lives on-chain; we use a lightweight lookup from indexed events.
    // Fall back to sensible defaults when the indexer hasn't synced yet.
    const groupEvent = await prisma.contractEvent.findFirst({
      where: { contractId: groupId, eventType: 'group_created' },
      orderBy: { timestamp: 'desc' },
    });

    const groupData = (groupEvent?.data as Record<string, any>) ?? {};
    const groupName: string = groupData.name ?? `Group ${groupId.slice(0, 8)}`;
    const amount: string = String(groupData.contribution_amount ?? '—');
    const cycleNumber: string = String(groupData.current_cycle ?? '—');

    // ── 3. Build email ────────────────────────────────────────────────────────
    const tpl = REMINDER_TEMPLATES[window];
    const vars: Record<string, string> = {
      memberName: member.name,
      groupName,
      groupId,
      amount,
      deadline: formatDeadline(deadline),
      cycleNumber,
      appUrl,
      unsubscribeUrl,
    };

    const subject = renderTemplate(tpl.subject, vars);
    const html = renderTemplate(tpl.html, vars);
    const text = renderTemplate(tpl.text, vars);

    // ── 4. Send via SendGrid ──────────────────────────────────────────────────
    if (!apiKey) {
      logger.warn('SENDGRID_API_KEY not set — skipping send', { userId: member.userId });
      return { memberId: member.userId, email: member.email, status: 'skipped', reason: 'no_api_key' };
    }

    sgMail.setApiKey(apiKey);

    const [response] = await sgMail.send({
      to: member.email,
      from: fromEmail,
      replyTo: process.env.SENDGRID_REPLY_TO ?? 'support@stellar-save.com',
      subject,
      html,
      text,
    });

    const messageId: string = (response.headers['x-message-id'] as string) ?? '';

    // ── 5. Persist notification record ───────────────────────────────────────
    await prisma.notification.create({
      data: {
        userId: member.userId,
        templateId: `contribution_reminder_${window}`,
        notificationType: 'email',
        recipient: member.email,
        subject,
        renderedContent: html,
        metadata: { groupId, deadline: deadline.toISOString(), window, cycleNumber },
        externalId: messageId,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    logger.info('Contribution reminder sent', { userId: member.userId, groupId, window, messageId });
    return { memberId: member.userId, email: member.email, status: 'sent', messageId };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.error('Failed to send contribution reminder', { userId: member.userId, groupId, error: reason });

    // Persist failure for observability
    await prisma.notification
      .create({
        data: {
          userId: member.userId,
          templateId: `contribution_reminder_${window}`,
          notificationType: 'email',
          recipient: member.email,
          subject: '',
          renderedContent: '',
          metadata: { groupId, deadline: deadline.toISOString(), window },
          status: 'failed',
          failureReason: reason,
        },
      })
      .catch(() => {
        /* best-effort — don't mask the original error */
      });

    return { memberId: member.userId, email: member.email, status: 'failed', reason };
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Schedule contribution reminders for all members of a group.
 *
 * Enqueues two notifications per member:
 *   • 48 hours before the deadline
 *   • 24 hours before the deadline
 *
 * Uses the existing NotificationQueue model so the queue processor
 * (NotificationService.processQueuedNotifications) handles delivery.
 *
 * @param members  - Array of group members to notify
 * @param groupId  - The savings group identifier
 * @param deadline - The contribution deadline
 * @returns        Array of queued notification IDs
 */
export async function scheduleContributionReminders(
  members: Member[],
  groupId: string,
  deadline: Date
): Promise<string[]> {
  const queuedIds: string[] = [];
  const now = Date.now();

  const windows: { window: ReminderWindow; offsetMs: number }[] = [
    { window: '48h', offsetMs: 48 * 60 * 60 * 1000 },
    { window: '24h', offsetMs: 24 * 60 * 60 * 1000 },
  ];

  for (const member of members) {
    for (const { window, offsetMs } of windows) {
      const scheduledFor = new Date(deadline.getTime() - offsetMs);

      // Skip if the scheduled time is already in the past
      if (scheduledFor.getTime() <= now) {
        logger.debug('Skipping past reminder slot', {
          userId: member.userId,
          groupId,
          window,
          scheduledFor,
        });
        continue;
      }

      const queued = await prisma.notificationQueue.create({
        data: {
          userId: member.userId,
          templateKey: `contribution_reminder_${window}`,
          recipient: member.email,
          templateData: {
            memberName: member.name,
            memberEmail: member.email,
            groupId,
            deadline: deadline.toISOString(),
            window,
          },
          notificationType: 'email',
          priority: window === '24h' ? 10 : 5, // 24h reminder is higher priority
          scheduledFor,
        },
      });

      queuedIds.push(queued.id);
      logger.info('Reminder queued', {
        queueId: queued.id,
        userId: member.userId,
        groupId,
        window,
        scheduledFor,
      });
    }
  }

  return queuedIds;
}

/**
 * Process due contribution reminders from the queue.
 *
 * Intended to be called by a cron job (e.g. every 15 minutes).
 * Picks up queued reminders whose scheduledFor time has passed
 * and dispatches them via sendContributionReminder.
 *
 * @param batchSize - Max reminders to process per invocation (default 50)
 * @returns         Number of reminders successfully sent
 */
export async function processDueReminders(batchSize = 50): Promise<number> {
  const due = await prisma.notificationQueue.findMany({
    where: {
      status: 'pending',
      notificationType: 'email',
      templateKey: { startsWith: 'contribution_reminder_' },
      scheduledFor: { lte: new Date() },
    },
    orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }],
    take: batchSize,
  });

  let sent = 0;

  for (const job of due) {
    // Mark as processing to prevent double-delivery
    await prisma.notificationQueue.update({
      where: { id: job.id },
      data: { status: 'processing' },
    });

    const data = job.templateData as Record<string, any>;
    const window = (data.window ?? '24h') as ReminderWindow;
    const deadline = new Date(data.deadline);

    const member: Member = {
      userId: job.userId,
      email: job.recipient,
      name: data.memberName ?? job.recipient,
    };

    const result = await sendContributionReminder(member, data.groupId, deadline, window);

    await prisma.notificationQueue.update({
      where: { id: job.id },
      data: {
        status: result.status === 'sent' ? 'completed' : 'failed',
        processedAt: new Date(),
      },
    });

    if (result.status === 'sent') sent++;
  }

  logger.info(`processDueReminders: ${sent}/${due.length} sent`);
  return sent;
}
