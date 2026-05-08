import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { ZodError, z } from 'zod';
import {
  errorHandlerMiddleware,
  asyncHandler,
  ApiError,
  throwErrors,
} from './errorHandler';
// import { createErrorResponse } from '../../../shared/errors/api'; // Mocked below
import type { AppEnv } from './utils';

// Mock the shared errors module
vi.mock('../../../shared/errors/api', () => ({
  createErrorResponse: vi.fn((error: string, code?: string, details?: unknown) => ({
    error,
    ...(code && { code }),
    ...(details !== undefined && { details }),
  })),
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  },
}));

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiError', () => {
    it('creates error with default values', () => {
      const error = new ApiError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(400);
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
      expect(error.name).toBe('ApiError');
    });

    it('creates error with custom status code', () => {
      const error = new ApiError('Not found', 404);
      expect(error.message).toBe('Not found');
      expect(error.status).toBe(404);
    });

    it('creates error with code and details', () => {
      const error = new ApiError('Validation failed', 400, 'VALIDATION_ERROR', { field: 'email' });
      expect(error.message).toBe('Validation failed');
      expect(error.status).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual({ field: 'email' });
    });
  });

  describe('errorHandlerMiddleware', () => {
    it('passes through successful requests', async () => {
      const mockContext = {
        req: { path: '/test', method: 'GET' },
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Context<AppEnv>;

      const next = vi.fn().mockResolvedValue(undefined);

      await errorHandlerMiddleware(mockContext, next);

      expect(next).toHaveBeenCalled();
      expect(mockContext.json).not.toHaveBeenCalled();
    });

    it('handles ApiError correctly', async () => {
      const mockContext = {
        req: { path: '/test', method: 'POST' },
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const error = new ApiError('Not found', 404, 'NOT_FOUND');
      const next = vi.fn().mockRejectedValue(error);

      await errorHandlerMiddleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Not found', code: 'NOT_FOUND' },
        404
      );
    });

    it('handles ZodError correctly', async () => {
      const mockContext = {
        req: { path: '/test', method: 'POST' },
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      // Create a ZodError by actually using zod validation
      const EmailSchema = z.string().email();
      const result = EmailSchema.safeParse('not-an-email');
      const zodError = result.error ? new ZodError(result.error.issues) : new ZodError([]);

      const next = vi.fn().mockRejectedValue(zodError);

      await errorHandlerMiddleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.any(Object),
        }),
        400
      );
    });

    it('handles generic Error correctly', async () => {
      const mockContext = {
        req: { path: '/test', method: 'GET' },
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const error = new Error('Something went wrong');
      const next = vi.fn().mockRejectedValue(error);

      await errorHandlerMiddleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Something went wrong' },
        500
      );
    });

    it('handles string errors correctly', async () => {
      const mockContext = {
        req: { path: '/test', method: 'GET' },
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const error = 'String error message';
      const next = vi.fn().mockRejectedValue(error);

      await errorHandlerMiddleware(mockContext, next);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'String error message' },
        500
      );
    });
  });

  describe('asyncHandler', () => {
    it('wraps successful async handlers', async () => {
      const mockContext = {} as Context<AppEnv>;
      const handler = vi.fn().mockResolvedValue({ json: vi.fn().mockReturnValue('success') });

      const wrapped = asyncHandler(handler);
      const _result = await wrapped(mockContext);

      expect(handler).toHaveBeenCalledWith(mockContext);
    });

    it('catches ApiError in wrapped handlers', async () => {
      const mockContext = {
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const handler = vi.fn().mockRejectedValue(new ApiError('Unauthorized', 401, 'UNAUTHORIZED'));

      const wrapped = asyncHandler(handler);
      await wrapped(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        401
      );
    });

    it('catches generic errors in wrapped handlers', async () => {
      const mockContext = {
        json: vi.fn().mockReturnThis(),
      } as unknown as Context<AppEnv>;

      const handler = vi.fn().mockRejectedValue(new Error('Database error'));

      const wrapped = asyncHandler(handler);
      await wrapped(mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Database error' },
        500
      );
    });
  });

  describe('throwErrors', () => {
    it('throws bad request error', () => {
      expect(() => throwErrors.badRequest('Invalid input')).toThrow(ApiError);
      try {
        throwErrors.badRequest('Invalid input');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(400);
        expect((e as ApiError).message).toBe('Invalid input');
      }
    });

    it('throws bad request error with details', () => {
      try {
        throwErrors.badRequest('Invalid input', { field: 'email' });
      } catch (e) {
        expect((e as ApiError).details).toEqual({ field: 'email' });
      }
    });

    it('throws unauthorized error with default message', () => {
      try {
        throwErrors.unauthorized();
      } catch (e) {
        expect((e as ApiError).status).toBe(401);
        expect((e as ApiError).message).toBe('Unauthorized: Please log in');
      }
    });

    it('throws unauthorized error with custom message', () => {
      try {
        throwErrors.unauthorized('Custom auth message');
      } catch (e) {
        expect((e as ApiError).status).toBe(401);
        expect((e as ApiError).message).toBe('Custom auth message');
      }
    });

    it('throws forbidden error with default message', () => {
      try {
        throwErrors.forbidden();
      } catch (e) {
        expect((e as ApiError).status).toBe(403);
        expect((e as ApiError).message).toBe('Forbidden: Insufficient permissions');
      }
    });

    it('throws not found error with default resource', () => {
      try {
        throwErrors.notFound();
      } catch (e) {
        expect((e as ApiError).status).toBe(404);
        expect((e as ApiError).message).toBe('Resource not found');
      }
    });

    it('throws not found error with custom resource', () => {
      try {
        throwErrors.notFound('Post');
      } catch (e) {
        expect((e as ApiError).status).toBe(404);
        expect((e as ApiError).message).toBe('Post not found');
      }
    });

    it('throws conflict error', () => {
      try {
        throwErrors.conflict('Resource already exists');
      } catch (e) {
        expect((e as ApiError).status).toBe(409);
        expect((e as ApiError).message).toBe('Resource already exists');
      }
    });

    it('throws internal error with default message', () => {
      try {
        throwErrors.internal();
      } catch (e) {
        expect((e as ApiError).status).toBe(500);
        expect((e as ApiError).message).toBe('Internal server error');
      }
    });

    it('throws internal error with custom message', () => {
      try {
        throwErrors.internal('Database connection failed');
      } catch (e) {
        expect((e as ApiError).status).toBe(500);
        expect((e as ApiError).message).toBe('Database connection failed');
      }
    });
  });
});
