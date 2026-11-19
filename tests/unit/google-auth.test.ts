import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Auth, customFetch, type AuthConfig } from "@auth/core";
import type { NextAuthConfig } from "next-auth";
import type Google from "next-auth/providers/google";

const { state, adapter } = vi.hoisted(() => ({
  state: { config: undefined as NextAuthConfig | undefined },
  adapter: {
    getUser: vi.fn(), getUserByEmail: vi.fn(), getUserByAccount: vi.fn(),
    createUser: vi.fn(), updateUser: vi.fn(), linkAccount: vi.fn(),
    createSession: vi.fn(), getSessionAndUser: vi.fn(), deleteSession: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => adapter }));
vi.mock("next-auth", () => ({
  default: (config: NextAuthConfig) => {
    state.config = config;
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() };
  },
}));

const existingUser = {
  id: "password-user", name: "Existing member", email: "member@gmail.com",
  emailVerified: null, image: null,
};
let profile: Record<string, unknown>;

/**
 * Exercise the real Auth.js callback, adapter linking, and JWT generation using
 * our production config. Stub Google's network exchange with an OAuth profile;
 * Google consent and OIDC token validation belong to the provider, not this test.
 */
async function googleCallback() {
  const config = state.config!;
  const google = config.providers.find(p => typeof p !== "function" && p.id === "google") as ReturnType<typeof Google>;
  const fetchGoogle: typeof fetch = async input => {
    const url = String(input);
    if (url === "https://google.test/token") {
      return Response.json({ access_token: "test-access-token", token_type: "bearer" });
    }
    if (url === "https://google.test/userinfo") return Response.json(profile);
    throw new Error(`Unexpected provider request: ${url}`);
  };
  const options: AuthConfig = {
    ...config,
    secret: "account-linking-test-secret-at-least-32-characters",
    trustHost: true,
    basePath: "/api/auth",
    logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
    providers: [{
      ...google, ...google.options,
      // Only replace the external transport; retain production linking/profile policy.
      type: "oauth", issuer: undefined, checks: [],
      clientId: "test-client", clientSecret: "test-secret",
      authorization: "https://google.test/authorize",
      token: "https://google.test/token", userinfo: "https://google.test/userinfo",
      [customFetch]: fetchGoogle,
    }],
  };
  return Auth(new Request("http://localhost/api/auth/callback/google?code=test-code"), options);
}

beforeAll(async () => {
  vi.stubEnv("AUTH_GOOGLE_ID", "test-client");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-secret");
  await import("@/lib/auth");
});
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  profile = { sub: "google-subject-123", name: "Google member", email: existingUser.email, email_verified: true };
  adapter.getUserByAccount.mockResolvedValue(null);
  adapter.getUserByEmail.mockResolvedValue(existingUser);
  adapter.linkAccount.mockImplementation(async account => account);
  adapter.createUser.mockImplementation(async user => ({ ...user, id: "new-user" }));
});

describe("Google sign-in account linking", () => {
  it("signs into the existing password account and links Google without creating a duplicate", async () => {
    const response = await googleCallback();
    expect(response.headers.get("location")).toBe("http://localhost");
    expect(response.headers.get("set-cookie")).toContain("authjs.session-token=");
    expect(adapter.linkAccount).toHaveBeenCalledWith(expect.objectContaining({
      userId: existingUser.id, provider: "google", providerAccountId: "google-subject-123",
    }));
    expect(adapter.createUser).not.toHaveBeenCalled();
    expect(adapter.updateUser).not.toHaveBeenCalled();
  });

  it("matches an existing account using the same email normalization as password signup", async () => {
    profile.email = " Member@Gmail.com ";
    await googleCallback();
    expect(adapter.getUserByEmail).toHaveBeenCalledWith("member@gmail.com");
    expect(adapter.linkAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: existingUser.id }));
  });

  it("signs in a returning linked Google account without linking it again", async () => {
    adapter.getUserByAccount.mockResolvedValue(existingUser);
    const response = await googleCallback();
    expect(response.headers.get("set-cookie")).toContain("authjs.session-token=");
    expect(adapter.linkAccount).not.toHaveBeenCalled();
    expect(adapter.createUser).not.toHaveBeenCalled();
  });

  it("creates and signs in a new user when no account exists", async () => {
    adapter.getUserByEmail.mockResolvedValue(null);
    const response = await googleCallback();
    expect(response.headers.get("set-cookie")).toContain("authjs.session-token=");
    expect(adapter.createUser).toHaveBeenCalledOnce();
    expect(adapter.linkAccount).toHaveBeenCalledWith(expect.objectContaining({ userId: "new-user" }));
  });

  it.each([false, undefined, "true"])("does not link or sign in with email_verified=%s", async verified => {
    profile.email_verified = verified;
    const response = await googleCallback();
    expect(response.headers.get("location")).toContain("error=AccessDenied");
    expect(response.headers.get("set-cookie") ?? "").not.toContain("authjs.session-token=");
    expect(adapter.linkAccount).not.toHaveBeenCalled();
    expect(adapter.createUser).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "   "])("rejects a missing or empty Google email (%s)", async email => {
    profile.email = email;
    const response = await googleCallback();
    expect(response.headers.get("location")).toContain("error=AccessDenied");
    expect(adapter.linkAccount).not.toHaveBeenCalled();
    expect(adapter.createUser).not.toHaveBeenCalled();
  });
});
