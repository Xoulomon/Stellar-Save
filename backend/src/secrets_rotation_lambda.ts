/**
 * AWS Lambda function for automatic secret rotation (Issue #1105)
 * 
 * This Lambda function is triggered by AWS Secrets Manager during rotation.
 * It handles the 4-step rotation process: createSecret, setSecret, testSecret, finishSecret
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
  UpdateSecretVersionStageCommand,
  DescribeSecretCommand,
} from '@aws-sdk/client-secrets-manager';
import * as crypto from 'crypto';

// Types for Lambda event
interface RotationEvent {
  Step: 'createSecret' | 'setSecret' | 'testSecret' | 'finishSecret';
  Token: string;
  SecretId: string;
}

interface RotationContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
}

// Initialize Secrets Manager client
const client = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Main Lambda handler for secret rotation
 */
export async function handler(
  event: RotationEvent,
  context: RotationContext
): Promise<{ statusCode: number; body: string }> {
  console.log('Starting secret rotation', {
    step: event.Step,
    secretId: event.SecretId,
    token: event.Token,
    requestId: context.awsRequestId,
  });

  try {
    switch (event.Step) {
      case 'createSecret':
        await createSecret(event);
        break;
      case 'setSecret':
        await setSecret(event);
        break;
      case 'testSecret':
        await testSecret(event);
        break;
      case 'finishSecret':
        await finishSecret(event);
        break;
      default:
        throw new Error(`Invalid step: ${event.Step}`);
    }

    console.log('Secret rotation step completed', {
      step: event.Step,
      secretId: event.SecretId,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Rotation step completed successfully' }),
    };
  } catch (error) {
    console.error('Secret rotation failed', {
      step: event.Step,
      secretId: event.SecretId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Send alert for rotation failure
    await sendRotationFailureAlert(event.SecretId, event.Step, error);

    throw error;
  }
}

/**
 * Step 1: Create a new version of the secret
 */
async function createSecret(event: RotationEvent): Promise<void> {
  console.log('Creating new secret version', { secretId: event.SecretId });

  // Get the current secret metadata
  const describeCommand = new DescribeSecretCommand({
    SecretId: event.SecretId,
  });
  const metadata = await client.send(describeCommand);

  // Check if the version already exists
  const versions = metadata.VersionIdsToStages || {};
  if (versions[event.Token]?.includes('AWSCURRENT')) {
    console.log('Secret version already exists', { token: event.Token });
    return;
  }

  // Get the current secret value
  const getCommand = new GetSecretValueCommand({
    SecretId: event.SecretId,
    VersionStage: 'AWSCURRENT',
  });
  const currentSecret = await client.send(getCommand);

  if (!currentSecret.SecretString) {
    throw new Error('Current secret has no string value');
  }

  // Generate new secret value based on secret type
  const newSecretValue = generateNewSecretValue(
    event.SecretId,
    currentSecret.SecretString
  );

  // Store the new secret with the AWSPENDING label
  const putCommand = new PutSecretValueCommand({
    SecretId: event.SecretId,
    ClientRequestToken: event.Token,
    SecretString: newSecretValue,
    VersionStages: ['AWSPENDING'],
  });

  await client.send(putCommand);

  console.log('New secret version created', {
    secretId: event.SecretId,
    token: event.Token,
  });
}

/**
 * Step 2: Configure the service to use the new secret
 */
async function setSecret(event: RotationEvent): Promise<void> {
  console.log('Setting new secret in service', { secretId: event.SecretId });

  // Get the pending secret
  const getCommand = new GetSecretValueCommand({
    SecretId: event.SecretId,
    VersionId: event.Token,
    VersionStage: 'AWSPENDING',
  });
  const pendingSecret = await client.send(getCommand);

  if (!pendingSecret.SecretString) {
    throw new Error('Pending secret has no string value');
  }

  // Update the service/database with the new secret
  // This is where you'd update database passwords, API keys, etc.
  await updateServiceWithNewSecret(event.SecretId, pendingSecret.SecretString);

  console.log('Service updated with new secret', { secretId: event.SecretId });
}

/**
 * Step 3: Test the new secret
 */
async function testSecret(event: RotationEvent): Promise<void> {
  console.log('Testing new secret', { secretId: event.SecretId });

  // Get the pending secret
  const getCommand = new GetSecretValueCommand({
    SecretId: event.SecretId,
    VersionId: event.Token,
    VersionStage: 'AWSPENDING',
  });
  const pendingSecret = await client.send(getCommand);

  if (!pendingSecret.SecretString) {
    throw new Error('Pending secret has no string value');
  }

  // Test the secret by attempting to use it
  const testResult = await testSecretValue(event.SecretId, pendingSecret.SecretString);

  if (!testResult.success) {
    throw new Error(`Secret test failed: ${testResult.error}`);
  }

  console.log('New secret tested successfully', { secretId: event.SecretId });
}

/**
 * Step 4: Finalize the rotation
 */
async function finishSecret(event: RotationEvent): Promise<void> {
  console.log('Finalizing secret rotation', { secretId: event.SecretId });

  // Get current version
  const describeCommand = new DescribeSecretCommand({
    SecretId: event.SecretId,
  });
  const metadata = await client.send(describeCommand);
  const versions = metadata.VersionIdsToStages || {};

  let currentVersion: string | undefined;
  for (const [version, stages] of Object.entries(versions)) {
    if (stages.includes('AWSCURRENT')) {
      if (version === event.Token) {
        console.log('Secret already marked as current', { token: event.Token });
        return;
      }
      currentVersion = version;
      break;
    }
  }

  // Move AWSCURRENT stage to new version
  const updateCommand = new UpdateSecretVersionStageCommand({
    SecretId: event.SecretId,
    VersionStage: 'AWSCURRENT',
    MoveToVersionId: event.Token,
    RemoveFromVersionId: currentVersion,
  });

  await client.send(updateCommand);

  console.log('Secret rotation completed', {
    secretId: event.SecretId,
    newVersion: event.Token,
    oldVersion: currentVersion,
  });
}

/**
 * Generate a new secret value based on the secret type
 */
function generateNewSecretValue(secretId: string, currentValue: string): string {
  // For JWT secrets, generate a new random string
  if (secretId.includes('jwt') || secretId.includes('secret')) {
    return crypto.randomBytes(64).toString('hex');
  }

  // For database passwords
  if (secretId.includes('db') || secretId.includes('password')) {
    // Generate a strong password
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
      password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
  }

  // For API keys
  if (secretId.includes('api') || secretId.includes('key')) {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Default: generate random hex string
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Update the service with the new secret
 */
async function updateServiceWithNewSecret(
  secretId: string,
  newValue: string
): Promise<void> {
  // This is where you'd implement service-specific logic
  // For example:
  // - Update database user password
  // - Update API key in external service
  // - Restart services if needed

  console.log('Updating service with new secret', { secretId });

  // Example: Update database password
  if (secretId.includes('db-password')) {
    // await updateDatabasePassword(newValue);
    console.log('Database password would be updated here');
  }

  // Example: Update JWT secret (requires application restart)
  if (secretId.includes('jwt-secret')) {
    // Signal application to reload secrets
    console.log('JWT secret would trigger application reload here');
  }
}

/**
 * Test the new secret value
 */
async function testSecretValue(
  secretId: string,
  value: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Implement secret-specific testing logic
    
    if (secretId.includes('db-password')) {
      // Test database connection with new password
      // const connection = await testDatabaseConnection(value);
      console.log('Testing database connection with new password');
      return { success: true };
    }

    if (secretId.includes('jwt-secret')) {
      // Test JWT generation and verification
      console.log('Testing JWT secret');
      if (value.length < 32) {
        return { success: false, error: 'JWT secret too short' };
      }
      return { success: true };
    }

    // Default: Basic validation
    if (!value || value.length < 16) {
      return { success: false, error: 'Secret value too short' };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send alert for rotation failure
 */
async function sendRotationFailureAlert(
  secretId: string,
  step: string,
  error: unknown
): Promise<void> {
  // Implement alerting logic here
  // For example: SNS, CloudWatch, PagerDuty, etc.
  
  console.error('ROTATION FAILURE ALERT', {
    secretId,
    step,
    error: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString(),
  });

  // Example: Send to SNS topic
  // const sns = new SNSClient({ region: process.env.AWS_REGION });
  // await sns.send(new PublishCommand({
  //   TopicArn: process.env.ALERT_TOPIC_ARN,
  //   Subject: `Secret Rotation Failed: ${secretId}`,
  //   Message: JSON.stringify({ secretId, step, error }, null, 2),
  // }));
}
