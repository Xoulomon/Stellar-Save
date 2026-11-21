/**
 * Unit tests for the centralized pagination utility.
 *
 * Tests cover:
 * - Parameter parsing and validation
 * - Offset/limit pagination
 * - Cursor-based pagination
 * - In-memory array pagination
 * - Edge cases (empty, out-of-range, boundary values)
 * - Input validation and clamping
 */
/* eslint-disable @typescript-eslint/no-require-imports */

describe('Pagination Utility Tests', () => {
  const {
    parseOffsetParams,
    parseCursorParams,
    paginate,
    paginateCursor,
    paginateArray,
    paginateCursorArray,
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    MIN_OFFSET,
  } = require('../lib/pagination');

  describe('parseOffsetParams', () => {
    it('should parse valid limit and offset', () => {
      const result = parseOffsetParams({ limit: '20', offset: '40' });
      expect(result).toEqual({ limit: 20, offset: 40 });
    });

    it('should use defaults when parameters are missing', () => {
      const result = parseOffsetParams({});
      expect(result).toEqual({ limit: DEFAULT_PAGE_SIZE, offset: MIN_OFFSET });
    });

    it('should clamp limit to MAX_PAGE_SIZE', () => {
      const result = parseOffsetParams({ limit: '500', offset: '0' });
      expect(result.limit).toBe(MAX_PAGE_SIZE);
    });

    it('should clamp limit to minimum of 1', () => {
      const result = parseOffsetParams({ limit: '0', offset: '0' });
      expect(result.limit).toBe(1);
    });

    it('should clamp negative limit to 1', () => {
      const result = parseOffsetParams({ limit: '-5', offset: '0' });
      expect(result.limit).toBe(1);
    });

    it('should clamp offset to minimum of 0', () => {
      const result = parseOffsetParams({ limit: '20', offset: '-10' });
      expect(result.offset).toBe(MIN_OFFSET);
    });

    it('should handle non-numeric limit (fallback to default)', () => {
      const result = parseOffsetParams({ limit: 'invalid', offset: '0' });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should handle non-numeric offset (fallback to default)', () => {
      const result = parseOffsetParams({ limit: '20', offset: 'invalid' });
      expect(result.offset).toBe(MIN_OFFSET);
    });

    it('should handle float values (floor to integer)', () => {
      const result = parseOffsetParams({ limit: '20.7', offset: '10.3' });
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(10);
    });

    it('should respect custom defaults', () => {
      const result = parseOffsetParams({}, { limit: 50, offset: 100 });
      expect(result).toEqual({ limit: 50, offset: 100 });
    });

    it('should override custom defaults with provided values', () => {
      const result = parseOffsetParams({ limit: '30', offset: '40' }, { limit: 50, offset: 100 });
      expect(result).toEqual({ limit: 30, offset: 40 });
    });
  });

  describe('parseCursorParams', () => {
    it('should parse valid cursor and limit', () => {
      const result = parseCursorParams({ cursor: 'abc123', limit: '20' });
      expect(result).toEqual({ cursor: 'abc123', limit: 20 });
    });

    it('should use defaults when parameters are missing', () => {
      const result = parseCursorParams({});
      expect(result).toEqual({ cursor: '0', limit: DEFAULT_PAGE_SIZE });
    });

    it('should clamp limit to MAX_PAGE_SIZE', () => {
      const result = parseCursorParams({ cursor: '0', limit: '500' });
      expect(result.limit).toBe(MAX_PAGE_SIZE);
    });

    it('should clamp limit to minimum of 1', () => {
      const result = parseCursorParams({ cursor: '0', limit: '0' });
      expect(result.limit).toBe(1);
    });

    it('should handle empty cursor (use default)', () => {
      const result = parseCursorParams({ cursor: '', limit: '20' });
      expect(result.cursor).toBe('0');
    });

    it('should handle non-numeric limit (fallback to default)', () => {
      const result = parseCursorParams({ cursor: '0', limit: 'invalid' });
      expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
    });

    it('should accept any non-empty string as cursor', () => {
      const result = parseCursorParams({ cursor: 'eyJpZCI6IDEyMzQ1fQ==', limit: '20' });
      expect(result.cursor).toBe('eyJpZCI6IDEyMzQ1fQ==');
    });

    it('should respect custom defaults', () => {
      const result = parseCursorParams({}, { cursor: 'default', limit: 50 });
      expect(result).toEqual({ cursor: 'default', limit: 50 });
    });
  });

  describe('paginate - offset pagination result builder', () => {
    it('should build result with correct structure', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const params = { limit: 20, offset: 0 };
      const result = paginate(data, 10, params);

      expect(result).toHaveProperty('data', data);
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 10,
        hasMore: false,
      });
    });

    it('should set hasMore=true when there are more items', () => {
      const data = Array(20).fill({ id: 1 });
      const params = { limit: 20, offset: 0 };
      const result = paginate(data, 100, params);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should set hasMore=false on last page', () => {
      const data = Array(10).fill({ id: 1 });
      const params = { limit: 20, offset: 80 };
      const result = paginate(data, 90, params);

      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle empty data', () => {
      const result = paginate([], 0, { limit: 20, offset: 0 });

      expect(result.data).toEqual([]);
      expect(result.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 0,
        hasMore: false,
      });
    });

    it('should handle negative total (convert to 0)', () => {
      const result = paginate([], -5, { limit: 20, offset: 0 });

      expect(result.pagination.total).toBe(0);
    });

    it('should set hasMore=true when offset + data.length < total', () => {
      const data = Array(15).fill({ id: 1 });
      const params = { limit: 20, offset: 0 };
      const result = paginate(data, 100, params);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should set hasMore=false when offset + data.length >= total', () => {
      const data = Array(10).fill({ id: 1 });
      const params = { limit: 20, offset: 90 };
      const result = paginate(data, 100, params);

      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('paginateCursor - cursor pagination result builder', () => {
    it('should build result with correct structure', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const params = { cursor: '0', limit: 20 };
      const result = paginateCursor(data, params);

      expect(result).toHaveProperty('data', data);
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('cursor', '0');
      expect(result.pagination).toHaveProperty('nextCursor');
      expect(result.pagination).toHaveProperty('hasMore');
    });

    it('should compute nextCursor from cursor + limit when hasMore', () => {
      const data = Array(20).fill({ id: 1 });
      const params = { cursor: '0', limit: 20 };
      const result = paginateCursor(data, params);

      expect(result.pagination.nextCursor).toBe('20');
    });

    it('should set nextCursor=null when no more data', () => {
      const data = Array(10).fill({ id: 1 });
      const params = { cursor: '80', limit: 20 };
      const result = paginateCursor(data, params, 100);

      expect(result.pagination.nextCursor).toBe(null);
    });

    it('should accept custom nextCursor', () => {
      const data = [{ id: 1 }];
      const params = { cursor: 'abc', limit: 20 };
      const result = paginateCursor(data, params, 100, 'def');

      expect(result.pagination.nextCursor).toBe('def');
    });

    it('should allow nextCursor=null', () => {
      const data = Array(20).fill({ id: 1 });
      const params = { cursor: '0', limit: 20 };
      const result = paginateCursor(data, params, 100, null);

      expect(result.pagination.nextCursor).toBe(null);
    });

    it('should handle empty data', () => {
      const result = paginateCursor([], { cursor: '0', limit: 20 });

      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBe(null);
    });

    it('should set hasMore=true when data.length >= limit', () => {
      const data = Array(20).fill({ id: 1 });
      const params = { cursor: '0', limit: 20 };
      const result = paginateCursor(data, params);

      expect(result.pagination.hasMore).toBe(true);
    });

    it('should set hasMore=false when data.length < limit', () => {
      const data = Array(10).fill({ id: 1 });
      const params = { cursor: '0', limit: 20 };
      const result = paginateCursor(data, params);

      expect(result.pagination.hasMore).toBe(false);
    });
  });

  describe('paginateArray - in-memory array pagination', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should paginate first page', () => {
      const result = paginateArray(items, { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 1 });
      expect(result.pagination).toEqual({
        limit: 20,
        offset: 0,
        total: 100,
        hasMore: true,
      });
    });

    it('should paginate middle page', () => {
      const result = paginateArray(items, { limit: 20, offset: 40 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 41 });
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should paginate last page with partial results', () => {
      const result = paginateArray(items, { limit: 20, offset: 80 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 81 });
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle out-of-range offset (return empty)', () => {
      const result = paginateArray(items, { limit: 20, offset: 200 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination).toEqual({
        limit: 20,
        offset: 200,
        total: 100,
        hasMore: false,
      });
    });

    it('should handle empty array', () => {
      const result = paginateArray([], { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should clamp offset to array length', () => {
      const result = paginateArray(items, { limit: 20, offset: 150 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.offset).toBe(150); // Reported as requested
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should return partial last page', () => {
      const shortItems = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(shortItems, { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(20);
      expect(result.pagination.hasMore).toBe(true);

      const lastPage = paginateArray(shortItems, { limit: 20, offset: 20 });
      expect(lastPage.data).toHaveLength(5);
      expect(lastPage.pagination.hasMore).toBe(false);
    });
  });

  describe('paginateCursorArray - in-memory cursor pagination', () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

    it('should paginate first page with numeric cursor', () => {
      const result = paginateCursorArray(items, { cursor: '0', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 1 });
      expect(result.pagination).toHaveProperty('nextCursor', '20');
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should paginate middle page', () => {
      const result = paginateCursorArray(items, { cursor: '40', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 41 });
      expect(result.pagination.nextCursor).toBe('60');
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should paginate last page', () => {
      const result = paginateCursorArray(items, { cursor: '80', limit: 20 });

      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 81 });
      expect(result.pagination.nextCursor).toBe(null);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle non-numeric cursor (default to 0)', () => {
      const result = paginateCursorArray(items, { cursor: 'invalid', limit: 20 });

      expect(result.data[0]).toEqual({ id: 1 });
      expect(result.pagination.cursor).toBe('0');
    });

    it('should handle empty array', () => {
      const result = paginateCursorArray([], { cursor: '0', limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.nextCursor).toBe(null);
    });

    it('should handle out-of-range cursor (return empty)', () => {
      const result = paginateCursorArray(items, { cursor: '200', limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle negative cursor (clamp to 0)', () => {
      const result = paginateCursorArray(items, { cursor: '-50', limit: 20 });

      expect(result.data[0]).toEqual({ id: 1 });
      expect(result.pagination.cursor).toBe('0');
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle single item', () => {
      const result = paginateArray([{ id: 1 }], { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.hasMore).toBe(false);
      expect(result.pagination.total).toBe(1);
    });

    it('should handle limit equals total', () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(items, { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(20);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('should handle limit equals 1 (minimum)', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));
      const result = paginateArray(items, { limit: 1, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle very large total', () => {
      const result = paginate(
        Array.from({ length: 50 }, (_, i) => ({ id: i })),
        1000000,
        { limit: 50, offset: 0 }
      );

      expect(result.pagination.total).toBe(1000000);
      expect(result.pagination.hasMore).toBe(true);
    });

    it('should handle exact page boundaries', () => {
      const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1 }));

      // Page 1: 0-19
      const page1 = paginateArray(items, { limit: 20, offset: 0 });
      expect(page1.pagination.hasMore).toBe(true);

      // Page 5: 80-99 (last page)
      const page5 = paginateArray(items, { limit: 20, offset: 80 });
      expect(page5.pagination.hasMore).toBe(false);
    });
  });

  describe('Type safety', () => {
    it('should preserve item types in pagination result', () => {
      interface User {
        id: number;
        name: string;
      }

      const users: User[] = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ];

      const result = paginateArray(users, { limit: 20, offset: 0 });

      // TypeScript should verify result.data is User[]
      expect(result.data[0].name).toBe('Alice');
    });

    it('should work with complex object types', () => {
      interface Transaction {
        id: string;
        amount: number;
        timestamp: Date;
        metadata: Record<string, unknown>;
      }

      const transactions: Transaction[] = [
        {
          id: 'tx1',
          amount: 100,
          timestamp: new Date(),
          metadata: { key: 'value' },
        },
      ];

      const result = paginateArray(transactions, { limit: 20, offset: 0 });

      expect(result.data[0].metadata.key).toBe('value');
    });
  });
});
