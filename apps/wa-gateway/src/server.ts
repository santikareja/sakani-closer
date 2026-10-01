import { createServer, type Server } from "node:http";

import type { InternalRouteDependencies } from "./internal/routes.js";
import { createInternalRequestHandler } from "./internal/routes.js";

export function createGatewayServer(dependencies: InternalRouteDependencies): Server {
  const handler = createInternalRequestHandler(dependencies);
  return createServer((request, response) => {
    void handler(request, response);
  });
}

export async function listen(server: Server, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

export async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
