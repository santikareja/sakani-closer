import { describe, expect, it } from "vitest";

import { allNavigation, getNavigationLabel, isNavigationItemActive } from "./navigation";

describe("dashboard navigation", () => {
  it("contains each required primary product destination", () => {
    expect(allNavigation.map((item) => item.label)).toEqual([
      "Overview",
      "Inbox",
      "WhatsApp",
      "Contacts",
      "AI Workspace",
      "Agents",
      "Knowledge",
      "Analytics",
      "Settings",
    ]);
    expect(allNavigation.every((item) => item.icon.length > 0)).toBe(true);
  });

  it("matches nested routes without making Overview active everywhere", () => {
    expect(isNavigationItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavigationItemActive("/dashboard/inbox", "/dashboard")).toBe(false);
    expect(isNavigationItemActive("/dashboard/settings/whatsapp", "/dashboard/settings")).toBe(
      true,
    );
    expect(getNavigationLabel("/dashboard/settings/whatsapp")).toBe("WhatsApp");
  });
});
