export type NavigationIcon =
  | "overview"
  | "inbox"
  | "whatsapp"
  | "contacts"
  | "ai"
  | "agents"
  | "knowledge"
  | "analytics"
  | "settings";

export interface NavigationItem {
  href: string;
  label: string;
  icon: NavigationIcon;
  preview?: boolean;
}

export const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/inbox", label: "Inbox", icon: "inbox" },
  { href: "/dashboard/settings/whatsapp", label: "WhatsApp", icon: "whatsapp" },
  { href: "/dashboard/contacts", label: "Contacts", icon: "contacts", preview: true },
];

export const intelligenceNavigation: NavigationItem[] = [
  { href: "/dashboard/ai", label: "AI Workspace", icon: "ai", preview: true },
  { href: "/dashboard/agents", label: "Agents", icon: "agents", preview: true },
  { href: "/dashboard/knowledge", label: "Knowledge", icon: "knowledge", preview: true },
  { href: "/dashboard/analytics", label: "Analytics", icon: "analytics", preview: true },
];

export const utilityNavigation: NavigationItem[] = [
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export const allNavigation = [
  ...primaryNavigation,
  ...intelligenceNavigation,
  ...utilityNavigation,
];

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getNavigationLabel(pathname: string): string {
  return (
    [...allNavigation]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => isNavigationItemActive(pathname, item.href))?.label ?? "Dashboard"
  );
}
