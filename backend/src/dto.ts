/** Serialization layer mapping internal DB models to API-facing response shapes. */

export interface ContractEventDTO {
  contractId: string;
  eventType: string;
  topics: unknown;
  data: unknown;
  txHash: string;
  ledgerSeq: number;
  timestamp: string;
}

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
