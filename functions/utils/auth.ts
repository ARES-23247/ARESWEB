/* eslint-disable @typescript-eslint/no-explicit-any */
import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { siteConfig } from "./site.config";

export const getAuth = (db: D1Database, env: Record<string, unknown>, requestUrl?: string) => {
    const kyselyDb = new Kysely<any>({
        dialect: new D1Dialect({
            database: db,
        }),
    });

    let baseURL = env.BETTER_AUTH_URL as string | undefined;
    
    if (requestUrl) {
        const url = new URL(requestUrl);
        // Find the base authentication path dynamically (e.g., /api/auth or /dashboard/api/auth)
        const authIndex = url.pathname.indexOf("/auth");
        if (authIndex !== -1) {
            const basePath = url.pathname.substring(0, authIndex + 5); // +5 for "/auth"
            // Ensure we use the protocol/host from the request, but respect BETTER_AUTH_URL if set in production
            if (!baseURL) {
                baseURL = `${url.protocol}//${url.host}${basePath}`;
            }
        }
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
                        authorizationEndpoint: `${env.ZULIP_URL || "https://ares.zulipchat.com"}/o/authorize/`,
                        tokenEndpoint: `${env.ZULIP_URL || "https://ares.zulipchat.com"}/o/token/`,
                        userInfoEndpoint: `${env.ZULIP_URL || "https://ares.zulipchat.com"}/api/v1/users/me`,
                        mapping: {
                            id: "user_id",
                            email: "email",
                            name: "full_name",
                            image: "avatar_url"
                        }
                     
                    } as any
                ] : []
            }),
        ],
        database: kyselyAdapter(kyselyDb, {
        }),
        onAPIError: {
            throw: true,
        },
        secret: (() => {
            const s = env.BETTER_AUTH_SECRET as string | undefined;
            if (s) return s;
            // SEC-01: Allow a dev-only fallback ONLY on localhost
            const isLocal = requestUrl && (requestUrl.includes("localhost") || requestUrl.includes("127.0.0.1"));
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
        databaseHooks: {
            session: {
                create: {
                    after: async (session) => {
                        try {
                            const currentUser = await kyselyDb.selectFrom("user")
                                .select("role")
                                .where("id", "=", session.userId)
                                .executeTakeFirst();

                            if (currentUser && currentUser.role !== "admin") {
                                const account = await kyselyDb.selectFrom("account")
                                    .select("accessToken")
                                    .where("userId", "=", session.userId)
                                    .where("providerId", "=", "github")
                                    .executeTakeFirst();

                                if (account && account.accessToken) {
                                    const res = await fetch("https://api.github.com/user/memberships/orgs/ARES-23247", { signal: AbortSignal.timeout(5000),
                                        headers: {
                                            "Authorization": `Bearer ${account.accessToken}`,
                                            "Accept": "application/vnd.github.v3+json",
                                            "User-Agent": "ARES-23247-Auth"
                                        }
                                    });
                                    if (res.ok) {
                                        const membership = await res.json() as { state: string, role: string };
                                        if (membership.state === "active") {
                                            if (membership.role === "admin") {
                                                if (env.ENVIRONMENT !== "production") {
                                                  console.log(`[GitHub Auth] Verified ${session.userId} as ${siteConfig.urls.githubOrg} Org Owner. Promoting to Admin.`);
                                                }
                                                await kyselyDb.updateTable("user")
                                                    .set({ role: 'admin' })
                                                    .where("id", "=", session.userId)
                                                    .execute();
                                            } else {
                                                if (env.ENVIRONMENT !== "production") {
                                                  console.log(`[GitHub Auth] Verified ${session.userId} as ${siteConfig.urls.githubOrg} Org Member. Promoting to User.`);
                                                }
                                                await kyselyDb.updateTable("user")
                                                    .set({ role: 'user' })
                                                    .where("id", "=", session.userId)
                                                    .execute();
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
                            await kyselyDb.updateTable("user")
                                .set({ role: 'admin' })
                                .where("email", "=", user.email)
                                .execute();
                        }
                    },
                },
            },
        },
    });
};
