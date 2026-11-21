/**
 * CreateGroupForm validation schema
 *
 * Re-exports the canonical group creation schemas and helpers from
 * `../../schemas/groupSchema` so consumers of this sub-module can import
 * directly from `CreateGroupForm/schema` without reaching into the shared
 * schemas directory.
 *
 * The authoritative schema definition lives in `../../schemas/groupSchema.ts`.
 */
export {
  createGroupFormSchema,
  groupDataSchema,
  fieldValidators,
  validateFormStep,
  validateAndTransformFormData,
  VALIDATION_CONSTANTS,
} from '../../schemas/groupSchema';

export type { CreateGroupFormData, GroupData } from '../../schemas/groupSchema';
export type CreateGroupInput = import('../../schemas/groupSchema').GroupData;

