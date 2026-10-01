import { describe, expect, it } from "vitest";

import { DEFAULT_PIPELINE_STAGES, SAKANI_WORKSPACE } from "./seed-data";

describe("pipeline seed", () => {
  it("contains one stable workspace and the ordered default stages", () => {
    expect(SAKANI_WORKSPACE.slug).toBe("sakani");
    expect(DEFAULT_PIPELINE_STAGES.map((stage) => stage.name)).toEqual([
      "Baru",
      "Terkualifikasi",
      "Survei",
      "Sudah Survei",
      "Booking",
      "Akad",
      "Closing",
      "Lost",
    ]);
    expect(new Set(DEFAULT_PIPELINE_STAGES.map((stage) => stage.position)).size).toBe(8);
    expect(
      DEFAULT_PIPELINE_STAGES.filter((stage) => stage.isTerminal).map((stage) => stage.name),
    ).toEqual(["Closing", "Lost"]);
  });
});
