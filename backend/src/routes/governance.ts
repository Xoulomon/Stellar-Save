/**
 * Governance proposal endpoints (Issue #1013).
 *
 * GET  /api/v1/governance/proposals           – list all proposals
 * GET  /api/v1/governance/proposals/:id       – single proposal
 * POST /api/v1/governance/proposals           – create proposal (governors only)
 * POST /api/v1/governance/proposals/:id/vote  – cast a vote (governors only)
 *
 * Governor list is read from GOVERNOR_ADDRESSES env var (comma-separated).
 * In production this should be on-chain via the contract; for now it's an
 * env-based allow-list so the UI can be fully demoed.
 */

import { Router } from 'express';

export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed' | 'expired';

export interface Vote {
  voter: string;
  support: boolean;   // true = for, false = against
  votedAt: string;    // ISO-8601
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votes: Vote[];
  /** Unix ms timestamp — when voting closes */
  votingEndsAt: number;
  /** Only set when status === 'passed'. Unix ms when timelock expires. */
  timelockEndsAt?: number;
  createdAt: string;
  executedAt?: string;
}

// Seed proposals so the UI has something to render immediately
const SEED_NOW = Date.now();

const proposals = new Map<string, Proposal>([
  [
    'prop-001',
    {
      id: 'prop-001',
      title: 'Increase max group size to 30',
      description:
        'Raise the protocol-level MAX_MEMBERS constant from 20 to 30 to allow larger community circles.',
      proposer: 'GABC1234567890ABCDEF',
      status: 'active',
      votesFor: 3,
      votesAgainst: 1,
      votes: [],
      votingEndsAt: SEED_NOW + 2 * 24 * 60 * 60 * 1000, // 2 days from now
      createdAt: new Date(SEED_NOW - 12 * 60 * 60 * 1000).toISOString(),
    },
  ],
  [
    'prop-002',
    {
      id: 'prop-002',
      title: 'Lower minimum contribution to 0.05 XLM',
      description:
        'Reduce the minimum contribution floor so that low-income communities can participate.',
      proposer: 'GDEF0987654321FEDCBA',
      status: 'passed',
      votesFor: 5,
      votesAgainst: 2,
      votes: [],
      votingEndsAt: SEED_NOW - 24 * 60 * 60 * 1000,
      timelockEndsAt: SEED_NOW + 48 * 60 * 60 * 1000, // 48-hour timelock
      createdAt: new Date(SEED_NOW - 5 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
  [
    'prop-003',
    {
      id: 'prop-003',
      title: 'Enable insurance pool by default',
      description:
        'All new groups should opt-in to the insurance pool automatically. Group creators can still disable it.',
      proposer: 'GABC1234567890ABCDEF',
      status: 'executed',
      votesFor: 7,
      votesAgainst: 1,
      votes: [],
      votingEndsAt: SEED_NOW - 10 * 24 * 60 * 60 * 1000,
      createdAt: new Date(SEED_NOW - 15 * 24 * 60 * 60 * 1000).toISOString(),
      executedAt: new Date(SEED_NOW - 8 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ],
]);

function getGovernors(): Set<string> {
  const raw = process.env['GOVERNOR_ADDRESSES'] ?? '';
  const addrs = raw
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  // Seed addresses always count as governors for demo purposes
  addrs.push('GABC1234567890ABCDEF', 'GDEF0987654321FEDCBA');
  return new Set(addrs);
}

function isGovernor(address: string): boolean {
  return getGovernors().has(address);
}

export function createGovernanceRouter(): Router {
  const router = Router();

  // GET /api/v1/governance/proposals
  router.get('/proposals', (_req, res) => {
    const list = Array.from(proposals.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    res.json({ proposals: list, total: list.length });
  });

  // GET /api/v1/governance/proposals/:id
  router.get('/proposals/:id', (req, res) => {
    const proposal = proposals.get(req.params['id'] as string);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
    res.json(proposal);
  });

  // GET /api/v1/governance/governors
  router.get('/governors', (_req, res) => {
    res.json({ governors: Array.from(getGovernors()) });
  });

  // POST /api/v1/governance/proposals  — create (governor only)
  router.post('/proposals', (req, res) => {
    const { title, description, proposer } = req.body as {
      title?: string;
      description?: string;
      proposer?: string;
    };

    if (!title || !description || !proposer) {
      return res.status(400).json({ error: 'title, description, and proposer are required.' });
    }
    if (!isGovernor(proposer)) {
      return res.status(403).json({ error: 'Only governors may create proposals.' });
    }

    const id = `prop-${Date.now()}`;
    const proposal: Proposal = {
      id,
      title,
      description,
      proposer,
      status: 'active',
      votesFor: 0,
      votesAgainst: 0,
      votes: [],
      votingEndsAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7-day voting window
      createdAt: new Date().toISOString(),
    };

    proposals.set(id, proposal);
    res.status(201).json(proposal);
  });

  // POST /api/v1/governance/proposals/:id/vote  — vote (governor only)
  router.post('/proposals/:id/vote', (req, res) => {
    const proposal = proposals.get(req.params['id'] as string);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const { voter, support } = req.body as { voter?: string; support?: boolean };

    if (!voter || typeof support !== 'boolean') {
      return res.status(400).json({ error: 'voter and support (boolean) are required.' });
    }
    if (!isGovernor(voter)) {
      return res.status(403).json({ error: 'Only governors may vote.' });
    }
    if (proposal.status !== 'active') {
      return res.status(400).json({ error: `Voting is closed (status: ${proposal.status}).` });
    }
    if (Date.now() > proposal.votingEndsAt) {
      // Auto-expire
      proposal.status = 'expired';
      proposals.set(proposal.id, proposal);
      return res.status(400).json({ error: 'Voting period has ended.' });
    }
    if (proposal.votes.some((v) => v.voter === voter)) {
      return res.status(409).json({ error: 'You have already voted on this proposal.' });
    }

    proposal.votes.push({ voter, support, votedAt: new Date().toISOString() });
    if (support) proposal.votesFor += 1;
    else proposal.votesAgainst += 1;

    // Simple majority: if for > against and at least 3 votes → passed
    if (proposal.votesFor > proposal.votesAgainst && proposal.votes.length >= 3) {
      proposal.status = 'passed';
      proposal.timelockEndsAt = Date.now() + 48 * 60 * 60 * 1000; // 48-hour timelock
    }

    proposals.set(proposal.id, proposal);
    res.json(proposal);
  });

  return router;
}
