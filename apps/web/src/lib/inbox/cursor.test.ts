import { describe, expect, it } from "vitest";

import { decodeInboxCursor, encodeInboxCursor } from "./cursor";

describe("inbox keyset cursor", () => {
  it("round-trips a timestamp and stable UUID", () => {
    const cursor = {
      at: new Date("2026-10-02T00:00:00.000Z"),
      id: "00000000-0000-4000-8000-000000000001",
    };
    expect(decodeInboxCursor(encodeInboxCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors without throwing", () => {
    expect(decodeInboxCursor("not-a-valid-cursor")).toBeUndefined();
  });
});
