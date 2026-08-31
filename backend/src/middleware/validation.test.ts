import { Request, Response, NextFunction } from 'express';
import { ValidationMiddleware } from './validation';
import * as schemas from './validation.schemas';
import { z } from 'zod';

describe('ValidationMiddleware', () => {
  let req: any;
  let res: any;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
      path: '/test',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validateBody', () => {
    it('should pass valid data through', async () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string(),
      });
      const middleware = ValidationMiddleware.validateBody(schema);
      req.body = { email: 'test@example.com', name: 'Test User' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject invalid email', async () => {
      const schema = z.object({
        email: z.string().email(),
      });
      const middleware = ValidationMiddleware.validateBody(schema);
      req.body = { email: 'invalid-email' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.error).toBe('Validation Error');
      expect(response.details).toBeDefined();
      expect(next).not.toHaveBeenCalled();
    });

    it('should return errors for missing required fields', async () => {
      const schema = z.object({
        email: z.string().email(),
        name: z.string().min(1),
      });
      const middleware = ValidationMiddleware.validateBody(schema);
      req.body = { email: 'test@example.com' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const response = res.json.mock.calls[0][0];
      expect(response.details.length).toBeGreaterThan(0);
      expect(response.details[0].field).toContain('name');
    });
  });

  describe('validateQuery', () => {
    it('should pass valid query params', async () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/),
        limit: z.string().regex(/^\d+$/).optional(),
      });
      const middleware = ValidationMiddleware.validateQuery(schema);
      req.query = { page: '1', limit: '10' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject invalid query params', async () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/),
      });
      const middleware = ValidationMiddleware.validateQuery(schema);
      req.query = { page: 'invalid' };

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateParams', () => {
    it('should pass valid route params', async () => {
      const schema = z.object({
        id: z.string().min(1),
      });
      const middleware = ValidationMiddleware.validateParams(schema);
      req.params = { id: 'user-123' };

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject missing params', async () => {
      const schema = z.object({
        id: z.string().min(1),
      });
      const middleware = ValidationMiddleware.validateParams(schema);
      req.params = {};

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('schema tests', () => {
    it('should validate groupInvitationSchema correctly', () => {
      const valid = { groupId: 'group-1', email: 'test@example.com' };
      expect(() => schemas.groupInvitationSchema.parse(valid)).not.toThrow();

      const invalid = { groupId: '', email: 'invalid' };
      expect(() => schemas.groupInvitationSchema.parse(invalid)).toThrow();
    });

    it('should validate rampDepositSchema correctly', () => {
      const valid = { amount: 100.50, currency: 'USD', paymentMethod: 'card' };
      expect(() => schemas.rampDepositSchema.parse(valid)).not.toThrow();

      const invalid = { amount: -100, currency: 'USD', paymentMethod: 'card' };
      expect(() => schemas.rampDepositSchema.parse(invalid)).toThrow();
    });

    it('should validate passwordChangeSchema with matching passwords', () => {
      const valid = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'newpass123',
      };
      expect(() => schemas.passwordChangeSchema.parse(valid)).not.toThrow();
    });

    it('should reject passwordChangeSchema with mismatched passwords', () => {
      const invalid = {
        currentPassword: 'oldpass123',
        newPassword: 'newpass123',
        confirmPassword: 'different',
      };
      expect(() => schemas.passwordChangeSchema.parse(invalid)).toThrow();
    });

    it('should validate sepTransferSchema correctly', () => {
      const valid = {
        destinationAccount: 'GXYZ123',
        amount: '1000.1234567',
        assetCode: 'USD',
      };
      expect(() => schemas.sepTransferSchema.parse(valid)).not.toThrow();

      const invalid = {
        destinationAccount: 'GXYZ123',
        amount: 'not-a-number',
        assetCode: 'USD',
      };
      expect(() => schemas.sepTransferSchema.parse(invalid)).toThrow();
    });
  });
});
