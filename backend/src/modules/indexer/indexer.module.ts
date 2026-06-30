import { Module } from '@nestjs/common';
import { ContractEventIndexer } from '../../contract_event_indexer';

@Module({
  providers: [ContractEventIndexer],
  exports: [ContractEventIndexer],
})
export class IndexerModule {}
