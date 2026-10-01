import { pathToFileURL } from "node:url";

import { createLogger } from "@sakani/logger";

import { EncryptedFileAuthStore } from "./auth/encrypted-store.js";
import { BaileysConnector } from "./connection/baileys-connector.js";
import { ConnectionManager } from "./connection/manager.js";
import { ConnectionStateMachine } from "./connection/state-machine.js";
import type { GatewayLogger } from "./connection/types.js";
import { loadGatewayConfig } from "./config.js";
import { QrManager } from "./qr/qr-manager.js";
import { closeServer, createGatewayServer, listen } from "./server.js";

export async function startGateway(): Promise<void> {
  const config = loadGatewayConfig();
  const logger = createLogger({
    level: config.logLevel,
    base: { service: "wa-gateway" },
  }) as GatewayLogger;
  const authStore = new EncryptedFileAuthStore(
    config.authDataDirectory,
    config.sessionEncryptionKey,
  );
  const qrManager = new QrManager();
  const stateMachine = new ConnectionStateMachine();
  const connector = new BaileysConnector(authStore, logger);
  const manager = new ConnectionManager(connector, stateMachine, qrManager, logger);
  const server = createGatewayServer({
    manager,
    qrManager,
    internalServiceToken: config.internalServiceToken,
    logger,
  });

  await listen(server, config.port);
  logger.info(
    { event: "wa.gateway.started", port: config.port, autoConnect: false },
    "Gateway WhatsApp siap tanpa koneksi otomatis",
  );

  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    await manager.stop();
    await closeServer(server);
  };
  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
  startGateway().catch(() => {
    process.stderr.write(
      "Gateway WhatsApp gagal dimulai karena konfigurasi atau startup tidak valid.\n",
    );
    process.exitCode = 1;
  });
}
