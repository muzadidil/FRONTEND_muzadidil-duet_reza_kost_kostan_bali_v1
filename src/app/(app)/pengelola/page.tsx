"use client";

import Link from "@/components/Link";
import { useCallback, useEffect, useState } from "react";
import { api, type Booking, type KosDetail } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTime, remaining, rupiah } from "@/lib/format";
import { statusColor } from "@/lib/status";

export default function ManagerHome() {
  const { user, ready, refresh } = useAuth();
  const [tab, setTab] = useState<"inbox" | "kos">("inbox");
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [kosList, setKosList] = useState<KosDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isManager = !!user?.is_manager;

  const load = useCallback(async () => {
    try {
      const [b, k] = await Promise.all([api<{ data: Booking[] }>("/manager/bookings"), api<{ data: KosDetail[] }>("/manager/kos")]);
      setBookings(b.data);
      setKosList(k.data);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!isManager) return;
    // Memuat data saat halaman dibuka: setState baru dipanggil setelah await di dalam load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 10000);
    return () => clearInterval(timer);
  }, [isManager, load]);

  async function becomeManager() {
    setBusy(true);
    setError(null);
    try {
      await api("/me/manager", { method: "POST" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRoom(roomId: number, available: boolean) {
    try {
      await api(`/manager/rooms/${roomId}/status`, { method: "PATCH", body: { status: available ? "occupied" : "available" } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;
  if (!user) return <div className="p-6 text-sm"><Link href="/masuk/?next=/pengelola/" className="text-brand underline">Masuk</Link> untuk mengelola kosmu.</div>;

  if (!isManager) {
    return (
      <div className="mx-auto w-full max-w-md space-y-3 p-5">
        <h1 className="text-xl font-bold">Jadi pengelola kos</h1>
        <p className="text-sm text-slate-600">
          Pasang kos yang kamu kelola atau tinggali. Setiap pelanggan yang jadi menempati lewat aplikasi, kamu mendapat bagian dari biaya jasa PO.
        </p>
        {user.needs_phone && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Isi nomor HP dulu di <Link href="/masuk/" className="underline">halaman Masuk</Link>.</div>}
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <button onClick={becomeManager} disabled={busy || user.needs_phone} className="w-full rounded-lg bg-brand py-2.5 font-medium text-white disabled:opacity-60">Daftar sebagai pengelola</button>
      </div>
    );
  }

  const waiting = bookings?.filter((b) => b.status === "requested").length ?? 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-3 p-4 pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Pengelola</h1>
        <Link href="/pengelola/kos-baru/" className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark">+ Pasang kos</Link>
      </div>

      <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
        <button onClick={() => setTab("inbox")} className={`flex-1 rounded-md py-1.5 font-medium ${tab === "inbox" ? "bg-white shadow-sm" : "text-slate-600"}`}>
          PO masuk {waiting > 0 && <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{waiting}</span>}
        </button>
        <button onClick={() => setTab("kos")} className={`flex-1 rounded-md py-1.5 font-medium ${tab === "kos" ? "bg-white shadow-sm" : "text-slate-600"}`}>Kos saya</button>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === "inbox" && (
        <div className="space-y-2">
          {bookings === null && <div className="text-sm text-slate-500">Memuat...</div>}
          {bookings?.length === 0 && <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">Belum ada PO. PO muncul di sini saat pelanggan memesan kamarmu.</div>}
          {bookings?.map((b) => (
            <Link key={b.id} href={`/pesanan/detail/?id=${b.id}&as=manager`} className={`block rounded-xl border bg-white p-3 hover:bg-slate-50 ${b.status === "requested" ? "border-red-300 bg-red-50/40" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{b.kos?.name}</div>
                  <div className="text-sm text-slate-600">{b.room?.name} · dari {b.counterpart?.name}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(b.status)}`}>{b.status_label}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>{b.status === "requested" ? `Jawab dalam ${remaining(b.answer_deadline_at)}` : b.number}</span>
                <span>{dateTime(b.requested_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === "kos" && (
        <div className="space-y-3">
          {kosList === null && <div className="text-sm text-slate-500">Memuat...</div>}
          {kosList?.length === 0 && <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-600">Belum ada kos. Tekan &quot;+ Pasang kos&quot; untuk memulai.</div>}
          {kosList?.map((k) => (
            <div key={k.id} className="space-y-2 rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{k.name}</div>
                  <div className="truncate text-xs text-slate-500">{k.address}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${k.is_verified ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                  {k.is_verified ? "Terverifikasi" : "Menunggu verifikasi admin"}
                </span>
              </div>
              <ul className="space-y-1">
                {k.rooms.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{r.name} · {rupiah(r.price)}</span>
                    <button onClick={() => toggleRoom(r.id, r.is_available)} className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${r.is_available ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"}`} title="Ketuk untuk mengubah">
                      {r.is_available ? "Kosong" : "Terisi"}
                    </button>
                  </li>
                ))}
                {k.rooms.length === 0 && <li className="text-xs text-slate-500">Belum ada kamar.</li>}
              </ul>
              <Link href={`/pengelola/kos/?id=${k.id}`} className="block rounded-lg border py-1.5 text-center text-sm font-medium hover:bg-slate-50">Kelola kamar dan foto</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
