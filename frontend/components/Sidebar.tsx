"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconGrid() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  );
}
function IconUpload() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function IconZap() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

const navItems = [
  { href: "/",       label: "Dashboard",      Icon: IconGrid },
  { href: "/upload", label: "Nova Análise",   Icon: IconUpload },
  { href: "#",       label: "Relatórios",     Icon: IconFile },
  { href: "#",       label: "Clientes",       Icon: IconUsers },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden lg:flex flex-col w-60 min-h-screen sticky top-0"
      style={{ background: "#22021E" }}
    >
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5" style={{ borderBottom: "1px solid rgba(247,247,247,0.08)" }}>
        <div
          className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
          style={{ background: "#C1B7FE", color: "#22021E" }}
        >
          <IconZap />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "#F7F7F7", letterSpacing: "-0.01em" }}>
            ForAudits
          </p>
          <p className="text-xs" style={{ color: "rgba(247,247,247,0.38)", lineHeight: 1 }}>
            PRCE Automation
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5">
        {navItems.map(({ href, label, Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href) && href !== "#";
          return (
            <Link
              key={label}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                color: isActive ? "#F7F7F7" : "rgba(247,247,247,0.48)",
                background: isActive ? "rgba(247,247,247,0.08)" : "transparent",
                textDecoration: "none",
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = "rgba(247,247,247,0.72)";
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = "rgba(247,247,247,0.48)";
              }}
            >
              <Icon />
              {label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: "#C1B7FE" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3" style={{ height: 1, background: "rgba(247,247,247,0.08)" }} />

      {/* User pill */}
      <div className="px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: "rgba(247,247,247,0.05)" }}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
            style={{ background: "rgba(193,183,254,0.2)", color: "#C1B7FE" }}
          >
            R
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: "#F7F7F7" }}>Ricardo</p>
            <p className="text-xs truncate" style={{ color: "rgba(247,247,247,0.38)" }}>auditor</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
