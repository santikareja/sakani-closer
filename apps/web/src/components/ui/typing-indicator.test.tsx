import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TypingIndicator } from "./typing-indicator";

describe("TypingIndicator", () => {
  it("renders only for an explicit typing state", () => {
    expect(renderToStaticMarkup(<TypingIndicator typing={false} />)).toBe("");
    const markup = renderToStaticMarkup(<TypingIndicator typing />);
    expect(markup).toContain("Sedang mengetik");
    expect(markup.match(/<span/g)).toHaveLength(3);
  });
});
