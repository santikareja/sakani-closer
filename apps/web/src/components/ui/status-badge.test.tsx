import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusBadge } from "./status-badge";

describe("StatusBadge", () => {
  it.each(["success", "warning", "danger", "neutral", "info"] as const)(
    "renders the %s state with text and an icon",
    (tone) => {
      const markup = renderToStaticMarkup(<StatusBadge tone={tone}>Status aman</StatusBadge>);
      expect(markup).toContain(`status-badge-${tone}`);
      expect(markup).toContain("Status aman");
      expect(markup).toContain('aria-hidden="true"');
    },
  );
});
