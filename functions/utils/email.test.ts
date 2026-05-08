import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from './email';
import { Context } from 'hono';
import { getSocialConfig } from '../api/middleware';

vi.mock('../api/middleware', async () => {
  const actual = await vi.importActual<typeof import('../api/middleware')>('../api/middleware');
  return {
    ...actual,
    getSocialConfig: vi.fn(),
  };
});

describe('email utility', () => {
  const mockFetch = vi.fn();
  const mockContext = {
    env: {
      RESEND_API_KEY: 'test-resend-key',
      RESEND_FROM_EMAIL: 'noreply@aresfirst.org',
    },
    get: vi.fn().mockReturnValue({}),
  } as unknown as Context;

  const mockedGetSocialConfig = getSocialConfig as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;

    // Default mock: return values from env
    mockedGetSocialConfig.mockResolvedValue({
      RESEND_API_KEY: mockContext.env.RESEND_API_KEY,
      RESEND_FROM_EMAIL: mockContext.env.RESEND_FROM_EMAIL,
    });
  });

  it('sends email successfully with all options', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Email sent',
    });

    const result = await sendEmail(mockContext, {
      to: 'user@example.com',
      subject: 'Test Subject',
      html: '<p>Test HTML</p>',
      fromName: 'Custom Sender',
    });

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-resend-key',
        }),
      })
    );
  });

  it('uses default from name when not specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Email sent',
    });

    await sendEmail(mockContext, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
    });

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.from).toContain('ARES Robotics');
  });

  it('uses default from email when not configured', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Email sent',
    });

    const contextWithoutFromEmail = {
      env: {
        RESEND_API_KEY: 'test-resend-key',
      },
      get: vi.fn().mockReturnValue({}),
    } as unknown as Context;

    mockedGetSocialConfig.mockResolvedValueOnce({
      RESEND_API_KEY: 'test-resend-key',
      RESEND_FROM_EMAIL: undefined,
    });

    await sendEmail(contextWithoutFromEmail, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
    });

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.from).toContain('team@aresfirst.org');
  });

  it('returns false when API key is missing', async () => {
    const contextWithoutKey = {
      env: {},
      get: vi.fn().mockReturnValue({}),
    } as unknown as Context;

    mockedGetSocialConfig.mockResolvedValueOnce({
      RESEND_API_KEY: undefined,
    });

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await sendEmail(contextWithoutKey, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[Email] Resend API key not found. Skipping email.');
    expect(mockFetch).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('returns false when API request fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'API Error: Invalid key',
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendEmail(mockContext, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[Email] Resend API Error:', 'API Error: Invalid key');

    consoleSpy.mockRestore();
  });

  it('returns false on network exception', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendEmail(mockContext, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith('[Email] Exception sending email:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('sends email with correct body structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'Email sent',
    });

    await sendEmail(mockContext, {
      to: 'recipient@example.com',
      subject: 'Important Update',
      html: '<h1>Update</h1><p>Content here</p>',
      fromName: 'ARES Notifications',
    });

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);

    expect(requestBody).toEqual({
      from: 'ARES Notifications <noreply@aresfirst.org>',
      to: ['recipient@example.com'],
      subject: 'Important Update',
      html: '<h1>Update</h1><p>Content here</p>',
    });
  });
});
