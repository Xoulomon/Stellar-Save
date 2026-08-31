import { z } from 'zod';

export const groupInvitationSchema = z.object({
  groupId: z.string().min(1, 'groupId is required'),
  email: z.string().email('Invalid email format'),
});

export const kycSubmitSchema = z.object({
  firstName: z.string().min(1, 'firstName is required'),
  lastName: z.string().min(1, 'lastName is required'),
  email: z.string().email('Invalid email format'),
  countryCode: z.string().length(2, 'countryCode must be 2 characters'),
});

export const notificationPreferencesSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
});

export const deviceTokenSchema = z.object({
  token: z.string().min(1, 'token is required'),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().min(1, 'deviceId is required').optional(),
});

export const rampDepositSchema = z.object({
  amount: z.number().positive('amount must be positive'),
  currency: z.string().min(1, 'currency is required'),
  paymentMethod: z.string().min(1, 'paymentMethod is required'),
});

export const rampWithdrawSchema = z.object({
  amount: z.number().positive('amount must be positive'),
  currency: z.string().min(1, 'currency is required'),
  bankAccount: z.object({
    accountNumber: z.string().min(1, 'accountNumber is required'),
    routingNumber: z.string().min(1, 'routingNumber is required'),
    bankName: z.string().min(1, 'bankName is required'),
  }).optional(),
});

export const proposalSchema = z.object({
  title: z.string().min(1, 'title is required').max(255, 'title is too long'),
  description: z.string().min(1, 'description is required'),
  proposalType: z.enum(['parameter-change', 'contract-upgrade', 'fee-change']),
  targetValue: z.string().optional(),
});

export const voteSchema = z.object({
  proposalId: z.string().min(1, 'proposalId is required'),
  vote: z.enum(['yes', 'no', 'abstain']),
  reasoning: z.string().optional(),
});

export const insuranceClaimSchema = z.object({
  claimType: z.enum(['theft', 'loss', 'damage', 'fraud']),
  amount: z.number().positive('amount must be positive'),
  description: z.string().min(10, 'description must be at least 10 characters'),
  evidenceUrls: z.array(z.string().url('Invalid URL')).optional(),
});

export const userPreferencesSchema = z.object({
  walletAddress: z.string().min(1, 'walletAddress is required'),
  language: z.string().length(2).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  marketingEmails: z.boolean().optional(),
});

export const apiKeySchema = z.object({
  name: z.string().min(1, 'name is required'),
  permissions: z.array(z.string()).min(1, 'at least one permission is required'),
  expiresAt: z.string().datetime().optional(),
});

export const webhookSchema = z.object({
  url: z.string().url('Invalid URL'),
  events: z.array(z.string()).min(1, 'at least one event is required'),
  secret: z.string().min(16, 'secret must be at least 16 characters').optional(),
});

export const complianceScreenSchema = z.object({
  address: z.string().min(1, 'address is required'),
  screeningType: z.enum(['aml', 'kyc', 'sanctions']).optional(),
});

export const sepTransferSchema = z.object({
  destinationAccount: z.string().min(1, 'destinationAccount is required'),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/, 'Invalid amount format'),
  assetCode: z.string().min(1, 'assetCode is required'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'currentPassword is required'),
  newPassword: z.string().min(8, 'newPassword must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'confirmPassword must be at least 8 characters'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const dataExportSchema = z.object({
  format: z.enum(['json', 'csv']).optional(),
  includePrivateKeys: z.boolean().optional(),
});
