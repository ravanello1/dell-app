"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LogOut, Package, Settings, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logoutAction } from "@/modules/auth/auth.actions";
import { userRoleLabels } from "@/modules/auth/user.schema";
import type { SessionUser } from "@/core/auth/session";
import { studio } from "@/core/config/studio";
import { cn } from "@/core/utils/cn";
import { DellMark, DellWordmark } from "@/ui/brand";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Ausente = visível para todos os papéis. */
  ownerOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Hoje", icon: Sparkles },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/estoque", label: "Estoque", icon: Package },
  { href: "/config", label: "Ajustes", icon: Settings, ownerOnly: true },
];

/** "/" só casa exato; as demais casam com as subrotas (/clientes/abc). */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function visibleItems(session: SessionUser): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.ownerOnly || session.role === "OWNER");
}

/** Navegação lateral (desktop) + barra inferior (celular). */
export function AppNav({ session }: { session: SessionUser }) {
  const pathname = usePathname();
  const items = visibleItems(session);

  return (
    <>
      {/* ── Desktop: coluna fixa à esquerda ─────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-4">
          <DellWordmark subtitle={`${studio.name} · ${studio.city}`} />
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Navegação principal">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-(--radius-field) px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
                    : "text-ink-700 hover:bg-gold-50 hover:text-gold-800",
                )}
              >
                <item.icon
                  className={cn("size-[18px] shrink-0", active ? "text-rose-600" : "text-gold-600")}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium text-ink-900">{session.name}</p>
            <p className="truncate text-xs text-ink-400">{userRoleLabels[session.role]}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-(--radius-field) px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <LogOut className="size-[18px] shrink-0" aria-hidden />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* ── Celular: barra fixa no rodapé, ao alcance do polegar ────────── */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md pb-safe md:hidden"
      >
        <ul className="flex items-stretch">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-full flex-col items-center justify-center gap-1 px-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors",
                    active ? "text-rose-700" : "text-ink-600",
                  )}
                >
                  <item.icon
                    className={cn("size-[22px]", active ? "text-rose-600" : "text-gold-600")}
                    aria-hidden
                  />
                  <span className="leading-none">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Barra superior — só aparece no celular, onde não há coluna lateral. */
export function AppTopBar({ session }: { session: SessionUser }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <DellMark className="size-8 shrink-0" />
        <div className="min-w-0 leading-tight">
          <p className="font-display text-base font-semibold text-ink-900">
            Dell <span className="text-gold-700">App</span>
          </p>
          <p className="truncate text-[11px] text-ink-400">{session.name}</p>
        </div>
      </div>

      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Sair"
          className="rounded-full p-2.5 text-ink-600 transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <LogOut className="size-5" aria-hidden />
        </button>
      </form>
    </header>
  );
}
