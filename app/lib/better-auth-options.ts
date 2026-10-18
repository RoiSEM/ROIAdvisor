import type { BetterAuthOptions } from "better-auth";
import type { Pool } from "pg";

type Settings = { baseURL: string; secret: string; clientId: string; clientSecret: string };

// Shared by the runtime and the explicit, admin-only schema migration.
export function createBetterAuthOptions(database: Pool, settings: Settings): BetterAuthOptions {
  return {
    appName: "Convert by WhachaWant",
    database,
    baseURL: settings.baseURL,
    basePath: "/api/auth",
    secret: settings.secret,
    trustedOrigins: [settings.baseURL],
    advanced: { database: { generateId: "uuid" }, useSecureCookies: true },
    socialProviders: {
      google: { clientId: settings.clientId, clientSecret: settings.clientSecret },
    },
    user: {
      modelName: "convert_auth_user",
      validateUserInfo: ({ user }) => {
        if (!user.emailVerified) return { error: "verified_email_required" };
      },
    },
    session: {
      modelName: "convert_auth_session",
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    account: {
      modelName: "convert_auth_account",
      accountLinking: { enabled: false, disableImplicitLinking: true },
      encryptOAuthTokens: true,
    },
    verification: { modelName: "convert_auth_verification" },
    rateLimit: { enabled: true, storage: "database", modelName: "convert_auth_rate_limit" },
    emailAndPassword: { enabled: false },
    telemetry: { enabled: false },
    logger: { disabled: true },
  };
}
