import "server-only";

import {
  auditLogs,
  DEFAULT_PIPELINE_STAGES,
  getDatabase,
  memberships,
  pipelineStages,
  sessions,
  users,
  workspaces,
  type WorkspaceContext,
} from "@sakani/database";
import { and, eq, gt, isNull } from "drizzle-orm";

import type {
  AuthIdentity,
  AuthRepository,
  CurrentSession,
  NewOwnerAccountInput,
  NewSessionInput,
} from "./types";

export class DrizzleAuthRepository implements AuthRepository {
  async findIdentityByEmail(email: string): Promise<AuthIdentity | null> {
    const database = getDatabase();
    const [user] = await database
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        passwordHash: users.passwordHash,
        status: users.status,
        defaultWorkspaceId: users.defaultWorkspaceId,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      return null;
    }

    if (!user.defaultWorkspaceId) {
      return { ...user, membership: null };
    }

    const context: WorkspaceContext = { workspaceId: user.defaultWorkspaceId };
    const [membership] = await database
      .select({
        workspaceId: memberships.workspaceId,
        workspaceName: workspaces.name,
        role: memberships.role,
        status: memberships.status,
      })
      .from(memberships)
      .innerJoin(
        workspaces,
        and(eq(workspaces.id, memberships.workspaceId), eq(workspaces.id, context.workspaceId)),
      )
      .where(and(eq(memberships.workspaceId, context.workspaceId), eq(memberships.userId, user.id)))
      .limit(1);

    return { ...user, membership: membership ?? null };
  }

  async createOwnerAccount(input: NewOwnerAccountInput): Promise<AuthIdentity> {
    const database = getDatabase();

    return database.transaction(async (transaction) => {
      await transaction.insert(workspaces).values({
        id: input.workspaceId,
        name: input.workspaceName,
        slug: input.workspaceSlug,
        createdAt: input.now,
        updatedAt: input.now,
      });
      await transaction.insert(users).values({
        id: input.userId,
        email: input.email,
        displayName: input.displayName,
        defaultWorkspaceId: input.workspaceId,
        passwordHash: input.passwordHash,
        status: "active",
        lastLoginAt: input.now,
        createdAt: input.now,
        updatedAt: input.now,
      });
      await transaction.insert(memberships).values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        role: "owner",
        status: "active",
        createdAt: input.now,
        updatedAt: input.now,
      });
      await transaction.insert(pipelineStages).values(
        DEFAULT_PIPELINE_STAGES.map((stage) => ({
          workspaceId: input.workspaceId,
          ...stage,
          createdAt: input.now,
          updatedAt: input.now,
        })),
      );
      await transaction.insert(sessions).values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.now,
        updatedAt: input.now,
      });
      await transaction.insert(auditLogs).values([
        {
          workspaceId: input.workspaceId,
          actorUserId: input.userId,
          action: "auth.register.succeeded",
          entityType: "user",
          metadata: {},
          createdAt: input.now,
          updatedAt: input.now,
        },
        {
          workspaceId: input.workspaceId,
          actorUserId: input.userId,
          action: "auth.login.succeeded",
          entityType: "session",
          metadata: { method: "registration" },
          createdAt: input.now,
          updatedAt: input.now,
        },
      ]);

      return {
        id: input.userId,
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        status: "active",
        membership: {
          workspaceId: input.workspaceId,
          workspaceName: input.workspaceName,
          role: "owner",
          status: "active",
        },
      };
    });
  }

  async createAuthenticatedSession(input: NewSessionInput): Promise<void> {
    const database = getDatabase();
    await database.transaction(async (transaction) => {
      await transaction.insert(sessions).values({
        workspaceId: input.workspaceId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.now,
        updatedAt: input.now,
      });
      await transaction
        .update(users)
        .set({ lastLoginAt: input.now, updatedAt: input.now })
        .where(eq(users.id, input.userId));
      await transaction.insert(auditLogs).values({
        workspaceId: input.workspaceId,
        actorUserId: input.userId,
        action: "auth.login.succeeded",
        entityType: "session",
        metadata: {},
        createdAt: input.now,
        updatedAt: input.now,
      });
    });
  }

  async recordFailedLogin(
    context: WorkspaceContext,
    userId: string,
    reason: "invalid_credentials" | "access_denied",
    now: Date,
  ): Promise<void> {
    await getDatabase().insert(auditLogs).values({
      workspaceId: context.workspaceId,
      actorUserId: userId,
      action: "auth.login.failed",
      entityType: "user",
      metadata: { reason },
      createdAt: now,
      updatedAt: now,
    });
  }

  async findSession(
    context: WorkspaceContext,
    tokenHash: string,
    now: Date,
  ): Promise<CurrentSession | null> {
    const [session] = await getDatabase()
      .select({
        sessionId: sessions.id,
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        role: memberships.role,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(
        memberships,
        and(
          eq(memberships.userId, sessions.userId),
          eq(memberships.workspaceId, sessions.workspaceId),
          eq(memberships.workspaceId, context.workspaceId),
        ),
      )
      .innerJoin(
        workspaces,
        and(eq(workspaces.id, sessions.workspaceId), eq(workspaces.id, context.workspaceId)),
      )
      .where(
        and(
          eq(sessions.workspaceId, context.workspaceId),
          eq(sessions.tokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, now),
          eq(users.status, "active"),
          eq(memberships.status, "active"),
        ),
      )
      .limit(1);

    return session ?? null;
  }

  async revokeSessionAndAudit(
    context: WorkspaceContext,
    tokenHash: string,
    now: Date,
  ): Promise<boolean> {
    return getDatabase().transaction(async (transaction) => {
      const [session] = await transaction
        .select({ id: sessions.id, userId: sessions.userId })
        .from(sessions)
        .where(
          and(
            eq(sessions.workspaceId, context.workspaceId),
            eq(sessions.tokenHash, tokenHash),
            isNull(sessions.revokedAt),
          ),
        )
        .limit(1);

      if (!session) {
        return false;
      }

      await transaction
        .update(sessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(sessions.id, session.id),
            eq(sessions.workspaceId, context.workspaceId),
            eq(sessions.tokenHash, tokenHash),
          ),
        );
      await transaction.insert(auditLogs).values({
        workspaceId: context.workspaceId,
        actorUserId: session.userId,
        action: "auth.logout.succeeded",
        entityType: "session",
        metadata: {},
        createdAt: now,
        updatedAt: now,
      });
      return true;
    });
  }
}
