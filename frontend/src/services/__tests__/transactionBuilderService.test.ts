/**
 * Tests for transactionBuilderService template helpers (issue #2047 — remove
 * console.log/warn and replace with logger).
 *
 * Verifies that saveTemplate, loadTemplates, and deleteTemplate work correctly
 * and that logger.warn is called (not console.warn) when localStorage throws.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Stellar SDK's SorobanRpc and rpcClient to avoid a live-network
// dependency during unit tests.
vi.mock('../../lib/rpcClient', () => ({
  rpcServer: { getAccount: vi.fn(), simulateTransaction: vi.fn() },
  createRpcServer: vi.fn(),
}));

import * as loggerModule from '../../lib/logger';
import {
  saveTemplate,
  loadTemplates,
  deleteTemplate,
  generateId,
} from '../transactionBuilderService';
import type { TransactionTemplate } from '../../types/transactionBuilder';

function makeTemplate(overrides: Partial<TransactionTemplate> = {}): TransactionTemplate {
  return {
    id: generateId(),
    name: 'Test Template',
    description: 'A test template',
    steps: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('transactionBuilderService — template CRUD', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and loads a template', () => {
    const tpl = makeTemplate({ name: 'My Template' });
    saveTemplate(tpl);
    const loaded = loadTemplates();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('My Template');
  });

  it('updates an existing template by id', () => {
    const tpl = makeTemplate({ name: 'Original' });
    saveTemplate(tpl);
    // The first save assigns a new id via generateId() — read it back
    const [saved] = loadTemplates();
    saveTemplate({ ...saved, name: 'Updated' });
    const loaded = loadTemplates();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Updated');
  });

  it('deletes a template by id', () => {
    const tpl = makeTemplate();
    saveTemplate(tpl);
    const [saved] = loadTemplates();
    expect(loadTemplates()).toHaveLength(1);
    deleteTemplate(saved.id);
    expect(loadTemplates()).toHaveLength(0);
  });

  it('returns an empty array when no templates are stored', () => {
    expect(loadTemplates()).toEqual([]);
  });

  it('calls logger.warn (not console.warn) when saveTemplate encounters a storage error', () => {
    const warnSpy = vi.spyOn(loggerModule.logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => saveTemplate(makeTemplate())).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('Failed to save template');

    warnSpy.mockRestore();
  });

  it('calls logger.warn (not console.warn) when deleteTemplate encounters a storage error', () => {
    const warnSpy = vi.spyOn(loggerModule.logger, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });

    expect(() => deleteTemplate('nonexistent-id')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith('Failed to delete template');

    warnSpy.mockRestore();
  });
});
