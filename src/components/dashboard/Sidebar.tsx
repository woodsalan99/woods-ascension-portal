"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import {
  ChevronRight,
  ChevronDown,
  Home,
  BarChart3,
  Calendar,
  Map,
  Boxes,
  LogOut,
  ScrollText,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/metrics", label: "Metrics", icon: BarChart3 },
  { href: "/appointments", label: "Appointments", icon: Calendar },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/infrastructure", label: "Infrastructure", icon: Boxes },
  { href: "/changelog", label: "Changelog", icon: ScrollText },
];

export function Sidebar({ clientName, showSignOut = true }: { clientName: string; showSignOut?: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { signOut } = useClerk();

  return (
    <aside className={`wa-sidebar ${collapsed ? "wa-sidebar-collapsed" : ""}`}>
      <div className="wa-sidebar-top">
        <div className="wa-sidebar-wordmark-text">
          Woods
          <br />
          Ascension
        </div>
        <button
          className="wa-sidebar-collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight
            size={16}
            style={{
              transform: collapsed ? "none" : "rotate(180deg)",
              transition: "transform .18s ease",
            }}
          />
        </button>
      </div>

      <nav className="wa-sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`wa-sidebar-link ${isActive ? "active" : ""}`}
            >
              <Icon />
              <span className="wa-sidebar-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="wa-sidebar-bottom">
        <div className="wa-sidebar-help">
          <div className="wa-sidebar-help-q">Have a question?</div>
          <div className="wa-sidebar-help-sub">We&apos;re here to help.</div>
          <a className="wa-sidebar-help-btn" href="mailto:alan@woodsascension.com">
            Message Alan
          </a>
        </div>
        <div className="wa-sidebar-client-wrap">
          <button
            className="wa-sidebar-client"
            onClick={() => showSignOut && setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            <div className="wa-sidebar-client-avatar">{clientName.charAt(0)}</div>
            <div className="wa-sidebar-client-name">{clientName}</div>
            {showSignOut && <ChevronDown size={14} style={{ marginLeft: "auto" }} />}
          </button>
          {showSignOut && menuOpen && (
            <button
              className="wa-sidebar-signout"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
            >
              <LogOut size={14} /> Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
