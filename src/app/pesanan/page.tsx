"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { api, type Booking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, rupiah } from "@/lib/format";
import { statusColor } from "@/lib/status";

export default function OrdersPage() {
  const { user, ready } = useAuth();
  const [items, setItems] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api<{ data: Booking[] }>("/bookings")
      .then((r) => setItems(r.data))
      .catch((e) => setError((e as Error).message));
  }, [user]);

  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  if (!user) {
    return (
      <div className="p-6 text-sm">
        <Link href="/masuk/?next=/pesanan/" className="text-brand underline">Masuk</Link> untuk melihat pesananmu.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4">
      <h1 className="text-xl font-bold">Pesanan saya</h1>
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {items === null && !error && <div className="text-sm text-slate-500">Memuat...</div>}
      {items?.length === 0 && (
        <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">
          Belum ada pesanan. <Link href="/" className="text-brand underline">Cari kos di peta</Link> lalu ajukan PO.
        </div>
      )}
      {items?.map((b) => (
        <Link key={b.id} href={`/pesanan/detail/?id=${b.id}`} className="block rounded-xl border p-3 hover:bg-slate-50">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold">{b.kos?.name}</div>
              <div className="text-sm text-slate-600">{b.room?.name} · {rupiah(b.room?.price)}/bln</div>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(b.status)}`}>{b.status_label}</span>
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-500">
            <span className="font-mono">{b.number}</span>
            <span>{dateTime(b.requested_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
