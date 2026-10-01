import "server-only";

import { getCurrentSession } from "../auth/dal";
import { DrizzleInboxRepository } from "./repository";
import type { InboxRouteDependencies } from "./route-handlers";

export function getInboxRouteDependencies(): InboxRouteDependencies {
  return {
    getSession: getCurrentSession,
    repository: new DrizzleInboxRepository(),
  };
}
