import makeWASocket, {
  DisconnectReason,
  isJidBroadcast,
  isJidGroup,
} from "@whiskeysockets/baileys";

import { createBaileysAuthState } from "../auth/baileys-auth-state.js";
import type { AuthStore } from "../auth/store.js";
import type {
  ConnectionCallbacks,
  DisconnectKind,
  GatewayConnector,
  GatewayLogger,
  GatewaySocket,
} from "./types.js";

export class ConnectorAuthenticationError extends Error {
  constructor() {
    super("WhatsApp authentication state could not be loaded");
    this.name = "ConnectorAuthenticationError";
  }
}

function getDisconnectStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object" || !("output" in error)) return undefined;
  const output = error.output;
  if (!output || typeof output !== "object" || !("statusCode" in output)) return undefined;
  return typeof output.statusCode === "number" ? output.statusCode : undefined;
}

export function classifyDisconnect(error: unknown): DisconnectKind {
  const code = getDisconnectStatusCode(error);
  if (code === DisconnectReason.loggedOut) return "logged_out";
  if (
    code === DisconnectReason.badSession ||
    code === DisconnectReason.multideviceMismatch ||
    code === DisconnectReason.forbidden ||
    code === DisconnectReason.connectionReplaced
  ) {
    return "auth_error";
  }
  return "transient_error";
}

export class BaileysConnector implements GatewayConnector {
  constructor(
    private readonly authStore: AuthStore,
    private readonly logger: GatewayLogger,
    private readonly socketFactory: typeof makeWASocket = makeWASocket,
  ) {}

  async open(callbacks: ConnectionCallbacks): Promise<GatewaySocket> {
    let auth: Awaited<ReturnType<typeof createBaileysAuthState>>;
    try {
      auth = await createBaileysAuthState(this.authStore);
    } catch {
      throw new ConnectorAuthenticationError();
    }

    const socket = this.socketFactory({
      auth: auth.state,
      logger: this.logger as never,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      fireInitQueries: false,
      enableRecentMessageCache: false,
      shouldSyncHistoryMessage: () => false,
      shouldIgnoreJid: (jid) => Boolean(isJidGroup(jid) || isJidBroadcast(jid)),
      getMessage: async () => undefined,
    });

    let closed = false;
    socket.ev.on("creds.update", () => {
      void auth.saveCreds().catch(() => {
        this.logger.error(
          { event: "wa.auth.persist_failed" },
          "Gagal menyimpan kredensial WhatsApp",
        );
        if (!closed) {
          closed = true;
          callbacks.onClose("auth_error");
          void socket.end(new Error("auth_persistence_failed"));
        }
      });
    });

    socket.ev.on("connection.update", (update) => {
      if (update.qr) callbacks.onQr(update.qr);
      if (update.connection === "open") callbacks.onOpen();
      if (update.connection === "close" && !closed) {
        closed = true;
        callbacks.onClose(classifyDisconnect(update.lastDisconnect?.error));
      }
    });

    return {
      close: async () => {
        closed = true;
        await socket.end(undefined);
      },
    };
  }
}
