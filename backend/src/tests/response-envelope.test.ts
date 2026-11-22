/**
 * Unit tests for the API response envelope helpers.
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyEnvelope,
  createEnvelope,
  createEnvelopeWithPagination,
  errorEnvelope,
  errorEnvelopeMulti,
  normalizeResponse,
  type ApiResponseEnvelope,
} from '../lib/response-envelope';
import {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UpstreamError,
  isAppError,
  mapError,
} from '../lib/errors';

describe('Response envelope helpers', () => {
  it('creates a success envelope with optional metadata', () => {
    const data = { id: 1, name: 'Test' };
    const meta = { timestamp: '2026-09-26T10:00:00Z', version: '1.0' };

    expect(createEnvelope(data)).toEqual({ data });
    expect(createEnvelope(data, meta)).toEqual({ data, meta });
    expect(createEnvelope(null)).toEqual({ data: null });
    expect(createEnvelope('hello').data).toBe('hello');
    expect(createEnvelope(42).data).toBe(42);
    expect(createEnvelope(true).data).toBe(true);
  });

  it('creates pagination metadata from the array and preserves supplied metadata', () => {
    const items = [{ id: 1 }, { id: 2 }];

    expect(createEnvelopeWithPagination(items)).toEqual({
      data: items,
      meta: { count: 2 },
    });
    expect(createEnvelopeWithPagination([], { count: 99, page: 1 }).meta).toEqual({
      count: 0,
      page: 1,
    });
  });

  it('creates a single error with optional details and null data', () => {
    expect(errorEnvelope('VALIDATION_ERROR', 'Invalid input')).toEqual({
      data: null,
      errors: [{ code: 'VALIDATION_ERROR', message: 'Invalid input' }],
    });
    expect(
      errorEnvelope('VALIDATION_ERROR', 'Invalid email', {
        field: 'email',
        reason: 'invalid format',
      }).errors?.[0].details,
    ).toEqual({ field: 'email', reason: 'invalid format' });
  });

  it('creates a multiple-error envelope', () => {
    const errors = [
      { code: 'FIELD_1', message: 'Field 1 is invalid' },
      {
        code: 'FIELD_2',
        message: 'Field 2 is invalid',
        details: { field: 'field2' },
      },
    ];

    expect(errorEnvelopeMulti(errors)).toEqual({ data: null, errors });
    expect(errorEnvelopeMulti([])).toEqual({ data: null, errors: [] });
  });

  it('creates an empty envelope with optional metadata', () => {
    expect(createEmptyEnvelope()).toEqual({ data: null });
    expect(createEmptyEnvelope({ action: 'deleted', itemId: '123' })).toEqual({
      data: null,
      meta: { action: 'deleted', itemId: '123' },
    });
  });

  it('normalizes envelopes, arrays, objects, primitives, null, and undefined', () => {
    const envelope: ApiResponseEnvelope = {
      data: { id: 1 },
      meta: { count: 1 },
    };
    const array = [{ id: 1 }, { id: 2 }];

    expect(normalizeResponse(envelope)).toEqual(envelope);
    expect(normalizeResponse(array)).toEqual({
      data: array,
      meta: { count: 2 },
    });
    expect(normalizeResponse({ id: 1 })).toEqual({ data: { id: 1 } });
    expect(normalizeResponse('hello')).toEqual({ data: 'hello' });
    expect(normalizeResponse(null)).toEqual({ data: null });
    expect(normalizeResponse(undefined)).toEqual({ data: undefined });

    const error = errorEnvelope('ERROR', 'Test error');
    expect(normalizeResponse(error)).toEqual(error);
  });
});
