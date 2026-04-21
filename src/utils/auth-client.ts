import { createAuthClient } from "better-auth/react";
import { genericOAuthClient, twoFactorClient, emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
    baseURL: window.location.origin + "/api/auth", // Better Auth is mounted at /api/auth
    plugins: [
        genericOAuthClient(),
        twoFactorClient(),
        emailOTPClient()
    ]
});

export const { signIn, signOut, useSession } = authClient;
