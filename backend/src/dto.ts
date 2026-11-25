import { z } from 'zod';

/** Serialization layer mapping internal DB models to API-facing response shapes. */

/**
 * Single source of truth for the `ContractEvent` response shape.
 *
 * The schema is the canonical definition; the TypeScript type is derived from
 * it so validation and typing can never drift apart. Any new field must be
 * added here (and only here) to be exposed by the API.
 */
export const contractEventSchema = {
  contractId: 'string',
  eventType: 'string',
  topics: 'unknown',
  data: 'unknown',
  txHash: 'string',
  ledgerSeq: 'number',
  timestamp: 'string',
} as const;

type SchemaFieldType<T> = T extends 'string'
  ? string
  : T extends 'number'
    ? number
    : T extends 'unknown'
      ? unknown
      : never;

type InferSchema<S extends Record<string, string>> = {
  [K in keyof S]: SchemaFieldType<S[K]>;
};

export type ContractEventDTO = InferSchema<typeof contractEventSchema>;

const schemaValidators = {
  string: z.string(),
  number: z.number(),
  unknown: z.custom<unknown>((value) => value !== undefined),
} as const;

const contractEventShape = Object.fromEntries(
  Object.entries(contractEventSchema).map(([field, type]) => [field, schemaValidators[type]])
) as z.ZodRawShape;

const contractEventRecordSchema = z.object({
  ...contractEventShape,
  timestamp: z.date(),
}) as unknown as z.ZodType<Omit<ContractEventDTO, 'timestamp'> & { timestamp: Date }>;

/**
 * Maps a raw `ContractEvent` DB row to its public response shape, omitting
 * internal-only fields (`id`, `createdAt`, `blockTime`) that consumers don't need.
 */
export function toContractEventDTO(event: unknown): ContractEventDTO {
  const record = contractEventRecordSchema.parse(event);

  return {
    ...record,
    timestamp: record.timestamp.toISOString(),
  };
}
