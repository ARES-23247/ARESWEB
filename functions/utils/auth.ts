import { betterAuth } from "better-auth";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

export const getAuth = (db: D1Database, env: Record<string, string>, requestUrl?: string) => {
    const kyselyDb = new Kysely({
        dialect: new D1Dialect({
            database: db,
        }),
    });

    let baseURL = env.BETTER_AUTH_URL || "http://localhost:5173";
    if (requestUrl) {
        const url = new URL(requestUrl);
        baseURL = `${url.protocol}//${url.host}/api/auth`;
    }

    return betterAuth({
        database: kyselyAdapter(kyselyDb, {
            provider: "sqlite",
        }),
        onAPIError: {
            throw: true,
        },
        secret: env.BETTER_AUTH_SECRET,
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
            crossSubDomain: true
        },
        socialProviders: {
            ...(env.GOOGLE_CLIENT_ID ? {
                google: {
                    clientId: env.GOOGLE_CLIENT_ID,
                    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
                }
            } : {}),
            ...(env.GITHUB_CLIENT_ID ? {
                github: {
                    clientId: env.GITHUB_CLIENT_ID,
                    clientSecret: env.GITHUB_CLIENT_SECRET || "",
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
                            const currentUser = await db.prepare("SELECT role FROM user WHERE id = ?").bind(session.userId).first<{role: string}>();
                            if (currentUser && currentUser.role !== "admin") {
                                const account = await db.prepare("SELECT accessToken FROM account WHERE userId = ? AND providerId = 'github'").bind(session.userId).first<{accessToken: string}>();
                                if (account && account.accessToken) {
                                    const res = await fetch("https://api.github.com/user/memberships/orgs/ARES-23247", {
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
                                                console.log(`[GitHub Auth] Verified ${session.userId} as ARES-23247 Org Owner. Promoting to Admin.`);
                                                await db.prepare("UPDATE user SET role = 'admin' WHERE id = ?").bind(session.userId).run();
                                            } else {
                                                console.log(`[GitHub Auth] Verified ${session.userId} as ARES-23247 Org Member. Promoting to Author.`);
                                                await db.prepare("UPDATE user SET role = 'author' WHERE id = ?").bind(session.userId).run();
                                            }
                                        }
                                    } else {
                                        console.warn(`[GitHub Auth] User ${session.userId} is NOT a member of ARES-23247 or API failed (${res.status}).`);
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
