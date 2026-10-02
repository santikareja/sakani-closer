"use client";

import { AddressBookIcon } from "@phosphor-icons/react/dist/csr/AddressBook";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { BooksIcon } from "@phosphor-icons/react/dist/csr/Books";
import { CaretDoubleLeftIcon } from "@phosphor-icons/react/dist/csr/CaretDoubleLeft";
import { CaretDoubleRightIcon } from "@phosphor-icons/react/dist/csr/CaretDoubleRight";
import { ChartLineUpIcon } from "@phosphor-icons/react/dist/csr/ChartLineUp";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import { RobotIcon } from "@phosphor-icons/react/dist/csr/Robot";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { WhatsappLogoIcon } from "@phosphor-icons/react/dist/csr/WhatsappLogo";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { Icon } from "@phosphor-icons/react/lib";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition, type ReactNode } from "react";

import type { WhatsAppViewModel } from "../../types/whatsapp";
import {
  getNavigationLabel,
  intelligenceNavigation,
  isNavigationItemActive,
  primaryNavigation,
  utilityNavigation,
  type NavigationIcon,
  type NavigationItem,
} from "./navigation";
import { ToastProvider } from "../ui/toast-provider";

interface AppShellSession {
  displayName: string | null;
  email: string;
  workspaceName: string;
  role: string;
}

const iconMap: Record<NavigationIcon, Icon> = {
  overview: HouseIcon,
  inbox: ChatsCircleIcon,
  whatsapp: WhatsappLogoIcon,
  contacts: AddressBookIcon,
  ai: SparkleIcon,
  agents: RobotIcon,
  knowledge: BooksIcon,
  analytics: ChartLineUpIcon,
  settings: GearIcon,
};

function NavigationLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: (() => void) | undefined;
}) {
  const IconComponent = iconMap[item.icon];
  const active = isNavigationItemActive(pathname, item.href);
  return (
    <Link
      className={`app-nav-link${active ? " app-nav-link-active" : ""}`}
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      data-tooltip={collapsed ? item.label : undefined}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      <IconComponent size={20} weight={active ? "fill" : "regular"} aria-hidden="true" />
      <span className="app-nav-label">{item.label}</span>
      {item.preview ? <span className="nav-preview">Segera</span> : null}
    </Link>
  );
}

function NavigationGroup({
  label,
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  label: string;
  items: NavigationItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate: (() => void) | undefined;
}) {
  return (
    <div className="app-nav-group">
      <p className="app-nav-heading">{label}</p>
      <nav aria-label={label}>
        {items.map((item) => (
          <NavigationLink
            collapsed={collapsed}
            item={item}
            key={item.href}
            onNavigate={onNavigate}
            pathname={pathname}
          />
        ))}
      </nav>
    </div>
  );
}

function NavigationContent({
  pathname,
  collapsed,
  session,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  session: AppShellSession;
  onNavigate: (() => void) | undefined;
}) {
  const initial = (session.displayName ?? session.email).slice(0, 1).toUpperCase();
  return (
    <>
      <div className="app-brand-row">
        <Link className="app-brand" href="/dashboard" aria-label="Sakani Closer">
          <span className="app-brand-mark">S</span>
          <span className="app-brand-copy">
            <strong>Sakani</strong>
            <small>Closer</small>
          </span>
        </Link>
      </div>

      <button
        className="workspace-switcher"
        type="button"
        disabled
        title="Perpindahan workspace belum tersedia"
      >
        <span className="workspace-avatar" aria-hidden="true">
          {session.workspaceName.slice(0, 1).toUpperCase()}
        </span>
        <span className="workspace-copy">
          <small>Workspace</small>
          <strong>{session.workspaceName}</strong>
        </span>
        <span className="workspace-state">Segera</span>
      </button>

      <div className="app-nav-scroll">
        <NavigationGroup
          collapsed={collapsed}
          items={primaryNavigation}
          label="Workspace"
          onNavigate={onNavigate ?? undefined}
          pathname={pathname}
        />
        <NavigationGroup
          collapsed={collapsed}
          items={intelligenceNavigation}
          label="Intelligence"
          onNavigate={onNavigate ?? undefined}
          pathname={pathname}
        />
        <NavigationGroup
          collapsed={collapsed}
          items={utilityNavigation}
          label="Sistem"
          onNavigate={onNavigate ?? undefined}
          pathname={pathname}
        />
      </div>

      <div className="app-profile">
        <span className="profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="profile-copy">
          <strong>{session.displayName ?? "Owner"}</strong>
          <small>{session.email}</small>
        </span>
        <form action="/api/auth/logout" method="post">
          <button className="profile-logout" type="submit">
            Keluar
          </button>
        </form>
      </div>
    </>
  );
}

export function AppShell({
  children,
  session,
  whatsapp,
}: {
  children: ReactNode;
  session: AppShellSession;
  whatsapp: WhatsAppViewModel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const pageLabel = getNavigationLabel(pathname);

  const closeMobileNavigation = useCallback(() => mobileDialog.current?.close(), []);
  const refresh = useCallback(() => {
    startRefresh(() => router.refresh());
  }, [router]);

  return (
    <ToastProvider>
      <div className="app-shell" data-sidebar-collapsed={collapsed ? "true" : "false"}>
        <aside className="app-sidebar" aria-label="Navigasi utama">
          <NavigationContent
            collapsed={collapsed}
            onNavigate={undefined}
            pathname={pathname}
            session={session}
          />
          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <CaretDoubleRightIcon size={18} aria-hidden="true" />
            ) : (
              <CaretDoubleLeftIcon size={18} aria-hidden="true" />
            )}
            <span>{collapsed ? "Perluas" : "Ciutkan"}</span>
          </button>
        </aside>

        <dialog className="mobile-nav-dialog" ref={mobileDialog} aria-label="Navigasi mobile">
          <div className="mobile-nav-surface">
            <button
              className="icon-button mobile-nav-close"
              type="button"
              onClick={closeMobileNavigation}
              aria-label="Tutup navigasi"
            >
              <XIcon size={22} aria-hidden="true" />
            </button>
            <NavigationContent
              collapsed={false}
              onNavigate={closeMobileNavigation}
              pathname={pathname}
              session={session}
            />
          </div>
        </dialog>

        <div className="app-stage">
          <header className="app-topbar">
            <div className="topbar-leading">
              <button
                className="icon-button mobile-menu-button"
                type="button"
                onClick={() => mobileDialog.current?.showModal()}
                aria-label="Buka navigasi"
              >
                <ListIcon size={22} aria-hidden="true" />
              </button>
              <div>
                <p className="breadcrumb">
                  <span>Dashboard</span>
                  <span aria-hidden="true">/</span>
                  <strong>{pageLabel}</strong>
                </p>
                <p className="topbar-mobile-title">{pageLabel}</p>
              </div>
            </div>
            <div className="topbar-actions">
              <div className="topbar-status" aria-live="polite">
                <span
                  className={`semantic-dot semantic-dot-${whatsapp.connectionState}`}
                  aria-hidden="true"
                />
                <span>{whatsapp.connectionLabel}</span>
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={refresh}
                disabled={refreshing}
                aria-label="Muat ulang data halaman"
                title="Muat ulang"
              >
                <ArrowsClockwiseIcon
                  className={refreshing ? "is-spinning" : undefined}
                  size={20}
                  aria-hidden="true"
                />
              </button>
              <button
                className="icon-button"
                type="button"
                disabled
                aria-label="Notifikasi belum tersedia"
                title="Notifikasi belum tersedia"
              >
                <BellIcon size={20} aria-hidden="true" />
              </button>
            </div>
          </header>
          <main className="app-content" id="main-content">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
