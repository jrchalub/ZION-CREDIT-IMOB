"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardList,
  FileSearch,
  LayoutDashboard,
  LogOut,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clientes", icon: Users },
  { href: "/processes", label: "Processos", icon: ClipboardList },
  { href: "/audit", label: "Auditoria", icon: FileSearch },
];

export function AppShell({
  children,
  userName,
  userRole,
}: {
  children: React.ReactNode;
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/v1/auth", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f4f6f8_45%,_#eef1f4_100%)] text-slate-900">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-950 text-slate-100 md:flex">
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-xs tracking-[0.2em] text-teal-300/90 uppercase">
            ZION CREDIT
          </p>
          <h1 className="mt-1.5 font-serif text-xl leading-tight text-white">
            Pré-Crédito Imobiliário
          </h1>
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                  active
                    ? "bg-teal-500/15 text-teal-200"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium text-white">{userName}</p>
          <p className="text-xs text-slate-400">{userRole}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur md:hidden">
          <p className="text-xs tracking-[0.18em] text-teal-700 uppercase">
            ZION CREDIT
          </p>
        </header>
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
