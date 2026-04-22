import { describe, it, expect } from 'vitest';
import { authClient, signIn, signOut, useSession } from './auth-client';

describe('auth-client utility', () => {
  it('should export authClient and standard methods', () => {
    expect(authClient).toBeDefined();
    expect(signIn).toBeDefined();
    expect(signOut).toBeDefined();
    expect(useSession).toBeDefined();
  });
});
