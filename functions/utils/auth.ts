import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { siteConfig } from "./site.config";
import type { D1Database } from "@cloudflare/workers-types";

export const getAuth = (db: D1Database, env: Record<string, unknown>, requestUrl?: string) => {
    const drizzleDb = drizzle(db, { schema });

    let baseURL = env.BETTER_AUTH_URL as string | undefined;
    
    // Derive baseURL from the request's origin when BETTER_AUTH_URL is not explicitly set.
    // CRITICAL: This must work for ALL routes (not just /auth/* routes) because getAuth()
    // is called from ensureAuth middleware on paths like /api/profile/me.
    // The protocol (http vs https) determines the cookie prefix (__Secure- vs plain),
    // so getting this wrong causes session lookups to fail silently.
    if (!baseURL && requestUrl) {
        const url = new URL(requestUrl);
        baseURL = `${url.protocol}//${url.host}/api/auth`;
    }

    // Final fallback
    if (!baseURL) {
        baseURL = "http://localhost:5173/api/auth";
    }

    return betterAuth({
        plugins: [
            genericOAuth({
                config: env.ZULIP_CLIENT_ID ? [
                    {
                        providerId: "zulip",
                        clientId: env.ZULIP_CLIENT_ID as string,
                        clientSecret: env.ZULIP_CLIENT_SECRET as string,
                        authorizationEndpoint: `${env.ZULIP_URL || "https://aresfirst.zulipchat.com"}/o/authorize/`,
                        tokenEndpoint: `${env.ZULIP_URL || "https://aresfirst.zulipchat.com"}/o/token/`,
                        userInfoEndpoint: `${env.ZULIP_URL || "https://aresfirst.zulipchat.com"}/api/v1/users/me`,
                        mapping: {
                            id: "user_id",
                            email: "email",
                            name: "full_name",
                            image: "avatar_url"
                        }
                     
                    } as unknown as import("better-auth/plugins").GenericOAuthConfig
                ] : []
            }),
        ],
        database: drizzleAdapter(drizzleDb, {
            provider: "sqlite",
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification
            }
        }),
        onAPIError: {
            throw: true,
        },
        secret: (() => {
            const s = env.BETTER_AUTH_SECRET as string | undefined;
            if (s) return s;
            // SEC-01: Allow a dev-only fallback ONLY on localhost
            let isLocal = false;
            if (requestUrl) {
                try {
                    const urlObj = new URL(requestUrl);
                    isLocal = urlObj.hostname === "localhost" || urlObj.hostname === "127.0.0.1";
                } catch (e) {
                    isLocal = false;
                }
            }
            if (isLocal) {
                console.warn("[AUTH] BETTER_AUTH_SECRET not set — using dev-only fallback. DO NOT deploy like this.");
                return "ares-local-dev-secret-do-not-use-in-production";
            }
            throw new Error("[FATAL] BETTER_AUTH_SECRET is not set. Refusing to start with an insecure default.");
        })(),
        baseURL,
        trustedOrigins: [
            "http://localhost:8788", 
            "http://127.0.0.1:8788", 
            "http://localhost:5173", 
            "http://127.0.0.1:5173",
            // Dynamically trust the origin of the current request
            // so production Cloudflare Pages domains always pass CSRF
            ...(requestUrl ? [new URL(requestUrl).origin] : []),
        ],
        advanced: {
        },
        socialProviders: {
            ...(env.GOOGLE_CLIENT_ID ? {
                google: {
                    clientId: env.GOOGLE_CLIENT_ID as string,
                    clientSecret: (env.GOOGLE_CLIENT_SECRET as string) || "",
                }
            } : {}),
            ...(env.GITHUB_CLIENT_ID ? {
                github: {
                    clientId: env.GITHUB_CLIENT_ID as string,
                    clientSecret: (env.GITHUB_CLIENT_SECRET as string) || "",
                    scope: ["read:user", "user:email", "read:org"],
                }
            } : {}),
        },
        user: {
            additionalFields: {
                role: {
                    type: "string",
                    defaultValue: "unverified",
                },
            },
        },
        account: {
            accountLinking: {
                enabled: true,
                trustedProviders: ["google", "github"],
            },
        },
        session: {
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            updateAge: 60 * 60 * 24, // 1 day
        },
        databaseHooks: {
            session: {
                create: {
                    after: async (session) => {
                        try {
                            const currentUserResult = await drizzleDb
                                .select({ role: schema.user.role })
                                .from(schema.user)
                                .where(eq(schema.user.id, session.userId))
                                .limit(1);
                            const currentUser = currentUserResult?.[0];

                            if (currentUser && currentUser.role !== "admin") {
                                const userAccountResult = await drizzleDb
                                    .select({ accessToken: schema.account.accessToken })
                                    .from(schema.account)
                                    .where(and(
                                        eq(schema.account.userId, session.userId),
                                        eq(schema.account.providerId, "github")
                                    ))
                                    .limit(1);
                                const userAccount = userAccountResult?.[0];

                                if (userAccount && userAccount.accessToken) {
                                    const res = await fetch("https://api.github.com/user/memberships/orgs/ARES-23247", { signal: AbortSignal.timeout(5000),
                                        headers: {
                                            "Authorization": `Bearer ${userAccount.accessToken}`,
                                            "Accept": "application/vnd.github.v3+json",
                                            "User-Agent": "ARES-23247-Auth"
                                        }
                                    });
                                    if (res.ok) {
                                        const membership = await res.json() as { state: string, role: string };
                                        if (membership.state === "active") {
                                            if (membership.role === "admin") {
                                                await drizzleDb.update(schema.user)
                                                    .set({ role: 'admin' })
                                                    .where(eq(schema.user.id, session.userId));
                                            } else {
                                                await drizzleDb.update(schema.user)
                                                    .set({ role: 'user' })
                                                    .where(eq(schema.user.id, session.userId));
                                            }
                                        }
                                    } else {
                                        console.warn(`[GitHub Auth] User ${session.userId} is NOT a member of ${siteConfig.urls.githubOrg} or API failed (${res.status}).`);
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("[GitHub Auth] Verification exception:", err);
                        }
                    }
                }
            },
            user: {
                create: {
                    after: async (user) => {
                        // SEC-01: Bootstrap admin from env var, not hardcoded email
                        const initialAdmin = env.INITIAL_ADMIN_EMAIL as string | undefined;
                        if (initialAdmin && user.email === initialAdmin) {
                            await drizzleDb.update(schema.user)
                                .set({ role: 'admin' })
                                .where(eq(schema.user.email, user.email));
                        } else {
                            try {
                                const admins = await drizzleDb
                                    .select({ id: schema.user.id })
                                    .from(schema.user)
                                    .where(eq(schema.user.role, "admin"));

                                if (admins.length > 0) {
                                    const values = admins
                                        .filter((admin) => admin.id !== null)
                                        .map((admin) => ({
                                            id: crypto.randomUUID(),
                                            userId: admin.id as string,
                                            title: "New User Registration",
                                            message: `A new user (${user.name || user.email}) has registered and is pending verification.`,
                                            link: "/dashboard/users",
                                            priority: "medium" as const
                                        }));

                                    await drizzleDb.insert(schema.notifications).values(values);
                                }
                            } catch (err) {
                                console.error("[Auth] Failed to notify admins of new user:", err);
                            }
                        }
                    },
                },
            },
        },
    });
};
