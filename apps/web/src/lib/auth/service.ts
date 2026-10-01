import { randomBytes, randomUUID } from "node:crypto";

import { requireWorkspaceContext } from "@sakani/database";

import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";
import { generateSessionToken, hashSessionToken } from "./session-crypto";
import type { AuthIdentity, AuthRepository, SessionMaterial } from "./types";
import { loginSchema, registrationSchema } from "./validation";

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export type AuthFailureCode = "invalid_input" | "invalid_credentials" | "registration_failed";

export type AuthResult =
  { ok: true; session: SessionMaterial } | { ok: false; code: AuthFailureCode };

export interface AuthServiceDependencies {
  now: () => Date;
  generateToken: () => string;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (passwordHash: string, password: string) => Promise<boolean>;
  sessionTtlMs: number;
}

const defaultDependencies: AuthServiceDependencies = {
  now: () => new Date(),
  generateToken: generateSessionToken,
  hashPassword,
  verifyPassword,
  sessionTtlMs: DEFAULT_SESSION_TTL_MS,
};

function getAuditMembership(identity: AuthIdentity) {
  return identity.membership;
}

function createWorkspaceSlug(workspaceName: string): string {
  const prefix = workspaceName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const suffix = randomBytes(6).toString("hex");
  return `${prefix || "workspace"}-${suffix}`;
}

export function createAuthService(
  repository: AuthRepository,
  overrides: Partial<AuthServiceDependencies> = {},
) {
  const dependencies: AuthServiceDependencies = { ...defaultDependencies, ...overrides };

  return {
    async login(input: unknown): Promise<AuthResult> {
      const parsed = loginSchema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, code: "invalid_input" };
      }

      const identity = await repository.findIdentityByEmail(parsed.data.email);
      const passwordMatches = await dependencies.verifyPassword(
        identity?.passwordHash ?? DUMMY_PASSWORD_HASH,
        parsed.data.password,
      );
      const membership = identity ? getAuditMembership(identity) : null;
      const canAccess =
        identity?.status === "active" &&
        membership?.status === "active" &&
        Boolean(identity.passwordHash) &&
        passwordMatches;

      if (!identity || !membership || !canAccess) {
        if (identity && membership) {
          await repository.recordFailedLogin(
            requireWorkspaceContext(membership.workspaceId),
            identity.id,
            passwordMatches ? "access_denied" : "invalid_credentials",
            dependencies.now(),
          );
        }
        return { ok: false, code: "invalid_credentials" };
      }

      const now = dependencies.now();
      const token = dependencies.generateToken();
      const expiresAt = new Date(now.getTime() + dependencies.sessionTtlMs);
      await repository.createAuthenticatedSession({
        workspaceId: membership.workspaceId,
        userId: identity.id,
        tokenHash: hashSessionToken(token),
        expiresAt,
        now,
      });

      return {
        ok: true,
        session: { workspaceId: membership.workspaceId, token, expiresAt },
      };
    },

    async register(input: unknown): Promise<AuthResult> {
      const parsed = registrationSchema.safeParse(input);
      if (!parsed.success) {
        return { ok: false, code: "invalid_input" };
      }

      const now = dependencies.now();
      const token = dependencies.generateToken();
      const expiresAt = new Date(now.getTime() + dependencies.sessionTtlMs);
      const passwordHash = await dependencies.hashPassword(parsed.data.password);
      const workspaceId = randomUUID();

      try {
        await repository.createOwnerAccount({
          workspaceId,
          email: parsed.data.email,
          displayName: parsed.data.displayName,
          workspaceName: parsed.data.workspaceName,
          workspaceSlug: createWorkspaceSlug(parsed.data.workspaceName),
          passwordHash,
          userId: randomUUID(),
          tokenHash: hashSessionToken(token),
          expiresAt,
          now,
        });
      } catch {
        return { ok: false, code: "registration_failed" };
      }

      return { ok: true, session: { workspaceId, token, expiresAt } };
    },
  };
}
