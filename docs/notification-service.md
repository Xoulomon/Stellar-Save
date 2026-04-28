# Notification Service Implementation (Issue #557)

## Overview

The Stellar-Save notification service provides a comprehensive solution for sending email and push notifications to users about contribution reminders, group updates, and payout notifications. The system is built with flexibility, scalability, and user preference management at its core.

## Architecture

### Components

1. **NotificationService** - Core service for managing notifications
   - Sends emails via SendGrid
   - Queues notifications for later delivery
   - Manages notification history and statistics
   - Handles notification cleanup

2. **PushNotificationService** - Manages push notifications
   - Supports Firebase Cloud Messaging (FCM)
   - Supports OneSignal
   - Pluggable provider system for easy extension

3. **NotificationTemplateManager** - Template management
   - Pre-built templates for common events
   - Custom template creation
   - Template rendering with placeholder substitution

4. **UserPreferenceManager** - User preference management
   - Notification preferences per user
   - Subscription/unsubscription management
   - Device token management
   - Email frequency control

5. **NotificationRouter** - API endpoints
   - RESTful API for notification operations
   - Preference management endpoints
   - Template management endpoints
   - Statistics and monitoring endpoints

## Setup

### 1. Environment Configuration

Add the following to your `.env` file:

```env
# SendGrid Email
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@stellar-save.com
SENDGRID_REPLY_TO=support@stellar-save.com

# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Alternative: OneSignal
ONESIGNAL_APP_ID=your-app-id
ONESIGNAL_API_KEY=your-api-key

# Push Provider Selection
PUSH_PROVIDER=firebase

# Frontend URLs
FRONTEND_URL=https://stellar-save.com
APP_URL=https://stellar-save.com

# Processing
NOTIFICATION_QUEUE_BATCH_SIZE=100
NOTIFICATION_QUEUE_INTERVAL=60000
```

### 2. Install Dependencies

```bash
npm install
```

The following packages are required:
- `@sendgrid/mail` - Email sending
- `firebase-admin` - Firebase integration
- `node-fetch` - HTTP requests
- `uuid` - Token generation

### 3. Database Setup

Run Prisma migrations to create notification tables:

```bash
npx prisma migrate dev --name add-notification-tables
```

### 4. Initialize Templates

Templates are automatically initialized when the application starts. To manually initialize:

```typescript
import { NotificationTemplateManager } from './notification_template_manager';

await NotificationTemplateManager.initializeDefaultTemplates();
```

## API Endpoints

### Preference Management

#### Get User Preferences
```
GET /api/v1/notifications/preferences/:userId
```

Response:
```json
{
  "id": "pref-1",
  "userId": "user-123",
  "emailNotifications": true,
  "pushNotifications": true,
  "contributionReminders": true,
  "groupUpdates": true,
  "payoutNotifications": true,
  "emailFrequency": "immediate",
  "unsubscribeToken": "token-xxx",
  "createdAt": "2024-03-15T10:00:00Z"
}
```

#### Update User Preferences
```
PUT /api/v1/notifications/preferences/:userId
Content-Type: application/json

{
  "emailNotifications": false,
  "emailFrequency": "daily",
  "contributionReminders": true
}
```

#### Get Preference Statistics
```
GET /api/v1/notifications/preferences/stats
```

Response:
```json
{
  "total": 1000,
  "emailEnabled": 750,
  "pushEnabled": 600,
  "emailEnabledPercent": "75.00",
  "pushEnabledPercent": "60.00",
  "byFrequency": {
    "immediate": 400,
    "daily": 200,
    "weekly": 150,
    "never": 250
  }
}
```

### Device Token Management

#### Register Device Token
```
POST /api/v1/notifications/device-token
Content-Type: application/json

{
  "userId": "user-123",
  "deviceToken": "fcm-token-xxx",
  "platform": "iOS"
}
```

#### Unregister Device Token
```
DELETE /api/v1/notifications/device-token/:userId/:deviceToken
```

### Sending Notifications

#### Send Email Notification
```
POST /api/v1/notifications/send-email
Content-Type: application/json

{
  "userId": "user-123",
  "to": "user@example.com",
  "templateId": "email_contribution_reminder",
  "templateData": {
    "userName": "John Doe",
    "groupName": "Weekly Savings",
    "amount": "100",
    "dueDate": "2024-03-20",
    "daysRemaining": "3",
    "appUrl": "https://stellar-save.com",
    "groupId": "group-123",
    "unsubscribeUrl": "https://stellar-save.com/unsubscribe/token-xxx"
  }
}
```

#### Send Push Notification
```
POST /api/v1/notifications/send-push
Content-Type: application/json

{
  "userId": "user-123",
  "deviceToken": "fcm-token-xxx",
  "templateId": "push_contribution_reminder",
  "templateData": {
    "groupName": "Weekly Savings",
    "amount": "100",
    "daysRemaining": "3"
  },
  "title": "Contribution Reminder",
  "body": "Your contribution is due soon"
}
```

#### Queue Notification
```
POST /api/v1/notifications/queue
Content-Type: application/json

{
  "userId": "user-123",
  "templateKey": "email_contribution_reminder",
  "recipient": "user@example.com",
  "templateData": { ... },
  "notificationType": "email",
  "priority": 1,
  "scheduledFor": "2024-03-20T10:00:00Z"
}
```

#### Process Queued Notifications
```
POST /api/v1/notifications/process-queue
Content-Type: application/json

{
  "batchSize": 100
}
```

### Unsubscribe Management

#### One-Click Unsubscribe (for email links)
```
POST /api/v1/notifications/unsubscribe/:unsubscribeToken
```

This endpoint is meant to be called from email links and returns HTML confirmation page.

#### Re-subscribe User
```
POST /api/v1/notifications/resubscribe/:userId
```

### Notification History

#### Get User Notification History
```
GET /api/v1/notifications/history/:userId?limit=20
```

Response:
```json
{
  "userId": "user-123",
  "count": 20,
  "notifications": [
    {
      "id": "notif-1",
      "status": "sent",
      "notificationType": "email",
      "recipient": "user@example.com",
      "createdAt": "2024-03-15T10:00:00Z",
      "sentAt": "2024-03-15T10:05:00Z"
    }
  ]
}
```

#### Get Notification Statistics
```
GET /api/v1/notifications/stats
```

Response:
```json
{
  "timestamp": "2024-03-15T10:00:00Z",
  "stats": {
    "totalSent": 5000,
    "totalFailed": 25,
    "totalPending": 100,
    "byType": {
      "email": 3000,
      "push": 2000
    }
  }
}
```

### Template Management

#### Get All Active Templates
```
GET /api/v1/notifications/templates
```

#### Get Specific Template
```
GET /api/v1/notifications/templates/:templateKey
```

#### Create Custom Template
```
POST /api/v1/notifications/templates
Content-Type: application/json

{
  "templateKey": "custom_welcome",
  "templateName": "Welcome Email",
  "templateType": "email",
  "subject": "Welcome to {{appName}}",
  "htmlContent": "<h1>Hello {{userName}}</h1>",
  "textContent": "Hello {{userName}}",
  "placeholders": ["appName", "userName"]
}
```

#### Update Template
```
PUT /api/v1/notifications/templates/:templateKey
Content-Type: application/json

{
  "subject": "Updated Subject",
  "htmlContent": "<h1>Updated</h1>",
  "active": true
}
```

### Health & Monitoring

#### Check Service Health
```
GET /api/v1/notifications/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-03-15T10:00:00Z",
  "providers": {
    "email": true,
    "push": ["firebase", "onesignal"]
  }
}
```

## Usage Examples

### Example 1: Send Contribution Reminder

```typescript
import { notificationService } from './notification_service';
import { UserPreferenceManager } from './user_preference_manager';

async function sendContributionReminder(userId: string, groupId: string) {
  // Check if user wants reminders
  const shouldSend = await UserPreferenceManager.shouldSendNotification(
    userId,
    'email',
    'contribution_reminder'
  );

  if (!shouldSend) {
    console.log('User opted out of contribution reminders');
    return;
  }

  // Send email notification
  const messageId = await notificationService.sendEmail(
    userEmail,
    'email_contribution_reminder',
    {
      userId,
      userName: 'John Doe',
      groupName: 'Weekly Savings',
      amount: '100',
      dueDate: '2024-03-20',
      daysRemaining: '3',
      appUrl: 'https://stellar-save.com',
      groupId,
      unsubscribeUrl: `https://stellar-save.com/unsubscribe/${unsubscribeToken}`,
    },
    'Reminder: Contribution due for Weekly Savings'
  );

  console.log(`Email sent: ${messageId}`);
}
```

### Example 2: Queue Digest Emails

```typescript
import { notificationService } from './notification_service';

async function queueDailyDigests() {
  const userIds = await UserPreferenceManager.getUsersForDigest('daily');

  for (const userId of userIds) {
    await notificationService.queueNotification(
      userId,
      'email_daily_digest',
      userEmail,
      {
        userId,
        userName,
        events: pendingEvents,
      },
      'email',
      0,
      tomorrow9am // Schedule for tomorrow at 9 AM
    );
  }

  console.log(`Queued ${userIds.length} daily digests`);
}
```

### Example 3: Send Push Notification

```typescript
import { notificationService } from './notification_service';

async function notifyPayoutReady(userId: string, amount: string) {
  const deviceTokens = await UserPreferenceManager.getUserDeviceTokens(userId);

  for (const deviceToken of deviceTokens) {
    await notificationService.sendPushNotification(
      deviceToken,
      'push_payout_ready',
      {
        userId,
        groupName: 'Weekly Savings',
        amount,
      },
      '🎉 Your Payout is Ready!',
      `You have ${amount} XLM waiting`
    );
  }
}
```

### Example 4: Process Queue Every Minute

```typescript
import { notificationService } from './notification_service';

// Run every 60 seconds
setInterval(async () => {
  const processed = await notificationService.processQueuedNotifications(100);
  console.log(`Processed ${processed} notifications`);
}, 60000);
```

## Pre-built Templates

### Email Templates

1. **contribution_reminder** - Reminds users about upcoming contribution deadline
2. **contribution_confirmed** - Confirms a successful contribution
3. **payout_notification** - Notifies user their payout is ready
4. **group_update** - Generic group update notification

### Push Templates

1. **push_contribution_reminder** - Push version of contribution reminder
2. **push_payout_ready** - Push payout notification
3. **push_contribution_confirmed** - Confirms contribution via push
4. **push_member_joined** - Notifies about new group members

## Testing

Run the test suite:

```bash
npm test src/tests/notification_service.test.ts
```

Tests cover:
- Email notification sending
- Push notification sending
- User preference management
- Template management
- Notification queue processing
- History and statistics
- Error handling

## Integration with Events

The notification service can be integrated with Stellar-Save smart contract events:

```typescript
import { ContractEventIndexer } from './contract_event_indexer';
import { notificationService } from './notification_service';

// Listen to contribution events
contractEventIndexer.on('ContributionSubmitted', async (event) => {
  await notificationService.sendEmail(
    userEmail,
    'email_contribution_confirmed',
    {
      userId: event.userId,
      groupName: event.groupName,
      amount: event.amount,
      txHash: event.transactionHash,
      timestamp: new Date().toISOString(),
      membersRemaining: event.remainingMembers,
    },
    'Contribution Confirmed'
  );
});

contractEventIndexer.on('PayoutInitiated', async (event) => {
  await notificationService.queueNotification(
    event.recipientId,
    'email_payout_notification',
    recipientEmail,
    {
      groupName: event.groupName,
      amount: event.amount,
      cycleNumber: event.cycleNumber,
      payoutWallet: event.recipientWallet,
    },
    'email',
    1, // High priority
    new Date() // Send immediately
  );
});
```

## Configuration Best Practices

1. **Development**: Disable SendGrid/Firebase, check logs instead
2. **Testing**: Use mock providers
3. **Production**: 
   - Use environment variables for all sensitive data
   - Enable error tracking (e.g., Sentry)
   - Monitor queue processing
   - Set up email delivery tracking

## Troubleshooting

### SendGrid API Key Issues
- Verify API key is correct and not expired
- Check SendGrid sender authentication

### Firebase Credentials
- Ensure `FIREBASE_SERVICE_ACCOUNT` is valid JSON (minified)
- Check Firebase project permissions

### Email Delivery Issues
- Check spam folder for test emails
- Verify sender domain is authenticated
- Monitor SendGrid bounce/spam reports

### Push Notification Issues
- Verify device tokens are current
- Check platform-specific permissions
- Monitor provider API health

## Future Enhancements

1. Email subject line optimization
2. SMS notifications via Twilio
3. In-app notifications
4. Notification templates UI editor
5. A/B testing for notification content
6. Advanced analytics and reporting
7. Automated retry logic with exponential backoff
8. Batching and rate limiting
9. Multi-language support
10. Notification preferences UI in frontend

## References

- [SendGrid API Documentation](https://docs.sendgrid.com/api-reference)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [OneSignal Documentation](https://documentation.onesignal.com)
- [Notification Service Code](../src/notification_service.ts)
- [Push Notification Service Code](../src/push_notification_service.ts)
- [User Preference Manager Code](../src/user_preference_manager.ts)
- [Notification Template Manager Code](../src/notification_template_manager.ts)
- [API Routes Code](../src/routes/notifications.ts)
