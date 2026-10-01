import type { WorkspaceContext } from "@sakani/database";
import { describe, expect, it, vi } from "vitest";

import { createAuthService } from "./service";
import type {
  AuthIdentity,
  AuthRepository,
  CurrentSession,
  NewOwnerAccountInput,
  NewSessionInput,
} from "./types";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const now = new Date("2026-10-01T00:00:00.000Z");
const token = "t".repeat(43);

function createIdentity(overrides: Partial<AuthIdentity> = {}): AuthIdentity {
  return {
    id: userId,
    email: "owner@example.com",
    displayName: "Owner Sakani",
    passwordHash: "stored-password-hash",
    status: "active",
    membership: {
      workspaceId,
      workspaceName: "Sakani",
      role: "owner",
      status: "active",
    },
    ...overrides,
  };
}

class FakeAuthRepository implements AuthRepository {
  identity: AuthIdentity | null = null;
  createdSessions: NewSessionInput[] = [];
  createdAccounts: NewOwnerAccountInput[] = [];
  failedLogins: Array<{ context: WorkspaceContext; userId: string; reason: string }> = [];
  currentSession: CurrentSession | null = null;

  async findIdentityByEmail(): Promise<AuthIdentity | null> {
    return this.identity;
  }

  async createOwnerAccount(input: NewOwnerAccountInput): Promise<AuthIdentity> {
    this.createdAccounts.push(input);
    return createIdentity({
      id: input.userId,
      email: input.email,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      membership: {
        workspaceId: input.workspaceId,
        workspaceName: input.workspaceName,
        role: "owner",
        status: "active",
      },
    });
  }

  async createAuthenticatedSession(input: NewSessionInput): Promise<void> {
    this.createdSessions.push(input);
  }

  async recordFailedLogin(
    context: WorkspaceContext,
    failedUserId: string,
    reason: "invalid_credentials" | "access_denied",
  ): Promise<void> {
    this.failedLogins.push({ context, userId: failedUserId, reason });
  }

  async findSession(): Promise<CurrentSession | null> {
    return this.currentSession;
  }

  async revokeSessionAndAudit(): Promise<boolean> {
    return true;
  }
}

function createService(repository: FakeAuthRepository, passwordMatches = true) {
  return createAuthService(repository, {
    now: () => now,
    generateToken: () => token,
    hashPassword: vi.fn().mockResolvedValue("argon2-password-hash"),
    verifyPassword: vi.fn().mockResolvedValue(passwordMatches),
    sessionTtlMs: 60_000,
  });
}

describe("authentication service", () => {
  it("rejects invalid login input before querying credentials", async () => {
    const repository = new FakeAuthRepository();
    const lookup = vi.spyOn(repository, "findIdentityByEmail");

    await expect(
      createService(repository).login({ email: "invalid", password: "short" }),
    ).resolves.toMatchObject({ ok: false, code: "invalid_input" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns the same public failure for an unknown email and a wrong password", async () => {
    const unknownRepository = new FakeAuthRepository();
    const knownRepository = new FakeAuthRepository();
    knownRepository.identity = createIdentity();

    const unknownResult = await createService(unknownRepository, false).login({
      email: "unknown@example.com",
      password: "kata-sandi-aman-123",
    });
    const wrongPasswordResult = await createService(knownRepository, false).login({
      email: "owner@example.com",
      password: "kata-sandi-salah-456",
    });

    expect(unknownResult).toEqual({ ok: false, code: "invalid_credentials" });
    expect(wrongPasswordResult).toEqual({ ok: false, code: "invalid_credentials" });
    expect(knownRepository.failedLogins).toMatchObject([
      { userId, context: { workspaceId }, reason: "invalid_credentials" },
    ]);
  });

  it("creates a workspace-bound session and records the login-success transaction", async () => {
    const repository = new FakeAuthRepository();
    repository.identity = createIdentity();

    const result = await createService(repository).login({
      email: "OWNER@EXAMPLE.COM",
      password: "kata-sandi-aman-123",
    });

    expect(result).toMatchObject({ ok: true, session: { workspaceId, token } });
    expect(repository.createdSessions).toHaveLength(1);
    expect(repository.createdSessions[0]).toMatchObject({
      workspaceId,
      userId,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    expect(repository.createdSessions[0]?.tokenHash).not.toBe(token);
  });

  it("denies an inactive membership and records an access-denied audit", async () => {
    const repository = new FakeAuthRepository();
    repository.identity = createIdentity({
      membership: {
        workspaceId,
        workspaceName: "Sakani",
        role: "owner",
        status: "inactive",
      },
    });

    const result = await createService(repository).login({
      email: "owner@example.com",
      password: "kata-sandi-aman-123",
    });

    expect(result).toEqual({ ok: false, code: "invalid_credentials" });
    expect(repository.createdSessions).toHaveLength(0);
    expect(repository.failedLogins[0]?.reason).toBe("access_denied");
  });

  it("hashes the password before atomically creating an owner workspace", async () => {
    const repository = new FakeAuthRepository();
    const plaintext = "kata-sandi-aman-123";

    const result = await createService(repository).register({
      displayName: "Owner Sakani",
      workspaceName: "Sakani Barat",
      email: "owner@example.com",
      password: plaintext,
    });

    expect(result.ok).toBe(true);
    expect(repository.createdAccounts).toHaveLength(1);
    expect(repository.createdAccounts[0]?.passwordHash).toBe("argon2-password-hash");
    expect(JSON.stringify(repository.createdAccounts[0])).not.toContain(plaintext);
  });
});
