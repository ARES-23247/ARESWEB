import { describe, it, expect } from 'vitest';
import authRouter from './auth';
import usersRouter from './users';
import postsRouter from './posts';
import tasksRouter from './tasks';
import inquiriesRouter from './inquiries/index';
import eventsRouter from './events/index';

describe('API route modules', () => {
  describe('auth routes', () => {
    it('exports an auth router', () => {
      expect(authRouter).toBeDefined();
      expect(typeof (authRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((authRouter as any).routes).toBeDefined();
      expect((authRouter as any).routes.length).toBeGreaterThan(0);
    });
  });

  describe('users routes', () => {
    it('exports a users router', () => {
      expect(usersRouter).toBeDefined();
      expect(typeof (usersRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((usersRouter as any).routes).toBeDefined();
      expect((usersRouter as any).routes.length).toBeGreaterThan(0);
    });
  });

  describe('posts routes', () => {
    it('exports a posts router', () => {
      expect(postsRouter).toBeDefined();
      expect(typeof (postsRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((postsRouter as any).routes).toBeDefined();
      expect((postsRouter as any).routes.length).toBeGreaterThan(0);
    });
  });

  describe('tasks routes', () => {
    it('exports a tasks router', () => {
      expect(tasksRouter).toBeDefined();
      expect(typeof (tasksRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((tasksRouter as any).routes).toBeDefined();
      expect((tasksRouter as any).routes.length).toBeGreaterThan(0);
    });
  });

  describe('inquiries routes', () => {
    it('exports an inquiries router', () => {
      expect(inquiriesRouter).toBeDefined();
      expect(typeof (inquiriesRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((inquiriesRouter as any).routes).toBeDefined();
      expect((inquiriesRouter as any).routes.length).toBeGreaterThan(0);
    });
  });

  describe('events routes', () => {
    it('exports an events router', () => {
      expect(eventsRouter).toBeDefined();
      expect(typeof (eventsRouter as any).openapi).toBe('function');
    });

    it('has routes defined', () => {
      expect((eventsRouter as any).routes).toBeDefined();
      expect((eventsRouter as any).routes.length).toBeGreaterThan(0);
    });
  });
});
