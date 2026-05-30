import { Client } from '@elastic/elasticsearch';
import { Group, Member, Transaction } from './models';
import dotenv from 'dotenv';

dotenv.config();

export class SearchService {
  private client: Client;
  private isConnected: boolean = false;

  constructor() {
    const node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
    this.client = new Client({
      node,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME || 'elastic',
        password: process.env.ELASTICSEARCH_PASSWORD || 'changeme'
      }
    });
  }

  async init() {
    try {
      await this.client.ping();
      this.isConnected = true;
      console.log('Connected to Elasticsearch');
      await this.createIndices();
    } catch (error) {
      console.error('Elasticsearch connection failed:', error);
      this.isConnected = false;
    }
  }

  private async createIndices() {
    const indices = ['groups', 'members', 'transactions'];
    for (const index of indices) {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({
          index,
          body: {
            settings: {
              analysis: {
                analyzer: {
                  autocomplete_analyzer: {
                    type: 'custom',
                    tokenizer: 'ngram_tokenizer',
                    filter: ['lowercase']
                  }
                },
                tokenizer: {
                  ngram_tokenizer: {
                    type: 'edge_ngram',
                    min_gram: 2,
                    max_gram: 10,
                    token_chars: ['letter', 'digit']
                  }
                }
              }
            },
            mappings: {
              properties: {
                name: { type: 'text', analyzer: 'autocomplete_analyzer', search_analyzer: 'standard' },
                tags: { type: 'keyword' },
                description: { type: 'text' },
                status: { type: 'keyword' }
              }
            }
          }
        });
      }
    }
  }

  async indexGroup(group: Group) {
    if (!this.isConnected) return;
    await this.client.index({
      index: 'groups',
      id: group.id,
      body: group
    });
  }

  async indexMember(member: Member) {
    if (!this.isConnected) return;
    await this.client.index({
      index: 'members',
      id: member.id,
      body: member
    });
  }

  async indexTransaction(tx: Transaction) {
    if (!this.isConnected) return;
    await this.client.index({
      index: 'transactions',
      id: tx.id,
      body: tx
    });
  }

  async searchGroups(query: string) {
    if (!this.isConnected) return [];
    const result = await this.client.search({
      index: 'groups',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['name^3', 'tags^2', 'status']
          }
        }
      }
    });
    return result.hits.hits.map(hit => hit._source);
  }

  async autocomplete(query: string) {
    if (!this.isConnected) return [];
    const result = await this.client.search({
      index: ['groups', 'members'],
      body: {
        query: {
          match: {
            name: {
              query,
              analyzer: 'standard'
            }
          }
        }
      }
    });
    return result.hits.hits.map(hit => ({
      id: hit._id,
      index: hit._index,
      source: hit._source
    }));
  }

  async globalSearch(query: string) {
    if (!this.isConnected) return { groups: [], members: [], transactions: [] };
    
    const [groups, members, transactions] = await Promise.all([
      this.searchGroups(query),
      this.searchMembers(query),
      this.searchTransactions(query)
    ]);

    return { groups, members, transactions };
  }

  private async searchMembers(query: string) {
    const result = await this.client.search({
      index: 'members',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['name^2', 'address']
          }
        }
      }
    });
    return result.hits.hits.map(hit => hit._source);
  }

  private async searchTransactions(query: string) {
    const result = await this.client.search({
      index: 'transactions',
      body: {
        query: {
          multi_match: {
            query,
            fields: ['stellarTxHash', 'memberAddress', 'type']
          }
        }
      }
    });
    return result.hits.hits.map(hit => hit._source);
  }
}
