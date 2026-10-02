import "server-only";

import { cache } from "react";

import { requireWorkspaceContext } from "@sakani/database";

import type { WhatsAppStatusResponse } from "./contracts";
import { createPublicWhatsAppStatus } from "./route-handlers";
import { getWhatsAppRouteDependencies } from "./route-runtime";

export const getDashboardWhatsAppStatus = cache(
  async (): Promise<WhatsAppStatusResponse | null> => {
    const dependencies = getWhatsAppRouteDependencies();
    const session = await dependencies.getSession();
    if (!session || session.role !== "owner") return null;
    const context = requireWorkspaceContext(session.workspaceId);
    const [gateway, account] = await Promise.all([
      dependencies.gateway.getStatus().catch(() => null),
      dependencies.accountRegistry.getAccount(context).catch(() => null),
    ]);
    return createPublicWhatsAppStatus(gateway, account, context.workspaceId);
  },
);
