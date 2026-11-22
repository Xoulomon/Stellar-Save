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

/**
 * Maps a raw `ContractEvent` DB row to its public response shape, omitting
 * internal-only fields (`id`, `createdAt`, `blockTime`) that consumers don't need.
 */
export function toContractEventDTO(event: {
  contractId: string;
  eventType: string;
  topics: unknown;
  data: unknown;
  txHash: string;
  ledgerSeq: number;
  timestamp: Date;
}): ContractEventDTO {
  return {
    contractId: event.contractId,
    eventType: event.eventType,
    topics: event.topics,
    data: event.data,
    txHash: event.txHash,
    ledgerSeq: event.ledgerSeq,
    timestamp: event.timestamp.toISOString(),
  };
}
