import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { genericOAuth } from "better-auth/plugins";

export const getAuth = (db: D1Database, env: Record<string, string>) => {
    const kyselyDb = new Kysely({
        dialect: new D1Dialect({
            database: db,
        }),
    });

    return betterAuth({
        database: kyselyAdapter(kyselyDb, {
            provider: "sqlite",
        }),
        secret: env.BETTER_AUTH_SECRET,
        baseURL: env.BETTER_AUTH_URL || "http://localhost:5173",
        socialProviders: {
            google: {
                clientId: env.GOOGLE_CLIENT_ID || "",
                clientSecret: env.GOOGLE_CLIENT_SECRET || "",
            },
            github: {
                clientId: env.GITHUB_CLIENT_ID || "",
                clientSecret: env.GITHUB_CLIENT_SECRET || "",
                scope: ["read:user", "user:email", "read:org"],
            },
        },
        plugins: [
            genericOAuth({
                config: [{
                    providerId: "zulip",
                    discoveryUrl: "https://aresfirst.zulipchat.com/.well-known/openid-configuration",
                    authorizationUrl: "https://aresfirst.zulipchat.com/o/authorize/",
                    tokenUrl: "https://aresfirst.zulipchat.com/o/token/",
                    userInfoUrl: "https://aresfirst.zulipchat.com/api/v1/users/me",
                    clientId: env.ZULIP_CLIENT_ID || "",
                    clientSecret: env.ZULIP_CLIENT_SECRET || "",
                    scopes: ["read"],
                    getUserInfo: async (tokens) => {
                        const response = await fetch("https://aresfirst.zulipchat.com/api/v1/users/me", {
                            headers: {
                                Authorization: `Bearer ${tokens.accessToken}`,
                            },
                        });
                        const user = await response.json() as { user_id: string; email: string; full_name: string; avatar_url: string };
                        return {
                            id: String(user.user_id),
                            email: user.email,
                            name: user.full_name,
                            image: user.avatar_url,
                        };
                    }
                }]
            })
        ],
        user: {
            additionalFields: {
                role: {
                    type: "string",
                    defaultValue: "user",
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
                            const currentUser = await db.prepare("SELECT role FROM user WHERE id = ?").bind(session.userId).first<{role: string}>();
                            if (currentUser && currentUser.role !== "admin") {
                                const account = await db.prepare("SELECT accessToken FROM account WHERE userId = ? AND providerId = 'github'").bind(session.userId).first<{accessToken: string}>();
                                if (account && account.accessToken) {
                                    const res = await fetch("https://api.github.com/user/orgs", {
                                        headers: {
                                            "Authorization": `Bearer ${account.accessToken}`,
                                            "Accept": "application/vnd.github.v3+json",
                                            "User-Agent": "ARES-23247-Auth"
                                        }
                                    });
                                    if (res.ok) {
                                        const orgs = await res.json() as { login: string }[];
                                        if (orgs.some(o => o.login === "ARES-23247")) {
                                            console.log(`[GitHub Auth] Verified ${session.userId} as ARES-23247 org member. Promoting to author.`);
                                            await db.prepare("UPDATE user SET role = 'author' WHERE id = ?").bind(session.userId).run();
                                        } else {
                                            console.warn(`[GitHub Auth] User ${session.userId} successfully authenticated via GitHub but is NOT a member of ARES-23247.`);
                                        }
                                    } else {
                                        console.error(`[GitHub Auth] Failed to verify orgs. GitHub API returned: ${res.status}`);
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
                        // Promoting initial admin
                        if (user.email === "ares23247wv@gmail.com") {
                            await db.prepare("UPDATE user SET role = 'admin' WHERE email = ?")
                                .bind(user.email)
                                .run();
                        }
                    },
                },
            },
        },
    });
};
