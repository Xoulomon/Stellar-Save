# Notification Service Integration Guide

This guide walks developers through integrating the notification service with the Stellar-Save application.

## Phase 1: Initial Setup (Day 1)

### Step 1.1: Install Dependencies
```bash
cd backend
npm install
```

### Step 1.2: Update Environment Variables

Update `.env` with your credentials:

```bash
# Required for all environments
SENDGRID_API_KEY=SG.xxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@stellar-save.com
FIREBASE_PROJECT_ID=stellar-save-prod

# Optional - Firebase service account (get from Firebase console)
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"..."}'

# Frontend URL for unsubscribe and preference links
FRONTEND_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

### Step 1.3: Create Database Migration

```bash
# This creates the notification tables
npx prisma migrate dev --name add-notification-tables
```

## Phase 2: Application Integration (Day 1-2)

### Step 2.1: Import and Initialize in Main App

Update `backend/src/index.ts`:

```typescript
import { notificationRouter } from './routes/notifications';
import { NotificationTemplateManager } from './notification_template_manager';

// After Prisma client setup
const app = express();

// ... other middleware ...

// Initialize notification templates on startup
async function initializeApp() {
  try {
    await NotificationTemplateManager.initializeDefaultTemplates();
    console.log('Notification templates initialized');
  } catch (error) {
    console.error('Failed to initialize notification templates', error);
  }
}

// Register notification routes
app.use('/api/v1/notifications', notificationRouter);

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  await initializeApp();
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2.2: Add Background Job for Queue Processing

Create `backend/src/notification_queue_worker.ts`:

```typescript
import { notificationService } from './notification_service';
import { logger } from './logger';

/**
 * Start background worker for processing notification queue
 */
export function startNotificationQueueWorker() {
  const interval = parseInt(process.env.NOTIFICATION_QUEUE_INTERVAL || '60000');
  const batchSize = parseInt(process.env.NOTIFICATION_QUEUE_BATCH_SIZE || '100');

  setInterval(async () => {
    try {
      const processed = await notificationService.processQueuedNotifications(batchSize);
      if (processed > 0) {
        logger.info(`Processed ${processed} notifications from queue`);
      }
    } catch (error) {
      logger.error('Error processing notification queue', error);
    }
  }, interval);

  logger.info(`Notification queue worker started (interval: ${interval}ms)`);
}
```

Update `backend/src/index.ts`:

```typescript
import { startNotificationQueueWorker } from './notification_queue_worker';

app.listen(PORT, async () => {
  await initializeApp();
  startNotificationQueueWorker();  // Start background worker
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2.3: Test the Setup

```bash
# Start the server
npm run dev

# In another terminal, test the API
curl http://localhost:3001/api/v1/notifications/health

# Should return:
# {
#   "status": "ok",
#   "timestamp": "...",
#   "providers": {
#     "email": true,
#     "push": ["firebase"]
#   }
# }
```

## Phase 3: Smart Contract Integration (Day 2-3)

### Step 3.1: Listen to Contribution Events

Update `backend/src/index.ts` to add event listeners:

```typescript
import { ContractEventIndexer } from './contract_event_indexer';
import { notificationService } from './notification_service';
import { UserPreferenceManager } from './user_preference_manager';

// Initialize event indexer
const eventIndexer = new ContractEventIndexer();

// Listen for contribution submitted event
eventIndexer.on('ContributionSubmitted', async (event) => {
  try {
    const shouldSend = await UserPreferenceManager.shouldSendNotification(
      event.userId,
      'email',
      'contribution_confirmed'
    );

    if (!shouldSend) return;

    await notificationService.sendEmail(
      event.userEmail,
      'email_contribution_confirmed',
      {
        userId: event.userId,
        userName: event.userName,
        groupName: event.groupName,
        amount: event.amount,
        txHash: event.transactionHash,
        timestamp: new Date().toISOString(),
        membersRemaining: event.membersRemaining,
        unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/${event.unsubscribeToken}`,
      },
      'Contribution Confirmed'
    );

    logger.info(`Sent confirmation email for contribution from ${event.userId}`);
  } catch (error) {
    logger.error('Error sending contribution confirmation', error);
  }
});

// Listen for payout triggered event
eventIndexer.on('PayoutTriggered', async (event) => {
  try {
    const shouldSend = await UserPreferenceManager.shouldSendNotification(
      event.recipientId,
      'email',
      'payout_notification'
    );

    if (!shouldSend) return;

    // Queue the notification to be sent immediately (high priority)
    await notificationService.queueNotification(
      event.recipientId,
      'email_payout_notification',
      event.recipientEmail,
      {
        userId: event.recipientId,
        userName: event.recipientName,
        groupName: event.groupName,
        amount: event.amount,
        cycleNumber: event.cycleNumber,
        payoutWallet: event.recipientWallet,
        appUrl: process.env.APP_URL,
        groupId: event.groupId,
        unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/${event.unsubscribeToken}`,
      },
      'email',
      1, // High priority
      new Date() // Send immediately
    );

    logger.info(`Queued payout notification for ${event.recipientId}`);
  } catch (error) {
    logger.error('Error queuing payout notification', error);
  }
});

// Start the indexer
eventIndexer.start();
```

### Step 3.2: Add Scheduled Contribution Reminders

Create `backend/src/scheduled_tasks.ts`:

```typescript
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { notificationService } from './notification_service';
import { UserPreferenceManager } from './user_preference_manager';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Send contribution reminders 3 days before deadline
 */
export function scheduleContributionReminders() {
  // Run daily at 9 AM UTC
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Starting scheduled contribution reminders...');

      const now = new Date();
      const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      // Query for groups where contribution deadline is in 3 days
      const upcomingDeadlines = await prisma.group.findMany({
        where: {
          nextDeadline: {
            gte: now,
            lte: threeDaysLater,
          },
        },
      });

      for (const group of upcomingDeadlines) {
        // Get group members who haven't contributed this cycle
        const membersWhoNeedToContribute = await prisma.member.findMany({
          where: {
            groupIds: {
              has: group.id,
            },
            // Additional filter for those who haven't contributed
          },
        });

        for (const member of membersWhoNeedToContribute) {
          const shouldSend = await UserPreferenceManager.shouldSendNotification(
            member.id,
            'email',
            'contribution_reminder'
          );

          if (!shouldSend) continue;

          const daysRemaining = Math.ceil(
            (group.nextDeadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
          );

          await notificationService.queueNotification(
            member.id,
            'email_contribution_reminder',
            member.email,
            {
              userId: member.id,
              userName: member.name,
              groupName: group.name,
              amount: group.contributionAmount,
              dueDate: group.nextDeadline.toISOString().split('T')[0],
              daysRemaining,
              appUrl: process.env.APP_URL,
              groupId: group.id,
              unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe/${member.unsubscribeToken}`,
            },
            'email',
            0,
            new Date()
          );
        }
      }

      logger.info(`Scheduled ${upcomingDeadlines.length} contribution reminder batches`);
    } catch (error) {
      logger.error('Error in scheduled contribution reminders', error);
    }
  });
}

/**
 * Send daily digest emails for users who prefer them
 */
export function scheduleDailyDigests() {
  // Run daily at 9 AM UTC
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Generating daily digest emails...');

      const userIds = await UserPreferenceManager.getUsersForDigest('daily');

      for (const userId of userIds) {
        // Collect events for this user in the last 24 hours
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const notifications = await notificationService.getNotificationHistory(userId, 24);

        if (notifications.length === 0) continue;

        await notificationService.queueNotification(
          userId,
          'email_daily_digest',
          user.email,
          {
            userId,
            userName: user.name,
            eventCount: notifications.length,
            appUrl: process.env.APP_URL,
          },
          'email',
          0,
          new Date()
        );
      }

      logger.info(`Queued daily digests for ${userIds.length} users`);
    } catch (error) {
      logger.error('Error generating daily digests', error);
    }
  });
}
```

Update `backend/src/index.ts`:

```typescript
import { scheduleContributionReminders, scheduleDailyDigests } from './scheduled_tasks';

app.listen(PORT, async () => {
  await initializeApp();
  startNotificationQueueWorker();
  scheduleContributionReminders();  // Enable scheduled reminders
  scheduleDailyDigests();            // Enable digest emails
  console.log(`Server running on port ${PORT}`);
});
```

## Phase 4: Frontend Integration (Day 3-4)

### Step 4.1: Register Device Token on App Launch

In frontend code (e.g., React):

```typescript
import { useEffect } from 'react';

export function AppInitializer() {
  useEffect(() => {
    // Register device token for push notifications
    async function registerDeviceToken() {
      const userId = getUserId(); // From auth
      const deviceToken = await getFirebaseToken(); // From Firebase SDK

      try {
        await fetch('/api/v1/notifications/device-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            deviceToken,
            platform: getPlatform(), // iOS, Android, web
          }),
        });
      } catch (error) {
        console.error('Failed to register device token', error);
      }
    }

    registerDeviceToken();
  }, []);

  return null;
}
```

### Step 4.2: Create Preference Management UI

```typescript
import { useEffect, useState } from 'react';

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const userId = getUserId();

  useEffect(() => {
    // Fetch current preferences
    fetch(`/api/v1/notifications/preferences/${userId}`)
      .then((res) => res.json())
      .then(setPreferences);
  }, [userId]);

  const handleUpdate = async (updates) => {
    await fetch(`/api/v1/notifications/preferences/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    // Refresh preferences
    setPreferences({ ...preferences, ...updates });
  };

  return (
    <div>
      <h2>Notification Preferences</h2>

      <label>
        <input
          type="checkbox"
          checked={preferences?.emailNotifications}
          onChange={(e) => handleUpdate({ emailNotifications: e.target.checked })}
        />
        Email Notifications
      </label>

      <label>
        <input
          type="checkbox"
          checked={preferences?.pushNotifications}
          onChange={(e) => handleUpdate({ pushNotifications: e.target.checked })}
        />
        Push Notifications
      </label>

      <label>
        <input
          type="checkbox"
          checked={preferences?.contributionReminders}
          onChange={(e) => handleUpdate({ contributionReminders: e.target.checked })}
        />
        Contribution Reminders
      </label>

      {/* More preference toggles */}
    </div>
  );
}
```

## Phase 5: Testing & Monitoring (Day 4-5)

### Step 5.1: Manual Testing

```bash
# Test sending email
curl -X POST http://localhost:3001/api/v1/notifications/send-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "userId": "user-123",
    "templateId": "email_contribution_reminder",
    "templateData": {
      "userName": "John Doe",
      "groupName": "Weekly Group",
      "amount": "100",
      "dueDate": "2024-03-20",
      "daysRemaining": "3"
    }
  }'
```

### Step 5.2: Monitor Queue Health

```bash
# Check notification statistics
curl http://localhost:3001/api/v1/notifications/stats

# Check service health
curl http://localhost:3001/api/v1/notifications/health

# View user notification history
curl http://localhost:3001/api/v1/notifications/history/user-123
```

### Step 5.3: Set Up Error Tracking

Integrate with your error tracking service (e.g., Sentry):

```typescript
import * as Sentry from '@sentry/node';

try {
  await notificationService.sendEmail(...);
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      service: 'notification',
      action: 'send_email',
    },
  });
}
```

## Phase 6: Production Deployment (Day 5-6)

### Step 6.1: Production Environment

```bash
# .env.production
SENDGRID_API_KEY=SG.xxxxx (production key)
FIREBASE_PROJECT_ID=stellar-save-prod
PUSH_PROVIDER=firebase
FRONTEND_URL=https://stellar-save.com
APP_URL=https://stellar-save.com
NOTIFICATION_QUEUE_BATCH_SIZE=500
NOTIFICATION_QUEUE_INTERVAL=30000
```

### Step 6.2: Database Backup

```bash
# Backup before deployment
pg_dump $DATABASE_URL > notifications_backup.sql
```

### Step 6.3: Monitor Delivery Rates

Set up monitoring dashboard:

```typescript
app.get('/api/admin/notifications/metrics', async (req, res) => {
  const stats = await notificationService.getNotificationStats();
  const successRate = (stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100;

  res.json({
    totalSent: stats.totalSent,
    totalFailed: stats.totalFailed,
    totalPending: stats.totalPending,
    successRate: successRate.toFixed(2),
    byType: stats.byType,
  });
});
```

## Debugging Tips

### Email Not Sending
1. Check SendGrid API key is valid
2. Verify sender domain is authenticated
3. Check email format in templates
4. Look for bounces/deferred in SendGrid dashboard

### Push Notifications Not Received
1. Verify Firebase credentials
2. Check device token is current
3. Test with Firebase console
4. Check app push notification permissions

### Queue Not Processing
1. Verify `NOTIFICATION_QUEUE_INTERVAL` is set
2. Check server logs for queue worker errors
3. Ensure database connectivity
4. Verify Prisma migrations ran successfully

### Template Issues
1. Check placeholder names match template data
2. Verify template is active in database
3. Test template rendering in isolation
4. Use `renderTemplate()` method to debug

## Success Metrics

Track these metrics post-deployment:

- **Delivery Rate**: > 95%
- **Success Rate**: > 98%
- **Queue Backlog**: < 1000 pending
- **Processing Time**: < 1 second per notification
- **User Opt-in Rate**: > 70%
- **Email Open Rate**: > 20%
- **Push Click-through**: > 5%

## Support & Troubleshooting

See `docs/notification-service.md` for complete API reference and troubleshooting guide.
