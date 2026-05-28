import { z } from 'zod';

/**
 * Zod validation schema for group creation
 * Ensures all group parameters meet on-chain and UI requirements
 */

// Stroops per XLM (Stellar base unit)
const STROOPS_PER_XLM = 10_000_000;

// Reasonable limits for the UI (not contract limits)
const GROUP_NAME_MIN = 3;
const GROUP_NAME_MAX = 50;
const GROUP_DESCRIPTION_MAX = 500;

// Contribution amount limits (in XLM)
const MIN_CONTRIBUTION_XLM = 0.1; // 0.1 XLM
const MAX_CONTRIBUTION_XLM = 1_000_000; // 1M XLM

// Member count constraints (must match contract minimums)
const MIN_MEMBERS = 2;
const MAX_MEMBERS_LIMIT = 100;

// Cycle duration options (in seconds)
const VALID_CYCLE_DURATIONS = [604800, 1209600, 2592000]; // 1 week, 2 weeks, 1 month

/**
 * Raw form data as entered by user
 */
export const createGroupFormSchema = z.object({
  name: z
    .string()
    .min(GROUP_NAME_MIN, `Group name must be at least ${GROUP_NAME_MIN} characters`)
    .max(GROUP_NAME_MAX, `Group name must be no more than ${GROUP_NAME_MAX} characters`)
    .trim(),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(GROUP_DESCRIPTION_MAX, `Description must be no more than ${GROUP_DESCRIPTION_MAX} characters`)
    .trim(),

  imageUrl: z
    .string()
    .url('Image URL must be a valid URL')
    .optional()
    .or(z.literal('')),

  contributionAmount: z
    .string()
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      'Contribution amount must be a positive number',
    )
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num >= MIN_CONTRIBUTION_XLM;
      },
      `Contribution amount must be at least ${MIN_CONTRIBUTION_XLM} XLM`,
    )
    .refine(
      (val) => {
        const num = parseFloat(val);
        return num <= MAX_CONTRIBUTION_XLM;
      },
      `Contribution amount must not exceed ${MAX_CONTRIBUTION_XLM} XLM`,
    ),

  cycleDuration: z
    .string()
    .refine(
      (val) => VALID_CYCLE_DURATIONS.includes(parseInt(val, 10)),
      'Please select a valid cycle duration',
    ),

  maxMembers: z
    .string()
    .refine(
      (val) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num >= MIN_MEMBERS && num <= MAX_MEMBERS_LIMIT;
      },
      `Maximum members must be between ${MIN_MEMBERS} and ${MAX_MEMBERS_LIMIT}`,
    ),

  minMembers: z
    .string()
    .refine(
      (val) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num >= MIN_MEMBERS;
      },
      `Minimum members must be at least ${MIN_MEMBERS}`,
    ),
});

/**
 * Processed data ready for contract submission
 * All amounts converted to stroops, durations validated
 */
export const groupDataSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  image_url: z.string().default(''),
  contribution_amount: z
    .number()
    .int()
    .positive('Contribution amount must be positive')
    .refine(
      (val) => val <= MAX_CONTRIBUTION_XLM * STROOPS_PER_XLM,
      'Contribution amount too large',
    ),
  cycle_duration: z
    .number()
    .refine(
      (val) => VALID_CYCLE_DURATIONS.includes(val),
      'Invalid cycle duration',
    ),
  max_members: z
    .number()
    .int()
    .min(MIN_MEMBERS, `Maximum members must be at least ${MIN_MEMBERS}`)
    .max(MAX_MEMBERS_LIMIT, `Maximum members must not exceed ${MAX_MEMBERS_LIMIT}`),
  min_members: z
    .number()
    .int()
    .min(MIN_MEMBERS, `Minimum members must be at least ${MIN_MEMBERS}`)
    .default(MIN_MEMBERS),
});

export type CreateGroupFormData = z.infer<typeof createGroupFormSchema>;
export type GroupData = z.infer<typeof groupDataSchema>;

/**
 * Validation helpers for individual fields
 */
export const fieldValidators = {
  name: (value: string) => {
    try {
      z.string()
        .min(GROUP_NAME_MIN)
        .max(GROUP_NAME_MAX)
        .parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },

  description: (value: string) => {
    try {
      z.string()
        .min(1)
        .max(GROUP_DESCRIPTION_MAX)
        .parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },

  contributionAmount: (value: string) => {
    try {
      createGroupFormSchema.shape.contributionAmount.parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },

  cycleDuration: (value: string) => {
    try {
      createGroupFormSchema.shape.cycleDuration.parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },

  maxMembers: (value: string) => {
    try {
      createGroupFormSchema.shape.maxMembers.parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },

  minMembers: (value: string) => {
    try {
      createGroupFormSchema.shape.minMembers.parse(value);
      return null;
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message ?? null;
      }
      return null;
    }
  },
};

/**
 * Validate a complete form step
 */
export function validateFormStep(
  step: number,
  data: Record<string, string> | Partial<Record<string, string>>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  try {
    const schema = createGroupFormSchema;

    if (step === 1) {
      schema.shape.name.parse(data.name || '');
      schema.shape.description.parse(data.description || '');
      if (data.imageUrl) {
        schema.shape.imageUrl.parse(data.imageUrl);
      }
    } else if (step === 2) {
      schema.shape.contributionAmount.parse(data.contributionAmount || '');
      schema.shape.cycleDuration.parse(data.cycleDuration || '');
    } else if (step === 3) {
      schema.shape.maxMembers.parse(data.maxMembers || '');
      schema.shape.minMembers.parse(data.minMembers || '');

      // Additional cross-field validation
      if (data.maxMembers && data.minMembers) {
        const maxNum = parseInt(data.maxMembers, 10);
        const minNum = parseInt(data.minMembers, 10);
        if (!isNaN(maxNum) && !isNaN(minNum) && maxNum < minNum) {
          errors.maxMembers = 'Maximum members must be >= minimum members';
        }
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      for (const err of error.issues) {
        const field = err.path[0] as string;
        if (field) {
          errors[field] = err.message;
        }
      }
    }
  }

  return errors;
}

/**
 * Validate and convert form data to contract-ready format
 */
export function validateAndTransformFormData(
  formData: Record<string, string>,
): { success: false; errors: Record<string, string> } | { success: true; data: GroupData } {
  try {
    // First validate raw form data
    const validated = createGroupFormSchema.parse(formData);

    // Then transform to GroupData format
    const contribution = Math.round(parseFloat(validated.contributionAmount) * STROOPS_PER_XLM);

    const groupData: GroupData = {
      name: validated.name,
      description: validated.description,
      image_url: validated.imageUrl || '',
      contribution_amount: contribution,
      cycle_duration: parseInt(validated.cycleDuration, 10),
      max_members: parseInt(validated.maxMembers, 10),
      min_members: parseInt(validated.minMembers, 10),
    };

    // Validate final format
    groupDataSchema.parse(groupData);

    return { success: true, data: groupData };
  } catch (error) {
    const errors: Record<string, string> = {};
    if (error instanceof z.ZodError) {
      for (const err of error.issues) {
        const field = err.path[0] as string;
        if (field) {
          errors[field] = err.message;
        }
      }
    }
    return { success: false, errors };
  }
}

/**
 * Export validation constants for tests and UI hints
 */
export const VALIDATION_CONSTANTS = {
  GROUP_NAME_MIN,
  GROUP_NAME_MAX,
  GROUP_DESCRIPTION_MAX,
  MIN_CONTRIBUTION_XLM,
  MAX_CONTRIBUTION_XLM,
  MIN_MEMBERS,
  MAX_MEMBERS_LIMIT,
  VALID_CYCLE_DURATIONS,
  STROOPS_PER_XLM,
};
