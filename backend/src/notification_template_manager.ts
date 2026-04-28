import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Notification Template Types
 */
export enum NotificationTemplateType {
  Email = 'email',
  Push = 'push',
}

export enum NotificationEventType {
  ContributionReminder = 'contribution_reminder',
  ContributionConfirmed = 'contribution_confirmed',
  PayoutNotification = 'payout_notification',
  GroupUpdate = 'group_update',
  MemberJoined = 'member_joined',
  GroupCreated = 'group_created',
  PayoutFailed = 'payout_failed',
  ProofOfPayment = 'proof_of_payment',
}

/**
 * Template Manager Service
 * Manages creation, retrieval, and rendering of notification templates
 */
export class NotificationTemplateManager {
  /**
   * Initialize default templates in the database
   */
  static async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      // Email Templates
      {
        templateKey: 'email_contribution_reminder',
        templateName: 'Contribution Reminder - Email',
        templateType: NotificationTemplateType.Email,
        subject: 'Reminder: Contribution due for {{groupName}}',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Contribution Reminder</h2>
                <p>Hi {{userName}},</p>
                <p>This is a reminder that your contribution to the <strong>{{groupName}}</strong> group is due.</p>
                <div style="background-color: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <p><strong>Group:</strong> {{groupName}}</p>
                  <p><strong>Amount:</strong> {{amount}} XLM</p>
                  <p><strong>Due Date:</strong> {{dueDate}}</p>
                  <p><strong>Days Remaining:</strong> {{daysRemaining}}</p>
                </div>
                <p>Please contribute as soon as possible to avoid delays in the payout cycle.</p>
                <p>
                  <a href="{{appUrl}}/groups/{{groupId}}" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    Make Contribution
                  </a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                  You're receiving this email because you're a member of {{groupName}} on Stellar-Save.
                  <br>
                  <a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe</a>
                </p>
              </div>
            </body>
          </html>
        `,
        textContent: `
          Contribution Reminder

          Hi {{userName}},

          This is a reminder that your contribution to the {{groupName}} group is due.

          Group: {{groupName}}
          Amount: {{amount}} XLM
          Due Date: {{dueDate}}
          Days Remaining: {{daysRemaining}}

          Please contribute as soon as possible to avoid delays in the payout cycle.

          Visit: {{appUrl}}/groups/{{groupId}}
        `,
        placeholders: ['userName', 'groupName', 'amount', 'dueDate', 'daysRemaining', 'appUrl', 'groupId', 'unsubscribeUrl'],
      },
      {
        templateKey: 'email_contribution_confirmed',
        templateName: 'Contribution Confirmed - Email',
        templateType: NotificationTemplateType.Email,
        subject: 'Contribution Confirmed for {{groupName}}',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Contribution Confirmed</h2>
                <p>Hi {{userName}},</p>
                <p>Your contribution to <strong>{{groupName}}</strong> has been successfully recorded.</p>
                <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                  <p><strong style="color: #28a745;">✓ Confirmed</strong></p>
                  <p><strong>Amount:</strong> {{amount}} XLM</p>
                  <p><strong>Transaction Hash:</strong> <code>{{txHash}}</code></p>
                  <p><strong>Timestamp:</strong> {{timestamp}}</p>
                </div>
                <p>You're {{membersRemaining}} step away from receiving your payout.</p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                  <a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe</a>
                </p>
              </div>
            </body>
          </html>
        `,
        textContent: `
          Contribution Confirmed

          Hi {{userName}},

          Your contribution to {{groupName}} has been successfully recorded.

          ✓ Confirmed
          Amount: {{amount}} XLM
          Transaction Hash: {{txHash}}
          Timestamp: {{timestamp}}

          You're {{membersRemaining}} step away from receiving your payout.
        `,
        placeholders: ['userName', 'groupName', 'amount', 'txHash', 'timestamp', 'membersRemaining', 'unsubscribeUrl'],
      },
      {
        templateKey: 'email_payout_notification',
        templateName: 'Payout Ready - Email',
        templateType: NotificationTemplateType.Email,
        subject: 'Your Payout is Ready - {{groupName}}',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #28a745;">🎉 Your Payout is Ready!</h2>
                <p>Hi {{userName}},</p>
                <p>Congratulations! Your turn has arrived. Your payout from <strong>{{groupName}}</strong> is ready to be claimed.</p>
                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                  <p><strong>Payout Amount:</strong> <span style="font-size: 24px; color: #28a745;">{{amount}} XLM</span></p>
                  <p><strong>Group:</strong> {{groupName}}</p>
                  <p><strong>Cycle Number:</strong> {{cycleNumber}}</p>
                  <p><strong>Payout Wallet:</strong> {{payoutWallet}}</p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  The payout has been initiated on the Stellar blockchain. You should receive these funds in your wallet shortly.
                </p>
                <p>
                  <a href="{{appUrl}}/groups/{{groupId}}" style="display: inline-block; background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View Group Details
                  </a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                  <a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe</a>
                </p>
              </div>
            </body>
          </html>
        `,
        textContent: `
          🎉 Your Payout is Ready!

          Hi {{userName}},

          Congratulations! Your turn has arrived. Your payout from {{groupName}} is ready to be claimed.

          Payout Amount: {{amount}} XLM
          Group: {{groupName}}
          Cycle Number: {{cycleNumber}}
          Payout Wallet: {{payoutWallet}}

          The payout has been initiated on the Stellar blockchain. You should receive these funds in your wallet shortly.

          Visit: {{appUrl}}/groups/{{groupId}}
        `,
        placeholders: ['userName', 'groupName', 'amount', 'cycleNumber', 'payoutWallet', 'appUrl', 'groupId', 'unsubscribeUrl'],
      },
      {
        templateKey: 'email_group_update',
        templateName: 'Group Update - Email',
        templateType: NotificationTemplateType.Email,
        subject: 'Update: {{groupName}}',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Group Update</h2>
                <p>Hi {{userName}},</p>
                <p>There's an update in your group <strong>{{groupName}}</strong>:</p>
                <div style="background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3;">
                  <p><strong>{{updateTitle}}</strong></p>
                  <p>{{updateMessage}}</p>
                </div>
                <p>
                  <a href="{{appUrl}}/groups/{{groupId}}" style="display: inline-block; background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                    View Group
                  </a>
                </p>
                <p style="margin-top: 30px; color: #666; font-size: 12px;">
                  <a href="{{unsubscribeUrl}}" style="color: #666;">Unsubscribe</a>
                </p>
              </div>
            </body>
          </html>
        `,
        textContent: `
          Group Update

          Hi {{userName}},

          There's an update in your group {{groupName}}:

          {{updateTitle}}
          {{updateMessage}}

          Visit: {{appUrl}}/groups/{{groupId}}
        `,
        placeholders: ['userName', 'groupName', 'updateTitle', 'updateMessage', 'appUrl', 'groupId', 'unsubscribeUrl'],
      },

      // Push Notification Templates
      {
        templateKey: 'push_contribution_reminder',
        templateName: 'Contribution Reminder - Push',
        templateType: NotificationTemplateType.Push,
        subject: undefined,
        htmlContent: 'Contribution Reminder: {{daysRemaining}} days left to contribute {{amount}} XLM to {{groupName}}',
        textContent: 'Don\'t miss your contribution deadline! {{daysRemaining}} days remaining.',
        placeholders: ['groupName', 'amount', 'daysRemaining'],
      },
      {
        templateKey: 'push_payout_ready',
        templateName: 'Payout Ready - Push',
        templateType: NotificationTemplateType.Push,
        subject: undefined,
        htmlContent: 'Your {{amount}} XLM payout from {{groupName}} is ready!',
        textContent: 'Congratulations! Your payout is being processed.',
        placeholders: ['groupName', 'amount'],
      },
      {
        templateKey: 'push_contribution_confirmed',
        templateName: 'Contribution Confirmed - Push',
        templateType: NotificationTemplateType.Push,
        subject: undefined,
        htmlContent: 'Contribution confirmed: {{amount}} XLM added to {{groupName}}',
        textContent: 'Your contribution has been recorded successfully.',
        placeholders: ['groupName', 'amount'],
      },
      {
        templateKey: 'push_member_joined',
        templateName: 'Member Joined - Push',
        templateType: NotificationTemplateType.Push,
        subject: undefined,
        htmlContent: '{{memberName}} joined {{groupName}} ({{totalMembers}}/{{maxMembers}})',
        textContent: 'New member joined your group',
        placeholders: ['memberName', 'groupName', 'totalMembers', 'maxMembers'],
      },
    ];

    for (const template of defaultTemplates) {
      const exists = await prisma.notificationTemplate.findUnique({
        where: { templateKey: template.templateKey },
      });

      if (!exists) {
        await prisma.notificationTemplate.create({
          data: template,
        });
        logger.info(`Created template: ${template.templateKey}`);
      }
    }

    logger.info('Notification templates initialized');
  }

  /**
   * Get a template by key
   */
  static async getTemplate(templateKey: string) {
    return await prisma.notificationTemplate.findUnique({
      where: { templateKey },
    });
  }

  /**
   * Get all active templates
   */
  static async getActiveTemplates() {
    return await prisma.notificationTemplate.findMany({
      where: { active: true },
    });
  }

  /**
   * Create a custom template
   */
  static async createTemplate(data: {
    templateKey: string;
    templateName: string;
    templateType: string;
    subject?: string;
    htmlContent: string;
    textContent: string;
    placeholders: string[];
  }) {
    return await prisma.notificationTemplate.create({
      data,
    });
  }

  /**
   * Update a template
   */
  static async updateTemplate(
    templateKey: string,
    data: { subject?: string; htmlContent?: string; textContent?: string; active?: boolean }
  ) {
    return await prisma.notificationTemplate.update({
      where: { templateKey },
      data,
    });
  }

  /**
   * Disable a template
   */
  static async disableTemplate(templateKey: string) {
    return await prisma.notificationTemplate.update({
      where: { templateKey },
      data: { active: false },
    });
  }
}

export const notificationTemplateManager = NotificationTemplateManager;
