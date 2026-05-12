import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { ZodError, z } from 'zod';
import {
  ApiError,
  globalErrorHandler,
  throwErrors,
} from './errorHandler';
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

  describe('globalErrorHandler', () => {
    const mockContext = {
      json: vi.fn().mockReturnThis(),
    } as unknown as Context<AppEnv>;

    it('handles ApiError correctly', () => {
      const error = new ApiError('Not found', 404, 'NOT_FOUND');
      globalErrorHandler(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Not found', code: 'NOT_FOUND' },
        404
      );
    });

    it('handles ApiError with details', () => {
      const error = new ApiError('Validation failed', 400, 'VALIDATION_ERROR', { email: 'Invalid format' });
      globalErrorHandler(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Validation failed', code: 'VALIDATION_ERROR', details: { email: 'Invalid format' } },
        400
      );
    });

    it('handles ZodError correctly', () => {
      // Create a ZodError by actually using zod validation
      const EmailSchema = z.string().email();
      const result = EmailSchema.safeParse('not-an-email');
      const zodError = result.error ? new ZodError(result.error.issues) : new ZodError([]);

      globalErrorHandler(zodError, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: expect.any(Object),
        }),
        400
      );
    });

    it('handles generic Error correctly', () => {
      const error = new Error('Something went wrong');
      globalErrorHandler(error, mockContext);

      expect(mockContext.json).toHaveBeenCalledWith(
        { error: 'Internal Server Error' },
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
