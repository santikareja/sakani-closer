import type { WorkspaceContext } from "@sakani/database";
import { describe, expect, it, vi } from "vitest";

import { assertWorkspaceAccess, requireSessionValue } from "./access";
import { sealSessionCookie } from "./session-crypto";
import { readCurrentSession, revokeCookieSession } from "./session-reader";
import type {
  AuthIdentity,
  AuthRepository,
  CurrentSession,
  NewOwnerAccountInput,
  NewSessionInput,
} from "./types";

const secret = "test-auth-secret-at-least-32-characters-long";
const workspaceId = "00000000-0000-4000-8000-000000000001";
const otherWorkspaceId = "00000000-0000-4000-8000-000000000099";
const now = new Date("2026-10-01T00:00:00.000Z");
const session: CurrentSession = {
  sessionId: "00000000-0000-4000-8000-000000000010",
  userId: "00000000-0000-4000-8000-000000000002",
  email: "owner@example.com",
  displayName: "Owner Sakani",
  workspaceId,
  workspaceName: "Sakani",
  role: "owner",
  expiresAt: new Date("2026-10-08T00:00:00.000Z"),
};

class SessionRepository implements AuthRepository {
  findSessionMock = vi.fn().mockResolvedValue(session);
  revokeMock = vi.fn().mockResolvedValue(true);

  async findIdentityByEmail(): Promise<AuthIdentity | null> {
    return null;
  }
  async createOwnerAccount(_input: NewOwnerAccountInput): Promise<AuthIdentity> {
    throw new Error("not used");
  }
  async createAuthenticatedSession(_input: NewSessionInput): Promise<void> {}
  async recordFailedLogin(): Promise<void> {}
  async findSession(
    context: WorkspaceContext,
    tokenHash: string,
    readAt: Date,
  ): Promise<CurrentSession | null> {
    return this.findSessionMock(context, tokenHash, readAt);
  }
  async revokeSessionAndAudit(
    context: WorkspaceContext,
    tokenHash: string,
    revokedAt: Date,
  ): Promise<boolean> {
    return this.revokeMock(context, tokenHash, revokedAt);
  }
}

function createCookie(expiresAt: number): string {
  return sealSessionCookie({ version: 1, workspaceId, token: "a".repeat(43), expiresAt }, secret);
}

describe("session lifecycle and authorization", () => {
  it("rejects a protected request without a session", () => {
    expect(() => requireSessionValue(null)).toThrow("Authentication required");
  });

  it("accepts a protected request with a valid server-side session", async () => {
    const repository = new SessionRepository();
    const current = await readCurrentSession(
      createCookie(Date.parse("2026-10-08T00:00:00.000Z")),
      secret,
      repository,
      now,
    );

    expect(requireSessionValue(current)).toEqual(session);
    expect(repository.findSessionMock).toHaveBeenCalledWith(
      { workspaceId },
      expect.stringMatching(/^[a-f0-9]{64}$/),
      now,
    );
  });

  it("rejects an expired session before querying the database", async () => {
    const repository = new SessionRepository();

    await expect(
      readCurrentSession(
        createCookie(Date.parse("2026-09-30T23:59:59.000Z")),
        secret,
        repository,
        now,
      ),
    ).resolves.toBeNull();
    expect(repository.findSessionMock).not.toHaveBeenCalled();
  });

  it("rejects a session when the repository reports inactive membership", async () => {
    const repository = new SessionRepository();
    repository.findSessionMock.mockResolvedValueOnce(null);

    await expect(
      readCurrentSession(
        createCookie(Date.parse("2026-10-08T00:00:00.000Z")),
        secret,
        repository,
        now,
      ),
    ).resolves.toBeNull();
  });

  it("invalidates the server session and records logout through the repository", async () => {
    const repository = new SessionRepository();
    const cookie = createCookie(Date.parse("2026-10-08T00:00:00.000Z"));

    await expect(revokeCookieSession(cookie, secret, repository, now)).resolves.toBe(true);
    expect(repository.revokeMock).toHaveBeenCalledWith(
      { workspaceId },
      expect.stringMatching(/^[a-f0-9]{64}$/),
      now,
    );
  });

  it("denies cross-workspace access", () => {
    expect(() => assertWorkspaceAccess(session, otherWorkspaceId)).toThrow(
      "Workspace access denied",
    );
    expect(assertWorkspaceAccess(session, workspaceId)).toEqual(session);
  });
});
