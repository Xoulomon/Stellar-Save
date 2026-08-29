/**
 * Contribution Reminder Notification Service
 *
 * Sends email reminders to group members before contribution deadlines.
 * Integrates with SendGrid for transactional email delivery.
 * Schedules reminders at 48h and 24h before each cycle deadline.
 *
 * Issue #791, #1301
 */

import * as sgMail from '@sendgrid/mail';
import { prisma } from '../prisma_client';
import { logger } from '../logger';
import { notificationPreferenceRepository } from '../modules/notifications/notification-preference.repository';
import { config } from '../config';
import { calculateReminderSchedules } from './reminder_scheduler';

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
 */
export async function sendContributionReminder(
  member: Member,
  groupId: string,
  deadline: Date,
  window: ReminderWindow = '24h'
): Promise<ReminderResult> {
  const apiKey = config.sendgrid.apiKey;
  const fromEmail = config.sendgrid.fromEmail;
  const appUrl = config.urls.app;

  try {
    const prefs = await notificationPreferenceRepository.findByUserId(member.userId);

    if (prefs && (!prefs.emailNotifications || !prefs.contributionReminders)) {
      logger.info('Skipping reminder — user opted out', { userId: member.userId, groupId });
      return { memberId: member.userId, email: member.email, status: 'skipped', reason: 'opted_out' };
    }

    const unsubscribeUrl = prefs
      ? `${appUrl}/notifications/unsubscribe/${prefs.unsubscribeToken}`
      : `${appUrl}/notifications/unsubscribe`;

    const groupEvent = await prisma.contractEvent.findFirst({
      where: { contractId: groupId, eventType: 'group_created' },
      orderBy: { timestamp: 'desc' },
    });

    const groupData = (groupEvent?.data as Record<string, any>) ?? {};
    const groupName: string = groupData.name ?? `Group ${groupId.slice(0, 8)}`;
    const amount: string = String(groupData.contribution_amount ?? '—');
    const cycleNumber: string = String(groupData.current_cycle ?? '—');

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

    if (!apiKey) {
      logger.warn('SENDGRID_API_KEY not set — skipping send', { userId: member.userId });
      return { memberId: member.userId, email: member.email, status: 'skipped', reason: 'no_api_key' };
    }

    sgMail.setApiKey(apiKey);

    const [response] = await sgMail.send({
      to: member.email,
      from: fromEmail,
      replyTo: config.sendgrid.replyTo,
      subject,
      html,
      text,
    });

    const messageId: string = (response.headers['x-message-id'] as string) ?? '';

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
        /* best-effort */
      });

    return { memberId: member.userId, email: member.email, status: 'failed', reason };
  }
}

// ── Scheduler ─────────────────────────────────────────────────────────────────

/**
 * Schedule contribution reminders for all members of a group.
 * Uses reminder_scheduler module for pure date calculation & timezone handling.
 */
export async function scheduleContributionReminders(
  members: Member[],
  groupId: string,
  deadline: Date
): Promise<string[]> {
  const queuedIds: string[] = [];

  for (const member of members) {
    // Fetch user preferences if available to pass to pure scheduler
    const prefsRecord = await notificationPreferenceRepository.findByUserId(member.userId);

    const slots = calculateReminderSchedules({
      deadline,
      preferences: prefsRecord ?? undefined,
      now: new Date(),
    });

    for (const slot of slots) {
      if (slot.isMuted) {
        logger.debug('Skipping reminder slot', {
          userId: member.userId,
          groupId,
          window: slot.window,
          reason: slot.skipReason,
        });
        continue;
      }

      const queued = await prisma.notificationQueue.create({
        data: {
          userId: member.userId,
          templateKey: `contribution_reminder_${slot.window}`,
          recipient: member.email,
          templateData: {
            memberName: member.name,
            memberEmail: member.email,
            groupId,
            deadline: deadline.toISOString(),
            window: slot.window,
          },
          notificationType: 'email',
          priority: slot.window === '24h' ? 10 : 5,
          scheduledFor: slot.scheduledTime,
        },
      });

      queuedIds.push(queued.id);
      logger.info('Reminder queued', {
        queueId: queued.id,
        userId: member.userId,
        groupId,
        window: slot.window,
        scheduledFor: slot.scheduledTime,
      });
    }
  }

  return queuedIds;
}

/**
 * Process due contribution reminders from the queue.
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
