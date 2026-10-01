import {
  connectionReasons,
  connectionStates,
  type ConnectionReason,
  type ConnectionSnapshot,
  type ConnectionState,
} from "./types.js";

const transitions: Record<ConnectionState, ReadonlySet<ConnectionState>> = {
  disconnected: new Set(["connecting", "stopping"]),
  connecting: new Set([
    "qr_ready",
    "connected",
    "logged_out",
    "auth_error",
    "transient_error",
    "disconnected",
    "stopping",
  ]),
  qr_ready: new Set([
    "qr_ready",
    "connecting",
    "connected",
    "logged_out",
    "auth_error",
    "transient_error",
    "disconnected",
    "stopping",
  ]),
  connected: new Set(["logged_out", "auth_error", "transient_error", "disconnected", "stopping"]),
  logged_out: new Set(["connecting", "disconnected", "stopping"]),
  auth_error: new Set(["connecting", "disconnected", "stopping"]),
  transient_error: new Set(["transient_error", "connecting", "disconnected", "stopping"]),
  stopping: new Set(["disconnected"]),
};

export class InvalidStateTransitionError extends Error {
  constructor(from: ConnectionState, to: ConnectionState) {
    super(`Invalid WhatsApp gateway state transition: ${from} -> ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

export class ConnectionStateMachine {
  private snapshot: ConnectionSnapshot;

  constructor(private readonly now: () => Date = () => new Date()) {
    this.snapshot = {
      state: "disconnected",
      reason: "service_started",
      updatedAt: this.now().toISOString(),
    };
  }

  getSnapshot(): ConnectionSnapshot {
    return { ...this.snapshot };
  }

  transition(to: ConnectionState, reason: ConnectionReason): ConnectionSnapshot {
    if (!connectionStates.includes(to) || !connectionReasons.includes(reason)) {
      throw new TypeError("Unknown connection state or reason");
    }

    if (!transitions[this.snapshot.state].has(to)) {
      throw new InvalidStateTransitionError(this.snapshot.state, to);
    }

    this.snapshot = { state: to, reason, updatedAt: this.now().toISOString() };
    return this.getSnapshot();
  }
}
