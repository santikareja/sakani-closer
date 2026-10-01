import type { ConnectionSnapshot } from "../connection/types.js";

export function createHealthPayload(connection: ConnectionSnapshot) {
  return {
    status: "ok" as const,
    service: "wa-gateway" as const,
    connection,
  };
}
