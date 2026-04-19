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
            },
        },
        plugins: [
            genericOAuth({
                id: "zulip",
                name: "Zulip",
                authorizeUrl: "https://aresfirst.zulipchat.com/o/authorize/",
                tokenUrl: "https://aresfirst.zulipchat.com/o/token/",
                getUserInfo: async (token) => {
                    const response = await fetch("https://aresfirst.zulipchat.com/api/v1/users/me", {
                        headers: {
                            Authorization: `Bearer ${token.accessToken}`,
                        },
                    });
                    const user = await response.json() as { user_id: string; email: string; full_name: string; avatar_url: string };
                    return {
                        id: String(user.user_id),
                        email: user.email,
                        name: user.full_name,
                        image: user.avatar_url,
                    };
                },
                clientId: env.ZULIP_CLIENT_ID || "",
                clientSecret: env.ZULIP_CLIENT_SECRET || "",
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
            user: {
                create: {
                    after: async (user) => {
                        // Promoting initial admin
                        if (user.email === "ares23247wv@gmail.com") {
                            await db.prepare("UPDATE user SET role = 'admin' WHERE email = ?")
                                .bind(user.email)
                                .run();
                        }
                        return user;
                    },
                },
            },
        },
    });
};
