import { Writable } from "node:stream";

import { describe, expect, it } from "vitest";

import { createLogger, withLoggerContext } from "./index";

describe("logger", () => {
  it("redacts credential and message fields while adding correlation context", () => {
    let output = "";
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const logger = withLoggerContext(createLogger({ destination, base: {} }), {
      correlationId: "request-123",
      workspaceId: "00000000-0000-4000-8000-000000000001",
    });

    logger.info(
      {
        apiKey: "should-not-leak",
        passwordHash: "password-hash-must-not-leak",
        sessionToken: "session-token-must-not-leak",
        req: { headers: { cookie: "sakani_session=must-not-leak" } },
        AUTH_SECRET: "auth-secret-must-not-leak",
        message: { content: "private chat" },
      },
      "event",
    );

    expect(output).not.toContain("should-not-leak");
    expect(output).not.toContain("private chat");
    expect(output).not.toContain("password-hash-must-not-leak");
    expect(output).not.toContain("session-token-must-not-leak");
    expect(output).not.toContain("sakani_session=must-not-leak");
    expect(output).not.toContain("auth-secret-must-not-leak");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("request-123");
  });
});
