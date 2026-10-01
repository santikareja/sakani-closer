import type { WorkspaceContext } from "@sakani/database";

export interface MembershipIdentity {
  workspaceId: string;
  workspaceName: string;
  role: string;
  status: string;
}

export interface AuthIdentity {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string | null;
  status: string;
  membership: MembershipIdentity | null;
}

export interface CurrentSession {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string | null;
  workspaceId: string;
  workspaceName: string;
  role: string;
  expiresAt: Date;
}

export interface NewSessionInput extends WorkspaceContext {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  now: Date;
}

export interface NewOwnerAccountInput extends NewSessionInput {
  email: string;
  displayName: string;
  workspaceName: string;
  workspaceSlug: string;
  passwordHash: string;
}

export interface AuthRepository {
  findIdentityByEmail(email: string): Promise<AuthIdentity | null>;
  createOwnerAccount(input: NewOwnerAccountInput): Promise<AuthIdentity>;
  createAuthenticatedSession(input: NewSessionInput): Promise<void>;
  recordFailedLogin(
    context: WorkspaceContext,
    userId: string,
    reason: "invalid_credentials" | "access_denied",
    now: Date,
  ): Promise<void>;
  findSession(
    context: WorkspaceContext,
    tokenHash: string,
    now: Date,
  ): Promise<CurrentSession | null>;
  revokeSessionAndAudit(context: WorkspaceContext, tokenHash: string, now: Date): Promise<boolean>;
}

export interface SessionMaterial extends WorkspaceContext {
  token: string;
  expiresAt: Date;
}
