/**
 * Tests for safeWaitUntil utility
 *
 * Tests background task execution with error logging for Cloudflare Workers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeWaitUntil } from './safeWaitUntil';

describe('safeWaitUntil utility', () => {
  let mockExecutionContext: {
    waitUntil: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create a fresh mock execution context for each test
    mockExecutionContext = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('calls waitUntil with the provided promise', async () => {
      const testPromise = Promise.resolve('success');

      safeWaitUntil(
        mockExecutionContext as unknown,
        testPromise,
        'Test operation'
      );

      expect(mockExecutionContext.waitUntil).toHaveBeenCalledTimes(1);
      await testPromise; // Ensure the promise resolves
    });

    it('passes the promise through to waitUntil', async () => {
      const testValue = { data: 'test' };
      const testPromise = Promise.resolve(testValue);

      safeWaitUntil(
        mockExecutionContext as unknown,
        testPromise,
        'Test operation'
      );

      const capturedPromise = mockExecutionContext.waitUntil.mock.calls[0]?.[0];
      expect(capturedPromise).toBeInstanceOf(Promise);
      await expect(capturedPromise).resolves.toBe(testValue);
    });
  });

  describe('error handling', () => {
    it('logs errors when the promise rejects', async () => {
      const testError = new Error('Task failed');
      const testPromise = Promise.reject(testError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        testPromise,
        'Failed to send notification'
      );

      // Wait for the promise to be handled
      await new Promise(process.nextTick);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to send notification:',
        testError
      );

      consoleErrorSpy.mockRestore();
    });

    it('logs error messages for non-Error rejections', async () => {
      const testError = 'string error';
      const testPromise = Promise.reject(testError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        testPromise,
        'Background task failed'
      );

      await new Promise(process.nextTick);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Background task failed:',
        testError
      );

      consoleErrorSpy.mockRestore();
    });

    it('includes the error message in logs', async () => {
      const errorMessage = 'Database connection lost';
      const testError = new Error(errorMessage);
      const testPromise = Promise.reject(testError);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        testPromise,
        'Cache update failed'
      );

      await new Promise(process.nextTick);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cache update failed'),
        testError
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('undefined context handling', () => {
    it('handles undefined execution context gracefully', () => {
      const testPromise = Promise.resolve('success');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      expect(() => {
        safeWaitUntil(undefined, testPromise, 'Test operation');
      }).not.toThrow();

      expect(mockExecutionContext.waitUntil).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles execution context without waitUntil', () => {
      const testPromise = Promise.resolve('success');
      const incompleteContext = {} as unknown;

      // Should not throw
      expect(() => {
        safeWaitUntil(incompleteContext, testPromise, 'Test operation');
      }).not.toThrow();
    });
  });

  describe('real-world usage patterns', () => {
    it('works with notification-like background tasks', async () => {
      const sendNotification = vi.fn().mockResolvedValue({ sent: true });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        sendNotification('user123', 'Hello'),
        'Failed to send notification'
      );

      expect(mockExecutionContext.waitUntil).toHaveBeenCalledTimes(1);
      await new Promise(process.nextTick);

      consoleErrorSpy.mockRestore();
    });

    it('works with cache update tasks', async () => {
      const updateCache = vi.fn().mockResolvedValue({ cached: true });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        updateCache('key', 'value'),
        'Failed to update cache'
      );

      expect(mockExecutionContext.waitUntil).toHaveBeenCalledTimes(1);
      await new Promise(process.nextTick);

      consoleErrorSpy.mockRestore();
    });

    it('handles analytics logging failures', async () => {
      const logAnalytics = vi.fn().mockRejectedValue(new Error('Analytics service down'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      safeWaitUntil(
        mockExecutionContext as unknown,
        logAnalytics({ event: 'page_view' }),
        'Failed to log analytics'
      );

      await new Promise(process.nextTick);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to log analytics:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('concurrent operations', () => {
    it('handles multiple concurrent background tasks', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const tasks = [
        Promise.resolve('task1'),
        Promise.reject(new Error('task2 failed')),
        Promise.resolve('task3'),
      ];

      tasks.forEach((task, i) => {
        safeWaitUntil(
          mockExecutionContext as unknown,
          task,
          `Task ${i + 1} failed`
        );
      });

      expect(mockExecutionContext.waitUntil).toHaveBeenCalledTimes(3);
      await new Promise(process.nextTick);

      consoleErrorSpy.mockRestore();
    });
  });
});
