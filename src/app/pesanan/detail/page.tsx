"use client";

import Link from "@/components/Link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Chat } from "@/components/Chat";
import KosMap from "@/components/KosMap";
import { api, ApiError, getAppConfig, type Booking, type RouteInfo } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { date, dateTime, remaining, rupiah } from "@/lib/format";
import { decodePolyline } from "@/lib/polyline";
import { statusColor } from "@/lib/status";

const STEPS = ["Diajukan", "Dijawab pengelola", "Dibayar", "Deal"];
const STEP_OF: Record<string, number> = { requested: 0, approved: 1, paid: 2, completed: 3 };
const FINAL = ["completed", "declined", "expired", "cancelled", "forfeited", "refunded"];

const REFUND_REASONS = [
  ["room_occupied", "Kamar ternyata sudah terisi"],
  ["fake_listing", "Data kos palsu atau tidak sesuai"],
  ["manager_absent", "Pengelola tidak muncul"],
];

type PayResponse = { data: { method: string; amount: number; reference: string; details: Record<string, string | null> }; confirmed: boolean };

function Timeline({ status }: { status: string }) {
  const current = STEP_OF[status];
  if (current === undefined) return null;
  return (
    <ol className="flex items-center gap-1 text-[11px]">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center gap-1">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i <= current ? "bg-brand text-white" : "bg-slate-200 text-slate-500"}`}>{i < current ? "✓" : i + 1}</span>
          <span className={`truncate ${i <= current ? "font-medium text-slate-800" : "text-slate-500"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Detail() {
  const params = useSearchParams();
  const id = params.get("id");
  const asManager = params.get("as") === "manager";
  const { user, ready } = useAuth();

  const [b, setB] = useState<Booking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pay, setPay] = useState<PayResponse | null>(null);
  const [showRefund, setShowRefund] = useState(false);
  const [refund, setRefund] = useState({ reason: "room_occupied", note: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const base = asManager ? "/manager/bookings" : "/bookings";

  // Rute dari lokasi pelanggan ke kos. Hanya muncul kalau admin sudah mengisi kunci Google di Pengaturan.
  const [routingOn, setRoutingOn] = useState(false);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);

  useEffect(() => {
    getAppConfig().then((config) => setRoutingOn(!!config?.maps.routing));
  }, []);

  const routePoints = useMemo(() => (route ? decodePolyline(route.polyline) : null), [route]);
  const destination = b?.kos && !b.kos.location_is_approximate ? ([b.kos.latitude, b.kos.longitude] as [number, number]) : null;
  const destinationMarkers = useMemo(() => (destination && routePoints ? [{ id: 0, lat: destination[0], lng: destination[1], label: "Kos" }] : []), [destination?.[0], destination?.[1], routePoints]); // eslint-disable-line react-hooks/exhaustive-deps

  async function showRoute() {
    setRouteError(null);
    if (!navigator.geolocation) {
      setRouteError("Peramban ini tidak bisa membaca lokasi. Pakai tombol Google Maps di bawah.");
      return;
    }
    setRouteBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const from: [number, number] = [position.coords.latitude, position.coords.longitude];
        try {
          const result = await api<{ data: RouteInfo }>(`/bookings/${id}/route`, { method: "POST", body: { origin_lat: from[0], origin_lng: from[1] } });
          setOrigin(from);
          setRoute(result.data);
        } catch (e) {
          setRouteError(e instanceof ApiError ? e.message : "Rute belum bisa dimuat.");
        } finally {
          setRouteBusy(false);
        }
      },
      () => {
        setRouteBusy(false);
        setRouteError("Izin lokasi ditolak. Aktifkan lokasi di peramban, atau pakai tombol Google Maps di bawah.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api<{ data: Booking }>(`${base}/${id}`);
      setB(res.data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, base]);

  useEffect(() => {
    if (!user) return;
    // Memuat data saat halaman dibuka: setState baru dipanggil setelah await di dalam load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // Status bisa berubah dari sisi lawan (pengelola menjawab, admin melunaskan): periksa ulang tiap 6 detik.
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 6000);
    return () => clearInterval(timer);
  }, [user, load]);

  async function act(name: string, path: string, options: Parameters<typeof api>[1] = { method: "POST" }, success?: string) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      const res = await api<unknown>(path, options);
      if (success) setNotice(success);
      await load();
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function payNow() {
    const res = (await act("pay", `/bookings/${id}/pay`)) as PayResponse | null;
    if (res && !res.confirmed) setPay(res);
    if (res?.confirmed) setNotice("Pembayaran diterima. Titik tepat kos, resi, dan chat sudah terbuka.");
  }

  async function submitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError("Lampirkan foto bukti di lokasi.");
      return;
    }
    const form = new FormData();
    form.append("reason", refund.reason);
    if (refund.note) form.append("note", refund.note);
    form.append("photo", photo);
    const res = await act("refund", `/bookings/${id}/refund-request`, { method: "POST", form }, "Pengajuan pengembalian terkirim. Admin akan memeriksanya.");
    if (res) setShowRefund(false);
  }

  if (!id) return <div className="p-6 text-sm">PO tidak dipilih. <Link href="/pesanan/" className="text-brand underline">Lihat pesanan</Link></div>;
  if (!ready) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;
  if (!user) return <div className="p-6 text-sm"><Link href={`/masuk/?next=${encodeURIComponent(`/pesanan/detail/?id=${id}`)}`} className="text-brand underline">Masuk</Link> untuk melihat PO ini.</div>;
  if (error && !b) return <div className="p-6 text-sm text-red-700">{error}</div>;
  if (!b) return <div className="p-6 text-sm text-slate-500">Memuat...</div>;

  const a = b.actions;
  const isManager = b.role === "manager";
  const kos = b.kos;
  const exact = kos && !kos.location_is_approximate;
  const back = isManager ? "/pengelola/" : "/pesanan/";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 pb-12">
      <Link href={back} className="text-sm text-brand">← {isManager ? "Kembali ke pengelola" : "Pesanan saya"}</Link>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h1 className="min-w-0 truncate text-lg font-bold">{kos?.name}</h1>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusColor(b.status)}`}>{b.status_label}</span>
        </div>
        <div className="text-sm text-slate-600">{b.room?.name} · {rupiah(b.room?.price)}/bulan · <span className="font-mono">{b.number}</span></div>
        <Timeline status={b.status} />
      </div>

      {notice && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</div>}
      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Pesan status dan aksi utama */}
      <div className="space-y-3 rounded-xl border bg-white p-4 text-sm">
        {b.status === "requested" && !isManager && (
          <p>Menunggu pengelola menjawab apakah kamar masih kosong. Batas jawab: <strong>{remaining(b.answer_deadline_at)}</strong> lagi. Belum ada biaya.</p>
        )}
        {b.status === "requested" && isManager && (
          <>
            <p>
              <strong>{b.counterpart?.name}</strong> ingin memesan kamar ini. Jawab sebelum <strong>{remaining(b.answer_deadline_at)}</strong>: apakah kamarnya masih kosong?
            </p>
            {a.can_answer && (
              <div className="flex gap-2">
                <button disabled={!!busy} onClick={() => act("yes", `/manager/bookings/${id}/answer`, { method: "POST", body: { available: true } }, "Terkirim. Pelanggan diminta membayar.")} className="flex-1 rounded-lg bg-green-600 py-2 font-medium text-white disabled:opacity-60">
                  Masih kosong
                </button>
                <button disabled={!!busy} onClick={() => act("no", `/manager/bookings/${id}/answer`, { method: "POST", body: { available: false } }, "PO ditolak dan kamar ditandai terisi.")} className="flex-1 rounded-lg border py-2 font-medium disabled:opacity-60">
                  Sudah terisi
                </button>
              </div>
            )}
          </>
        )}

        {b.status === "approved" && !isManager && (
          <>
            <p>
              Kabar baik: pengelola memastikan kamar <strong>masih kosong</strong>. Bayar biaya jasa <strong>{rupiah(b.fee_amount)}</strong> dalam <strong>{remaining(b.payment_deadline_at)}</strong> untuk membuka titik tepat, rute, dan chat.
            </p>
            {a.can_pay && (
              <button disabled={!!busy} onClick={payNow} className="w-full rounded-lg bg-brand py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60">
                {busy === "pay" ? "Memproses..." : `Bayar ${rupiah(b.fee_amount)}`}
              </button>
            )}
            {pay && !pay.confirmed && (
              <div className="space-y-1 rounded-lg bg-slate-50 p-3">
                <div className="font-medium">Transfer {rupiah(pay.data.amount)}</div>
                {Object.entries(pay.data.details).map(([k, v]) => v && <div key={k} className="text-xs text-slate-700">{k === "note" ? v : `${k.replace("_", " ")}: ${v}`}</div>)}
                <div className="text-xs">Berita transfer: <strong className="font-mono">{pay.data.reference}</strong>. PO aktif setelah admin memeriksa pembayaran.</div>
              </div>
            )}
          </>
        )}
        {b.status === "approved" && isManager && <p>Kamu sudah memastikan kamar kosong. Menunggu <strong>{b.counterpart?.name}</strong> membayar ({remaining(b.payment_deadline_at)} lagi).</p>}

        {b.status === "paid" && (
          <p>
            PO <strong>sudah dibayar</strong>. Datang ke lokasi sebelum <strong>{dateTime(b.valid_until)}</strong> ({remaining(b.valid_until)} lagi).
            {isManager ? " Setelah pelanggan melihat kamar dan sepakat, kedua pihak menekan konfirmasi deal." : " Kalau cocok dan jadi menempati, tekan konfirmasi deal. Kalau tidak jadi, PO hangus."}
          </p>
        )}
        {b.status === "completed" && <p>Deal selesai. {isManager ? "Komisimu akan dibayarkan admin." : "Semoga betah!"}</p>}
        {b.status === "declined" && <p>Pengelola menjawab kamar sudah terisi. <strong>Tidak ada biaya.</strong> {!isManager && <Link href={`/kos/?id=${kos?.id}`} className="text-brand underline">Lihat kamar lain</Link>}</p>}
        {b.status === "expired" && <p>PO kedaluwarsa karena tidak ada jawaban atau pembayaran tepat waktu. Tidak ada biaya.</p>}
        {b.status === "cancelled" && <p>PO dibatalkan. Tidak ada biaya.</p>}
        {b.status === "forfeited" && <p>Masa berlaku PO berakhir tanpa deal, jadi biaya jasa hangus.{!isManager && " Kalau ini karena kesalahan pihak kos, kamu masih bisa mengajukan pengembalian."}</p>}
        {b.status === "refunded" && <p>Pengembalian disetujui. Admin akan mentransfer {rupiah(b.fee_amount)} ke pelanggan.</p>}

        {a.can_confirm_deal && (
          <button disabled={!!busy} onClick={() => act("deal", isManager ? `/manager/bookings/${id}/confirm-deal` : `/bookings/${id}/confirm-deal`, { method: "POST" }, "Konfirmasi tercatat. Menunggu pihak lain.")} className="w-full rounded-lg bg-green-600 py-2.5 font-medium text-white disabled:opacity-60">
            Konfirmasi deal (jadi menempati)
          </button>
        )}
        {b.status === "paid" && (b.customer_confirmed_at || b.manager_confirmed_at) && !a.can_confirm_deal && <p className="text-xs text-slate-500">Konfirmasi kamu tercatat. Menunggu pihak lain; kalau diam beberapa hari, klaim dianggap benar.</p>}

        {a.can_cancel && (
          <button disabled={!!busy} onClick={() => confirm("Batalkan PO ini? Belum ada biaya yang terpotong.") && act("cancel", `/bookings/${id}/cancel`, { method: "POST" })} className="w-full rounded-lg border py-2 text-slate-700 disabled:opacity-60">
            Batalkan PO
          </button>
        )}
      </div>

      {/* Lawan bicara */}
      {b.counterpart && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          <div className="text-xs text-slate-500">{isManager ? "Pelanggan" : "Pengelola"}</div>
          <div className="font-semibold">{b.counterpart.name}</div>
          {b.counterpart.phone ? <a href={`tel:${b.counterpart.phone}`} className="text-brand">+{b.counterpart.phone}</a> : <div className="text-xs text-slate-500">Nomor HP terbuka setelah PO dibayar.</div>}
        </div>
      )}

      {/* Resi */}
      {b.receipt && (
        <div className="space-y-1 rounded-xl border-2 border-dashed border-green-300 bg-green-50 p-4 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-green-800">Resi pembayaran</div>
          <div className="text-lg font-bold">{b.receipt.title}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
            <span>Nomor</span><span className="font-mono">{b.receipt.number}</span>
            <span>Jumlah</span><span>{rupiah(b.receipt.amount)}</span>
            <span>Dibayar</span><span>{dateTime(b.receipt.paid_at)}</span>
            <span>Berlaku sampai</span><span>{dateTime(b.receipt.valid_until)}</span>
            {b.receipt.reference && <><span>Referensi</span><span className="font-mono">{b.receipt.reference}</span></>}
          </div>
          <p className="pt-1 text-xs text-slate-700">{b.receipt.note}</p>
        </div>
      )}

      {/* Lokasi tepat: hanya setelah dibayar */}
      {exact && kos && (
        <div className="space-y-2 rounded-xl border bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lokasi kos</div>
          <div className="font-semibold">{kos.name}</div>
          <div className="text-sm text-slate-700">{kos.address}</div>
          <div className="h-52 overflow-hidden rounded-lg border">
            {routePoints && origin ? (
              <KosMap key="rute" center={[kos.latitude, kos.longitude]} zoom={15} pin={origin} markers={destinationMarkers} route={routePoints} />
            ) : (
              <KosMap key="titik" center={[kos.latitude, kos.longitude]} zoom={17} pin={[kos.latitude, kos.longitude]} clickToPlacePin />
            )}
          </div>
          {route && (
            <div className="rounded-lg bg-brand-wash px-3 py-2 text-sm text-brand-dark">
              Jarak lewat jalan <strong>{(route.distance_m / 1000).toFixed(1).replace(".", ",")} km</strong>, sekitar <strong>{Math.max(1, Math.round(route.duration_s / 60))} menit</strong> berkendara.
            </div>
          )}
          {routeError && <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{routeError}</div>}
          {routingOn && !isManager && (
            <button onClick={showRoute} disabled={routeBusy} className="block w-full rounded-lg border border-brand py-2 text-center text-sm font-medium text-brand hover:bg-brand-wash disabled:opacity-50">
              {routeBusy ? "Mencari rute..." : route ? "Muat ulang rute dari lokasi saya" : "Tampilkan rute dari lokasi saya"}
            </button>
          )}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${kos.latitude},${kos.longitude}`} target="_blank" rel="noreferrer" className="block rounded-lg bg-brand py-2 text-center text-sm font-medium text-white hover:bg-brand-dark">
            Buka rute di Google Maps
          </a>
        </div>
      )}
      {!exact && kos && !isManager && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Lokasi saat ini hanya perkiraan ({kos.public_area}). Nama, alamat, titik tepat, dan rute terbuka setelah PO dibayar.</div>
      )}

      {/* Chat */}
      {(a.can_chat || b.paid_at) && (
        <div className="space-y-2">
          <h2 className="font-semibold">Chat dengan {isManager ? "pelanggan" : "pengelola"}</h2>
          <Chat bookingId={b.id} canWrite={a.can_chat} />
        </div>
      )}

      {/* Pengembalian */}
      {b.refund && (
        <div className="rounded-xl border bg-white p-3 text-sm">
          <div className="font-semibold">Pengembalian: {b.refund.status_label}</div>
          <div className="text-slate-600">{b.refund.reason_label}{b.refund.note ? ` — ${b.refund.note}` : ""}</div>
          {b.refund.decision_note && <div className="mt-1 text-xs text-slate-500">Catatan admin: {b.refund.decision_note}</div>}
        </div>
      )}
      {a.can_request_refund && !showRefund && (
        <button onClick={() => setShowRefund(true)} className="text-sm text-red-700 underline">Ada masalah di kos? Ajukan pengembalian</button>
      )}
      {showRefund && (
        <form onSubmit={submitRefund} className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-semibold">Ajukan pengembalian</div>
          <p className="text-xs text-slate-600">Hanya untuk kesalahan pihak kos. Berubah pikiran tidak termasuk.</p>
          <select value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} className="w-full rounded-lg border bg-white px-3 py-2">
            {REFUND_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <textarea value={refund.note} onChange={(e) => setRefund({ ...refund, note: e.target.value })} placeholder="Ceritakan singkat (opsional)" rows={2} className="w-full rounded-lg border bg-white px-3 py-2" />
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} required className="w-full text-xs" />
          <div className="flex gap-2">
            <button disabled={busy === "refund"} className="flex-1 rounded-lg bg-red-600 py-2 font-medium text-white disabled:opacity-60">Kirim pengajuan</button>
            <button type="button" onClick={() => setShowRefund(false)} className="rounded-lg border bg-white px-4">Batal</button>
          </div>
        </form>
      )}

      {/* Bintang */}
      {a.can_review && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act("review", `/bookings/${id}/review`, { method: "POST", body: { rating, comment: comment || null } }, "Terima kasih! Ulasanmu tampil di halaman kos.");
          }}
          className="space-y-2 rounded-xl border bg-white p-3 text-sm"
        >
          <div className="font-semibold">Beri bintang untuk kos ini</div>
          <div className="flex gap-1 text-2xl">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} onClick={() => setRating(n)} className={n <= rating ? "text-star" : "text-slate-400"} aria-label={`${n} bintang`}>★</button>
            ))}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ceritakan pengalamanmu (opsional)" rows={2} className="w-full rounded-lg border px-3 py-2" />
          <button disabled={busy === "review"} className="w-full rounded-lg bg-brand py-2 font-medium text-white disabled:opacity-60">Kirim ulasan</button>
        </form>
      )}
      {b.status === "completed" && !isManager && !a.can_review && b.completed_at && (
        <p className="text-xs text-slate-500">Bintang bisa diberikan 30 hari setelah deal ({date(b.completed_at)}).</p>
      )}

      {!FINAL.includes(b.status) && <p className="text-center text-[11px] text-slate-500">Halaman ini memperbarui status otomatis.</p>}
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Memuat...</div>}>
      <Detail />
    </Suspense>
  );
}
