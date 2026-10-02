import "server-only";

import { cache } from "react";

import type { GatewayStatusResponse } from "./contracts";
import { getWhatsAppRouteDependencies } from "./route-runtime";

export const getDashboardWhatsAppStatus = cache(async (): Promise<GatewayStatusResponse | null> =>
  getWhatsAppRouteDependencies()
    .gateway.getStatus()
    .catch(() => null),
);
