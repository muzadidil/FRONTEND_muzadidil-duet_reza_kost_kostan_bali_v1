"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { AuthProvider, useAuth } from "@/lib/auth";

// Nama aplikasi di satu tempat supaya mudah diganti saat nama final ditetapkan (rencana bagian 19). Logo tidak memuat teks.
export const APP_NAME = "Kos-Kosan";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href.replace(/\/$/, ""));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-2 font-medium transition ${active ? "bg-brand-wash text-brand" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
    >
      {children}
    </Link>
  );
}

function Header() {
  const { user, ready, demo, signOut } = useAuth();

  // Halaman peta memakai tinggi layar dikurangi kepala situs (var(--header-h)). Spanduk percontohan menambah tinggi
  // di atasnya, jadi nilainya disesuaikan di sini. 4rem = tinggi kepala, 1,75rem = spanduk, 1px = garis bawah.
  useEffect(() => {
    document.documentElement.style.setProperty("--header-h", demo ? "calc(5.75rem + 1px)" : "calc(4rem + 1px)");
  }, [demo]);

  return (
    <>
      {demo && (
        <div className="bg-gold-soft px-4 py-1.5 text-center text-xs font-semibold text-gold-dark">
          Mode percontohan: semua data contoh dan tidak ada uang yang berpindah.
        </div>
      )}
      <header className="sticky top-0 z-[1000] border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="relative flex h-16 items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME}, ke beranda`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${BASE}/logo.png`} alt="" width={66} height={48} className="h-12 w-auto" />
            <span className="text-lg font-extrabold tracking-tight text-brand">{APP_NAME}</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/cari/">Cari</NavLink>
            {user && <NavLink href="/pesanan/">Pesanan</NavLink>}
            {user && <NavLink href="/pengelola/">Pengelola</NavLink>}
            {ready && !user && (
              <Link href="/masuk/" className="ml-1 rounded-lg bg-brand px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-dark">
                Masuk
              </Link>
            )}
            {user && (
              <button onClick={() => signOut()} className="rounded-lg px-3 py-2 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" title={user.email}>
                Keluar
              </button>
            )}
          </nav>
          {/* Garis emas tipis di bawah kepala situs, memudar ke kanan. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -bottom-px h-[3px] bg-gradient-to-r from-gold via-gold/50 to-transparent" />
        </div>
      </header>
    </>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Header />
      <main className="flex flex-1 flex-col">{children}</main>
    </AuthProvider>
  );
}
