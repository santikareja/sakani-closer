import { describe, expect, it } from "vitest";

import { ConnectionStateMachine, InvalidStateTransitionError } from "./state-machine.js";

describe("ConnectionStateMachine", () => {
  it("starts disconnected and applies valid deterministic transitions", () => {
    const timestamps = [
      new Date("2026-10-01T00:00:00.000Z"),
      new Date("2026-10-01T00:00:01.000Z"),
      new Date("2026-10-01T00:00:02.000Z"),
    ];
    const machine = new ConnectionStateMachine(() => timestamps.shift()!);

    expect(machine.getSnapshot()).toEqual({
      state: "disconnected",
      reason: "service_started",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(machine.transition("connecting", "connect_requested").state).toBe("connecting");
    expect(machine.transition("qr_ready", "qr_received")).toEqual({
      state: "qr_ready",
      reason: "qr_received",
      updatedAt: "2026-10-01T00:00:02.000Z",
    });
  });

  it("rejects invalid transitions and unrecognized reasons", () => {
    const machine = new ConnectionStateMachine();

    expect(() => machine.transition("connected", "connection_opened")).toThrow(
      InvalidStateTransitionError,
    );
    expect(() => machine.transition("connecting", "raw secret" as never)).toThrow(TypeError);
  });
});
