import type { ReactNode } from "react";

/** Public client portal shell — no admin/correspondent nav. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#eef4f8_0%,_#f7f8fa_50%,_#eef1f4_100%)] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/80 px-4 py-4 backdrop-blur">
        <p className="text-xs tracking-[0.2em] text-teal-700 uppercase">
          ZION CREDIT
        </p>
        <p className="mt-0.5 text-sm text-slate-600">Acesso seguro do cliente</p>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  );
}
